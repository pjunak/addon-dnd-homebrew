// Package provider serves published homebrew records (magic items, subclasses
// with their features, feats, spells and species) as the dnd5e.rules-data v3 content
// contract. The D&D Engine merges every compatible provider, so the records
// appear in character sheets next to the compendium's.
//
// Players reach this provider through their own sheet evaluations, so every
// read runs with the caller's authority against public collections only.
package provider

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"sync"

	"github.com/pjunak/addon-dnd-homebrew/internal/homebrew"
	"github.com/pjunak/addon-dnd-homebrew/internal/jsonexact"
	"github.com/pjunak/ttrpg-codex/sdk/go/workerrpc"
)

const (
	Contract        = "dnd5e.rules-data"
	ContractVersion = "3.0.0"
	SetID           = "rules"
	MethodPrefix    = "service/" + Contract + "/"
	defaultLimit    = 100
	loadAttempts    = 3
)

// The digest names the record shape, not a file: it changes only when the
// published record format does.
var schemaDigest = func() string {
	sum := sha256.Sum256([]byte("dnd-homebrew/published-record/v1"))
	return hex.EncodeToString(sum[:])
}()

type DataStore interface {
	Get(context.Context, *workerrpc.Meta, workerrpc.AddonDataReference, string) (workerrpc.AddonDataDocument, error)
	Query(context.Context, *workerrpc.Meta, workerrpc.AddonDataQuery) (workerrpc.AddonDataQueryResult, error)
}

type Handler struct {
	data   DataStore
	log    io.Writer
	mu     sync.Mutex
	cached *snapshot
}

// snapshot is one consistent read of the published collection, keyed by the
// host revision of the publish metadata document that every publish rewrites.
type snapshot struct {
	metaRevision int64
	revision     string
	records      []servedRecord
	byKey        map[string]int
}

func recordKey(kind, id string) string { return kind + "\x00" + id }

type servedRecord struct {
	kind  string
	id    string
	value json.RawMessage
}

func New(data DataStore, log io.Writer) (*Handler, error) {
	if data == nil {
		return nil, errors.New("add-on data client is required")
	}
	if log == nil {
		log = io.Discard
	}
	return &Handler{data: data, log: log}, nil
}

func (handler *Handler) HandleRPC(ctx context.Context, request workerrpc.Request) (any, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	switch request.Method {
	case MethodPrefix + "catalog":
		if err := decodeEmpty(request.Params); err != nil {
			return nil, invalid("rules-data catalog request is invalid")
		}
		current, err := handler.snapshot(ctx, request.Meta)
		if err != nil {
			return nil, err
		}
		kinds := map[string]int{}
		for _, record := range current.records {
			kinds[record.kind]++
		}
		return map[string]any{
			"contractVersion": "content-catalog.v1",
			"sets": []map[string]any{{
				"id": SetID, "revision": current.revision, "schemaSha256": schemaDigest,
				"recordCount": len(current.records), "kinds": kinds,
			}},
		}, nil
	case MethodPrefix + "get":
		var input struct {
			SetID string `json:"setId"`
			Kind  string `json:"kind"`
			ID    string `json:"id"`
		}
		if jsonexact.Decode(request.Params, &input) != nil || input.SetID != SetID || input.Kind == "" || input.ID == "" {
			return nil, invalid("rules-data get request is invalid")
		}
		current, err := handler.snapshot(ctx, request.Meta)
		if err != nil {
			return nil, err
		}
		index, exists := current.byKey[recordKey(input.Kind, input.ID)]
		if !exists {
			return nil, workerrpc.NewRPCError(workerrpc.JSONRPCInvalidParams, workerrpc.KindNotFound, "The homebrew record is not published.", false, nil)
		}
		record := current.records[index]
		return map[string]any{
			"contractVersion": "content-record.v1", "setId": SetID, "revision": current.revision,
			"record": map[string]any{"kind": record.kind, "id": record.id, "value": record.value},
		}, nil
	case MethodPrefix + "query":
		var input struct {
			SetID  string `json:"setId"`
			Kind   string `json:"kind,omitempty"`
			Cursor string `json:"cursor,omitempty"`
			Limit  *int   `json:"limit,omitempty"`
		}
		if jsonexact.Decode(request.Params, &input) != nil || input.SetID != SetID || len(input.Cursor) > 32 ||
			input.Limit != nil && (*input.Limit < 1 || *input.Limit > 200) {
			return nil, invalid("rules-data query request is invalid")
		}
		limit := defaultLimit
		if input.Limit != nil {
			limit = *input.Limit
		}
		current, err := handler.snapshot(ctx, request.Meta)
		if err != nil {
			return nil, err
		}
		return current.page(input.Kind, input.Cursor, limit)
	default:
		return nil, workerrpc.NewRPCError(workerrpc.JSONRPCMethodNotFound, workerrpc.KindNotFound, "Rules-data method not found.", false, nil)
	}
}

