// Package importer implements the codex.import-adapter for the
// dnd-homebrew format. Preview reads the stored drafts, normalizes the
// document and retains the exact guarded mutations behind a single-use token;
// commit submits only that reviewed plan. Imports write drafts: nothing reaches
// character sheets until the DM publishes.
package importer

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/pjunak/addon-dnd-homebrew/internal/homebrew"
	"github.com/pjunak/addon-dnd-homebrew/internal/jsonexact"
	"github.com/pjunak/ttrpg-codex/sdk/go/workerrpc"
)

const (
	Contract        = "codex.import-adapter"
	ContractVersion = "2.0.0"
	MethodPrefix    = "service/" + Contract + "/"
	Format          = "dnd-homebrew"
	maximumPlans    = 128
	maximumWrites   = 256
	planLifetime    = 15 * time.Minute
)

type DataStore interface {
	Get(context.Context, *workerrpc.Meta, workerrpc.AddonDataReference, string) (workerrpc.AddonDataDocument, error)
	Query(context.Context, *workerrpc.Meta, workerrpc.AddonDataQuery) (workerrpc.AddonDataQueryResult, error)
	TransactGuarded(context.Context, *workerrpc.Meta, []workerrpc.AddonDataMutation, []workerrpc.AddonDataSetRevision) (workerrpc.AddonDataCommit, error)
}

type Handler struct {
	data  DataStore
	now   func() time.Time
	mu    sync.Mutex
	plans map[string]storedPlan
}

type storedPlan struct {
	expires   time.Time
	mutations []workerrpc.AddonDataMutation
	revisions []workerrpc.AddonDataSetRevision
	writes    int
	deletes   int
}

type stored struct {
	body     json.RawMessage
	revision int64
}

// drafts is the stored drafts of each kind with the revisions they were read at.
type drafts struct {
	sets       map[string]stored
	items      map[string]stored
	subclasses map[string]stored
	revisions  []workerrpc.AddonDataSetRevision
}

func noDrafts() drafts {
	return drafts{sets: map[string]stored{}, items: map[string]stored{}, subclasses: map[string]stored{}}
}

// draftKind is what normalize needs to know about one kind of draft: the
// defaults of a new draft and the optional object fields `{}` clears; a
// cleared field takes its partner with it.
type draftKind struct {
	defaults map[string]json.RawMessage
	optional []string
	partner  map[string]string
	item     bool
}

var (
	setKind = draftKind{
		defaults: map[string]json.RawMessage{"description": json.RawMessage(`""`), "curse": json.RawMessage(`""`), "attunement": json.RawMessage(`false`), "bodyPlacements": json.RawMessage(`[]`), "tags": json.RawMessage(`[]`), "namePrefix": json.RawMessage(`""`), "playerVisible": json.RawMessage(`false`)},
		optional: []string{"condition"},
	}
	itemKind = draftKind{
		defaults: map[string]json.RawMessage{"setId": json.RawMessage(`""`), "text": json.RawMessage(`""`), "overrides": json.RawMessage(`{}`), "tags": json.RawMessage(`[]`), "characterEffects": json.RawMessage(`[]`), "playerVisible": json.RawMessage(`false`), "retired": json.RawMessage(`false`)},
		optional: []string{"grants", "attunementPrerequisites", "container"},
		item:     true,
	}
	subclassKind = draftKind{
		defaults: map[string]json.RawMessage{"text": json.RawMessage(`""`), "excerpt": json.RawMessage(`""`), "spells": json.RawMessage(`[]`), "classResources": json.RawMessage(`[]`), "tableColumns": json.RawMessage(`[]`), "features": json.RawMessage(`[]`)},
		optional: []string{"grants", "spellcasting"},
		partner:  map[string]string{"spellcasting": "progression"},
	}
)

type document struct {
	Format        string            `json:"format"`
	SchemaVersion int               `json:"schemaVersion"`
	GeneratedAt   *int64            `json:"generatedAt,omitempty"`
	Mode          string            `json:"mode,omitempty"`
	Sets          []json.RawMessage `json:"sets"`
	Items         []json.RawMessage `json:"items"`
	Subclasses    []json.RawMessage `json:"subclasses,omitempty"`
}