func (current *snapshot) page(kind, cursor string, limit int) (any, error) {
	records := current.records
	if kind != "" {
		records = make([]servedRecord, 0, len(current.records))
		for _, record := range current.records {
			if record.kind == kind {
				records = append(records, record)
			}
		}
	}
	stamp := sha256.Sum256([]byte(current.revision + "\x00" + kind))
	start := 0
	if cursor != "" {
		body, err := base64.RawURLEncoding.DecodeString(cursor)
		if err != nil || len(body) != 20 || base64.RawURLEncoding.EncodeToString(body) != cursor || string(body[:16]) != string(stamp[:16]) {
			return nil, invalid("rules-data cursor is stale or invalid")
		}
		start = int(binary.BigEndian.Uint32(body[16:]))
		if start >= len(records) {
			return nil, invalid("rules-data cursor is out of range")
		}
	}
	end := min(start+limit, len(records))
	served := make([]map[string]any, 0, end-start)
	for _, record := range records[start:end] {
		served = append(served, map[string]any{"kind": record.kind, "id": record.id, "value": record.value})
	}
	response := map[string]any{"contractVersion": "content-query-result.v1", "setId": SetID, "revision": current.revision, "records": served}
	if end < len(records) {
		next := make([]byte, 20)
		copy(next, stamp[:16])
		binary.BigEndian.PutUint32(next[16:], uint32(end))
		response["nextCursor"] = base64.RawURLEncoding.EncodeToString(next)
	}
	return response, nil
}

// snapshot returns the cached read while the publish metadata is unchanged.
// A publish rewrites the metadata in the same transaction as the records, so
// an unchanged metadata revision before and after a scan proves the scan saw
// one publish.
func (handler *Handler) snapshot(ctx context.Context, meta *workerrpc.Meta) (*snapshot, error) {
	for range loadAttempts {
		before, err := handler.metaRevision(ctx, meta)
		if err != nil {
			return nil, err
		}
		handler.mu.Lock()
		cached := handler.cached
		handler.mu.Unlock()
		if cached != nil && cached.metaRevision == before {
			return cached, nil
		}
		records := []servedRecord{}
		if before > 0 {
			if records, err = handler.scan(ctx, meta); err != nil {
				return nil, err
			}
		}
		after, err := handler.metaRevision(ctx, meta)
		if err != nil {
			return nil, err
		}
		if after != before {
			continue
		}
		loaded := build(before, records)
		handler.mu.Lock()
		handler.cached = loaded
		handler.mu.Unlock()
		return loaded, nil
	}
	return nil, unavailable("homebrew items were republished while loading; try again")
}

func (handler *Handler) metaRevision(ctx context.Context, meta *workerrpc.Meta) (int64, error) {
	document, err := handler.data.Get(ctx, meta, reference(homebrew.MetaCollection), homebrew.MetaKey)
	var failure *workerrpc.RPCError
	if errors.As(err, &failure) && failure.Data != nil && failure.Data.Kind == workerrpc.KindNotFound {
		return 0, nil
	}
	if err != nil {
		return 0, dataFailure(ctx, err)
	}
	if _, err := homebrew.DecodeMeta(document.Value); err != nil {
		fmt.Fprintf(handler.log, "dnd-homebrew: ignoring invalid publish metadata: %v\n", err)
	}
	return document.Revision, nil
}

// scan reads every published record and drops, with a diagnostic, any that
// the Engine would refuse; one bad document never hides the others.
func (handler *Handler) scan(ctx context.Context, meta *workerrpc.Meta) ([]servedRecord, error) {
	records := []servedRecord{}
	cursor := ""
	for {
		page, err := handler.data.Query(ctx, meta, workerrpc.AddonDataQuery{Reference: reference(homebrew.PublishedCollection), Cursor: cursor, Limit: 200})
		if err != nil {
			return nil, dataFailure(ctx, err)
		}
		for _, document := range page.Documents {
			published, err := homebrew.DecodePublished(document.Value)
			if err == nil && document.Key != published.ID {
				err = fmt.Errorf("key %q does not match record %q", document.Key, published.ID)
			}
			if err != nil {
				fmt.Fprintf(handler.log, "dnd-homebrew: not serving published document %q: %v\n", document.Key, err)
				continue
			}
			if published.Withdrawn {
				continue
			}
			value, err := json.Marshal(published.Record)
			if err != nil {
				return nil, unavailable("could not encode a published homebrew record")
			}
			records = append(records, servedRecord{kind: homebrew.RecordKind, id: published.ID, value: value})
		}
		if page.NextCursor == "" {
			break
		}
		cursor = page.NextCursor
	}
	records, err := handler.scanSubclasses(ctx, meta, records)
	if err != nil {
		return nil, err
	}
	for _, of := range singles {
		if records, err = handler.scanSingle(ctx, meta, records, of); err != nil {
			return nil, err
		}
	}
	return records, nil
}

// scanSubclasses adds each published subclass's subclass and feature records.
// A document that fails its contract is skipped as a whole, so a subclass is
// never served without its features.
func (handler *Handler) scanSubclasses(ctx context.Context, meta *workerrpc.Meta, records []servedRecord) ([]servedRecord, error) {
	cursor := ""
	for {
		page, err := handler.data.Query(ctx, meta, workerrpc.AddonDataQuery{Reference: reference(homebrew.PublishedSubclassesCollection), Cursor: cursor, Limit: 200})
		if err != nil {
			return nil, dataFailure(ctx, err)
		}
		for _, document := range page.Documents {
			published, err := homebrew.DecodePublishedSubclass(document.Value)
			if err == nil && document.Key != published.ID {
				err = fmt.Errorf("key %q does not match record %q", document.Key, published.ID)
			}
			if err != nil {
				fmt.Fprintf(handler.log, "dnd-homebrew: not serving published subclass %q: %v\n", document.Key, err)
				continue
			}
			if published.Withdrawn {
				continue
			}
			for _, raw := range published.Records {
				var identity struct {
					Kind string `json:"kind"`
					ID   string `json:"id"`
				}
				if err := json.Unmarshal(raw, &identity); err != nil {
					return nil, unavailable("could not read a published homebrew subclass")
				}
				var compact bytes.Buffer
				if err := json.Compact(&compact, raw); err != nil {
					return nil, unavailable("could not read a published homebrew subclass")
				}
				records = append(records, servedRecord{kind: identity.Kind, id: identity.ID, value: compact.Bytes()})
			}
		}
		if page.NextCursor == "" {
			return records, nil
		}
		cursor = page.NextCursor
	}
}

// single is a kind that publishes one record per document: its collection,
// record kind, the word diagnostics use and how a document decodes.
type single struct {
	collection string
	kind       string
	label      string
	decode     func([]byte) (id string, withdrawn bool, record json.RawMessage, err error)
}