type summary struct {
	Creates int `json:"creates"`
	Updates int `json:"updates"`
	Skips   int `json:"skips"`
	Deletes int `json:"deletes"`
}

type change struct {
	Collection string `json:"collection"`
	ID         string `json:"id"`
	Operation  string `json:"operation"`
	Label      string `json:"label"`
}

func New(data DataStore) (*Handler, error) {
	if data == nil {
		return nil, errors.New("add-on data client is required")
	}
	return &Handler{data: data, now: time.Now, plans: make(map[string]storedPlan)}, nil
}

func (handler *Handler) HandleRPC(ctx context.Context, request workerrpc.Request) (any, error) {
	if request.Meta == nil || request.Meta.Actor == nil || request.Meta.Actor.Role != "dm" {
		return nil, workerrpc.NewRPCError(workerrpc.JSONRPCApplication, workerrpc.KindUnauthorized, "Homebrew imports require a DM session.", false, nil)
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	switch request.Method {
	case MethodPrefix + "describe":
		if err := decodeEmpty(request.Params); err != nil {
			return nil, invalid("import adapter description request is invalid", nil)
		}
		return map[string]any{
			"contractVersion": "import-adapter-description.v1", "id": "dnd-homebrew",
			"label":       "D&D homebrew",
			"description": "Custom item sets and items as drafts; publish them from Homebrew to use them on character sheets.",
			"formats":     []string{Format},
		}, nil
	case MethodPrefix + "preview":
		var input struct {
			ContractVersion string          `json:"contractVersion"`
			Format          string          `json:"format"`
			Document        json.RawMessage `json:"document"`
		}
		if jsonexact.Decode(request.Params, &input) != nil || input.ContractVersion != "import-preview.v1" || input.Format != Format {
			return nil, invalid("homebrew preview request is invalid", nil)
		}
		return handler.preview(ctx, request.Meta, input.Document)
	case MethodPrefix + "commit":
		var input struct {
			ContractVersion string `json:"contractVersion"`
			Token           string `json:"token"`
		}
		if jsonexact.Decode(request.Params, &input) != nil || input.ContractVersion != "import-commit.v1" || input.Token == "" {
			return nil, invalid("homebrew commit request is invalid", nil)
		}
		if request.Meta.IdempotencyKey == "" {
			return nil, invalid("homebrew commit requires an idempotency key", nil)
		}
		return handler.commit(ctx, request.Meta, input.Token)
	default:
		return nil, workerrpc.NewRPCError(workerrpc.JSONRPCMethodNotFound, workerrpc.KindNotFound, "Import adapter method not found.", false, nil)
	}
}

// importPlan is a reviewed import: the summary shown to the DM and the exact
// mutations a commit submits.
type importPlan struct {
	Mode      string
	Summary   summary
	Changes   []change
	Warnings  []string
	Mutations []workerrpc.AddonDataMutation
}

func (handler *Handler) preview(ctx context.Context, meta *workerrpc.Meta, body json.RawMessage) (any, error) {
	current, err := handler.read(ctx, meta)
	if err != nil {
		return nil, err
	}
	plan, err := buildPlan(body, current, handler.now().UnixMilli())
	if err != nil {
		return nil, invalid("homebrew import document is invalid", map[string]any{"issue": err.Error()})
	}
	if err := handler.resolveTombstones(ctx, meta, plan.Mutations); err != nil {
		return nil, err
	}
	token, err := handler.storePlan(storedPlan{mutations: plan.Mutations, revisions: current.revisions, writes: plan.Summary.Creates + plan.Summary.Updates, deletes: plan.Summary.Deletes})
	if err != nil {
		return nil, unavailable("could not retain the reviewed import plan")
	}
	return map[string]any{"contractVersion": "import-preview-result.v1", "token": token, "format": Format, "mode": plan.Mode, "summary": plan.Summary, "warnings": plan.Warnings, "changes": plan.Changes}, nil
}

// buildPlan normalizes an import document against the stored drafts. A field
// an entry omits keeps its stored value, or takes its default for a new draft,
// so re-importing a card pack never resets the DM's visibility choices.
func buildPlan(body json.RawMessage, current drafts, now int64) (importPlan, error) {
	storedSets, storedItems := current.sets, current.items
	doc, err := decodeDocument(body)
	if err != nil {
		return importPlan{}, err
	}
	plan := importPlan{Mode: doc.Mode, Changes: []change{}, Warnings: []string{}, Mutations: []workerrpc.AddonDataMutation{}}
	finalSets := make(map[string]bool)
	if doc.Mode == "merge" {
		for id := range storedSets {
			finalSets[id] = true
		}
	}
	seen := make(map[string]bool)
	for index, raw := range doc.Sets {
		existing, exists := storedSets[idOf(raw)]
		normalized, err := normalize(raw, existing.body, exists, setKind, now)
		if err != nil {
			return importPlan{}, fmt.Errorf("sets[%d]: %w", index, err)
		}
		set, err := homebrew.DecodeSet(normalized)
		if err != nil {
			return importPlan{}, fmt.Errorf("sets[%d]: %w", index, err)
		}
		if seen["set:"+set.ID] {
			return importPlan{}, fmt.Errorf("sets[%d]: set %s appears twice", index, set.ID)
		}
		seen["set:"+set.ID] = true
		finalSets[set.ID] = true
		plan.add(homebrew.SetsCollection, set.ID, set.Name, normalized, existing, exists)
	}
	finalItems := make(map[string]homebrew.Item)
	if doc.Mode == "merge" {
		for id, item := range storedItems {
			decoded, err := homebrew.DecodeItem(item.body)
			if err != nil {
				return importPlan{}, fmt.Errorf("stored item %s is invalid: %w", id, err)
			}
			finalItems[id] = decoded
		}
	}
	for index, raw := range doc.Items {
		existing, exists := storedItems[idOf(raw)]
		normalized, err := normalize(raw, existing.body, exists, itemKind, now)
		if err != nil {
			return importPlan{}, fmt.Errorf("items[%d]: %w", index, err)
		}
		item, err := homebrew.DecodeItem(normalized)
		if err != nil {
			return importPlan{}, fmt.Errorf("items[%d]: %w", index, err)
		}
		if seen["item:"+item.ID] {
			return importPlan{}, fmt.Errorf("items[%d]: item %s appears twice", index, item.ID)
		}
		seen["item:"+item.ID] = true
		finalItems[item.ID] = item
		plan.add(homebrew.ItemsCollection, item.ID, item.Name, normalized, existing, exists)
	}
	itemIDs := make([]string, 0, len(finalItems))
	for id := range finalItems {
		itemIDs = append(itemIDs, id)
	}
	sort.Strings(itemIDs)
	for _, id := range itemIDs {
		if item := finalItems[id]; item.SetID != "" && !finalSets[item.SetID] {
			return importPlan{}, fmt.Errorf("item %s belongs to set %s, which the import neither contains nor keeps", id, item.SetID)
		}
	}
	for index, raw := range doc.Subclasses {
		existing, exists := current.subclasses[idOf(raw)]
		normalized, err := normalize(raw, existing.body, exists, subclassKind, now)
		if err != nil {
			return importPlan{}, fmt.Errorf("subclasses[%d]: %w", index, err)
		}
		subclass, err := homebrew.DecodeSubclass(normalized)
		if err != nil {
			return importPlan{}, fmt.Errorf("subclasses[%d]: %w", index, err)
		}
		if seen["subclass:"+subclass.ID] {
			return importPlan{}, fmt.Errorf("subclasses[%d]: subclass %s appears twice", index, subclass.ID)
		}
		seen["subclass:"+subclass.ID] = true
		plan.add(homebrew.SubclassesCollection, subclass.ID, subclass.Name, normalized, existing, exists)
	}
	if doc.Mode == "replace" {
		plan.deleteMissing(homebrew.SetsCollection, storedSets, seen, "set:")
		plan.deleteMissing(homebrew.ItemsCollection, storedItems, seen, "item:")
		plan.deleteMissing(homebrew.SubclassesCollection, current.subclasses, seen, "subclass:")
		if plan.Summary.Deletes > 0 {
			plan.Warnings = append(plan.Warnings, "Replacing removes drafts that are not in this file. Their published records stay on character sheets until the next publish, which removes them and blocks characters that still hold them.")
		}
	}
	if len(plan.Mutations) > maximumWrites {
		return importPlan{}, fmt.Errorf("the import changes %d drafts; split it into files of at most %d changes", len(plan.Mutations), maximumWrites)
	}
	if plan.Summary.Creates+plan.Summary.Updates > 0 {
		plan.Warnings = append(plan.Warnings, "Imports write drafts. Publish them from Homebrew to use them on character sheets.")
	}
	// Sets, their items, then subclasses; each collection by id.
	sort.Slice(plan.Changes, func(i, j int) bool {
		left, right := collectionOrder[plan.Changes[i].Collection], collectionOrder[plan.Changes[j].Collection]
		if left != right {
			return left < right
		}
		return plan.Changes[i].ID < plan.Changes[j].ID
	})
	return plan, nil
}

// Report is what a preview would show for a document: the mode, counts,
// warnings and every change, without the mutations behind them.
type Report struct {
	Mode     string   `json:"mode"`
	Summary  summary  `json:"summary"`
	Warnings []string `json:"warnings"`
	Changes  []change `json:"changes"`
}

// Check plans an import offline with the same rules as preview. current is an
// Export of the drafts the import will meet (the page's Export file), or nil
// for an empty campaign. Tombstones of deleted drafts are not known offline;
// the worker resolves them at preview.
func Check(document, current []byte, now int64) (Report, error) {
	drafts := noDrafts()
	if current != nil {
		export, err := decodeDocument(current)
		if err != nil {
			return Report{}, fmt.Errorf("the current export: %w", err)
		}
		for _, list := range []struct {
			raw    []json.RawMessage
			target map[string]stored
			label  string
		}{{export.Sets, drafts.sets, "sets"}, {export.Items, drafts.items, "items"}, {export.Subclasses, drafts.subclasses, "subclasses"}} {
			for index, raw := range list.raw {
				id := idOf(raw)
				if id == "" {
					return Report{}, fmt.Errorf("the current export: %s[%d] has no id", list.label, index)
				}
				list.target[id] = stored{body: raw, revision: 1}
			}
		}
	}
	plan, err := buildPlan(document, drafts, now)
	if err != nil {
		return Report{}, err
	}
	return Report{Mode: plan.Mode, Summary: plan.Summary, Warnings: plan.Warnings, Changes: plan.Changes}, nil
}

var collectionOrder = map[string]int{homebrew.SetsCollection: 0, homebrew.ItemsCollection: 1, homebrew.SubclassesCollection: 2}

func (plan *importPlan) add(collection, id, name string, normalized json.RawMessage, existing stored, exists bool) {
	if exists && equivalent(existing.body, normalized) {
		plan.Summary.Skips++
		return
	}
	operation, revision := "create", int64(0)
	if exists {
		operation, revision = "update", existing.revision
		plan.Summary.Updates++
	} else {
		plan.Summary.Creates++
	}
	plan.Mutations = append(plan.Mutations, workerrpc.AddonDataMutation{Operation: "put", Reference: reference(collection), Key: id, ExpectedRevision: revision, Value: normalized})
	plan.Changes = append(plan.Changes, change{collection, id, operation, name})
}

func (plan *importPlan) deleteMissing(collection string, documents map[string]stored, seen map[string]bool, prefix string) {
	ids := make([]string, 0, len(documents))
	for id := range documents {
		if !seen[prefix+id] {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	for _, id := range ids {
		var named struct {
			Name string `json:"name"`
		}
		_ = json.Unmarshal(documents[id].body, &named)
		plan.Mutations = append(plan.Mutations, workerrpc.AddonDataMutation{Operation: "delete", Reference: reference(collection), Key: id, ExpectedRevision: documents[id].revision})
		plan.Changes = append(plan.Changes, change{collection, id, "delete", firstNonEmpty(named.Name, id)})
		plan.Summary.Deletes++
	}
}

func decodeDocument(body json.RawMessage) (document, error) {
	var doc document
	if err := jsonexact.Decode(body, &doc); err != nil {
		return document{}, fmt.Errorf("the document must be one JSON object with format, schemaVersion, sets and items: %w", err)
	}
	var raw map[string]json.RawMessage
	_ = json.Unmarshal(body, &raw)
	for _, field := range []string{"format", "schemaVersion", "sets", "items"} {
		if _, exists := raw[field]; !exists {
			return document{}, fmt.Errorf("missing document field %q", field)
		}
	}
	if doc.Format != Format || doc.SchemaVersion != homebrew.SchemaVersion {
		return document{}, fmt.Errorf(`format must be %q with schemaVersion 1`, Format)
	}
	if doc.Mode == "" {
		doc.Mode = "merge"
	}
	if doc.Mode != "merge" && doc.Mode != "replace" {
		return document{}, errors.New("mode must be merge or replace")
	}
	if len(doc.Sets)+len(doc.Items)+len(doc.Subclasses) > 2000 {
		return document{}, errors.New("an import holds at most 2000 sets, items and subclasses")
	}
	return doc, nil
}

// normalize overlays an entry's fields on the stored draft (or the defaults)
// and stamps schemaVersion and updatedAt.
func normalize(raw, existing json.RawMessage, exists bool, kind draftKind, now int64) (json.RawMessage, error) {
	var entry map[string]json.RawMessage
	if jsonexact.Decode(raw, &entry) != nil {
		return nil, errors.New("entry must be a JSON object")
	}
	if version, present := entry["schemaVersion"]; present && string(version) != "1" {
		return nil, errors.New("schemaVersion must be 1")
	}
	fields := make(map[string]json.RawMessage)
	if exists {
		if err := json.Unmarshal(existing, &fields); err != nil {
			return nil, errors.New("the stored draft is unreadable")
		}
	} else {
		for key, value := range kind.defaults {
			fields[key] = value
		}
	}
	for key, value := range entry {
		fields[key] = value
	}
	// An empty object clears an optional field, as [] clears a list.
	for _, field := range kind.optional {
		var cleared map[string]json.RawMessage
		if value, present := entry[field]; present && json.Unmarshal(value, &cleared) == nil && cleared != nil && len(cleared) == 0 {
			delete(fields, field)
			delete(fields, kind.partner[field])
		}
	}
	if _, present := entry["characterMechanics"]; !present && kind.item {
		mechanics := `"narrative"`
		var effects []json.RawMessage
		_, hasGrants := fields["grants"]
		if json.Unmarshal(fields["characterEffects"], &effects) == nil && len(effects) > 0 || hasGrants {
			mechanics = `"complete"`
		}
		fields["characterMechanics"] = json.RawMessage(mechanics)
	}
	fields["schemaVersion"] = json.RawMessage(`1`)
	fields["updatedAt"] = json.RawMessage(fmt.Sprintf("%d", now))
	return json.Marshal(fields)
}

func idOf(raw json.RawMessage) string {
	var entry struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(raw, &entry)
	return entry.ID
}

// resolveTombstones makes a create expect the revision a deleted draft left
// behind; revisions never restart, so recreating at zero would conflict.
func (handler *Handler) resolveTombstones(ctx context.Context, meta *workerrpc.Meta, mutations []workerrpc.AddonDataMutation) error {
	for index, mutation := range mutations {
		if mutation.Operation != "put" || mutation.ExpectedRevision != 0 {
			continue
		}
		_, err := handler.data.Get(ctx, meta, mutation.Reference, mutation.Key)
		if err == nil {
			return invalid("homebrew drafts changed while previewing; preview again", nil)
		}
		if revision, deleted := workerrpc.DeletedRevision(err); deleted {
			mutations[index].ExpectedRevision = revision
			continue
		}
		var failure *workerrpc.RPCError
		if !errors.As(err, &failure) || failure.Data == nil || failure.Data.Kind != workerrpc.KindNotFound {
			return err
		}
	}
	return nil
}

func (handler *Handler) commit(ctx context.Context, meta *workerrpc.Meta, token string) (any, error) {
	handler.mu.Lock()
	handler.purgeExpiredLocked()
	plan, exists := handler.plans[token]
	if exists {
		delete(handler.plans, token)
	}
	handler.mu.Unlock()
	if !exists {
		return nil, workerrpc.NewRPCError(workerrpc.JSONRPCApplication, workerrpc.KindNotFound, "The reviewed import plan is missing or expired.", false, nil)
	}
	if len(plan.mutations) > 0 {
		if _, err := handler.data.TransactGuarded(ctx, meta, plan.mutations, plan.revisions); err != nil {
			return nil, err
		}
	}
	return map[string]any{"contractVersion": "import-commit-result.v1", "committed": true, "writes": plan.writes, "deletes": plan.deletes}, nil
}

func (handler *Handler) read(ctx context.Context, meta *workerrpc.Meta) (drafts, error) {
	current := noDrafts()
	for _, source := range []struct {
		collection string
		target     map[string]stored
	}{{homebrew.SetsCollection, current.sets}, {homebrew.ItemsCollection, current.items}, {homebrew.SubclassesCollection, current.subclasses}} {
		collection, target := source.collection, source.target
		cursor := ""
		var revision *int64
		for {
			page, err := handler.data.Query(ctx, meta, workerrpc.AddonDataQuery{Reference: reference(collection), Cursor: cursor, Limit: 200, IncludeDataRevision: true, ExpectedDataRevision: revision})
			if err != nil {
				return drafts{}, err
			}
			if page.DataRevision == nil || revision != nil && *revision != *page.DataRevision {
				return drafts{}, invalid("homebrew drafts changed while reading; preview again", nil)
			}
			revision = page.DataRevision
			for _, document := range page.Documents {
				target[document.Key] = stored{body: document.Value, revision: document.Revision}
			}
			if page.NextCursor == "" {
				break
			}
			cursor = page.NextCursor
		}
		current.revisions = append(current.revisions, workerrpc.AddonDataSetRevision{Kind: workerrpc.AddonDataCollection, DataID: collection, Revision: *revision})
	}
	return current, nil
}

func equivalent(left, right json.RawMessage) bool {
	var a, b map[string]any
	if json.Unmarshal(left, &a) != nil || json.Unmarshal(right, &b) != nil {
		return false
	}
	delete(a, "updatedAt")
	delete(b, "updatedAt")
	leftBody, _ := json.Marshal(a)
	rightBody, _ := json.Marshal(b)
	return bytes.Equal(leftBody, rightBody)
}

func (handler *Handler) storePlan(plan storedPlan) (string, error) {
	tokenBytes := make([]byte, 24)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(tokenBytes)
	handler.mu.Lock()
	defer handler.mu.Unlock()
	handler.purgeExpiredLocked()
	if len(handler.plans) >= maximumPlans {
		return "", errors.New("too many pending plans")
	}
	plan.expires = handler.now().Add(planLifetime)
	handler.plans[token] = plan
	return token, nil
}

func (handler *Handler) purgeExpiredLocked() {
	now := handler.now()
	for token, plan := range handler.plans {
		if !plan.expires.After(now) {
			delete(handler.plans, token)
		}
	}
}

func reference(collection string) workerrpc.AddonDataReference {
	return workerrpc.AddonDataReference{Kind: workerrpc.AddonDataCollection, DataID: collection}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func invalid(message string, details any) error {
	return workerrpc.NewRPCError(workerrpc.JSONRPCInvalidParams, workerrpc.KindValidationFailed, message, false, details)
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