var singles = []single{
	{homebrew.PublishedFeatsCollection, homebrew.FeatRecordKind, "feat", func(body []byte) (string, bool, json.RawMessage, error) {
		published, err := homebrew.DecodePublishedFeat(body)
		return published.ID, published.Withdrawn, published.Record, err
	}},
	{homebrew.PublishedSpellsCollection, homebrew.SpellRecordKind, "spell", func(body []byte) (string, bool, json.RawMessage, error) {
		published, err := homebrew.DecodePublishedSpell(body)
		return published.ID, published.Withdrawn, published.Record, err
	}},
	{homebrew.PublishedSpeciesCollection, homebrew.SpeciesRecordKind, "species", func(body []byte) (string, bool, json.RawMessage, error) {
		published, err := homebrew.DecodePublishedSpecies(body)
		return published.ID, published.Withdrawn, published.Record, err
	}},
}

// scanSingle adds each published record of one such kind.
func (handler *Handler) scanSingle(ctx context.Context, meta *workerrpc.Meta, records []servedRecord, of single) ([]servedRecord, error) {
	cursor := ""
	for {
		page, err := handler.data.Query(ctx, meta, workerrpc.AddonDataQuery{Reference: reference(of.collection), Cursor: cursor, Limit: 200})
		if err != nil {
			return nil, dataFailure(ctx, err)
		}
		for _, document := range page.Documents {
			id, withdrawn, record, err := of.decode(document.Value)
			if err == nil && document.Key != id {
				err = fmt.Errorf("key %q does not match record %q", document.Key, id)
			}
			if err != nil {
				fmt.Fprintf(handler.log, "dnd-homebrew: not serving published %s %q: %v\n", of.label, document.Key, err)
				continue
			}
			if withdrawn {
				continue
			}
			var compact bytes.Buffer
			if err := json.Compact(&compact, record); err != nil {
				return nil, unavailable("could not read a published homebrew " + of.label)
			}
			records = append(records, servedRecord{kind: of.kind, id: id, value: compact.Bytes()})
		}
		if page.NextCursor == "" {
			return records, nil
		}
		cursor = page.NextCursor
	}
}

func build(metaRevision int64, records []servedRecord) *snapshot {
	sort.Slice(records, func(left, right int) bool {
		if records[left].kind != records[right].kind {
			return records[left].kind < records[right].kind
		}
		return records[left].id < records[right].id
	})
	digest := sha256.New()
	byKey := make(map[string]int, len(records))
	for index, record := range records {
		byKey[recordKey(record.kind, record.id)] = index
		digest.Write([]byte(record.kind))
		digest.Write([]byte{0})
		digest.Write([]byte(record.id))
		digest.Write([]byte{0})
		digest.Write(record.value)
		digest.Write([]byte{0})
	}
	revision := fmt.Sprintf("%d-%s", metaRevision, hex.EncodeToString(digest.Sum(nil))[:16])
	return &snapshot{metaRevision: metaRevision, revision: revision, records: records, byKey: byKey}
}

func reference(collection string) workerrpc.AddonDataReference {
	return workerrpc.AddonDataReference{Kind: workerrpc.AddonDataCollection, DataID: collection}
}

func dataFailure(ctx context.Context, err error) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	return workerrpc.NewRPCError(workerrpc.JSONRPCApplication, workerrpc.KindUnavailable, "Homebrew items are unavailable: "+boundedMessage(err), true, nil)
}

func boundedMessage(err error) string {
	message := err.Error()
	var failure *workerrpc.RPCError
	if errors.As(err, &failure) && failure.Data != nil && failure.Data.Message != "" {
		message = failure.Data.Message
	}
	if len(message) > 200 {
		message = message[:200]
	}
	return message
}

func invalid(message string) error {
	return workerrpc.NewRPCError(workerrpc.JSONRPCInvalidParams, workerrpc.KindInvalidRequest, message, false, nil)
}

func unavailable(message string) error {
	return workerrpc.NewRPCError(workerrpc.JSONRPCApplication, workerrpc.KindUnavailable, message, true, nil)
}

func decodeEmpty(body json.RawMessage) error {
	var value map[string]json.RawMessage
	if jsonexact.Decode(body, &value) != nil || len(value) != 0 {
		return errors.New("expected empty object")
	}
	return nil
}
