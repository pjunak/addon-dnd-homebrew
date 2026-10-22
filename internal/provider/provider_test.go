package provider

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/pjunak/addon-dnd-homebrew/internal/homebrew"
	"github.com/pjunak/ttrpg-codex/sdk/go/workerrpc"
)

type storedDocument struct {
	revision int64
	value    json.RawMessage
}

// fakeData pages like the host: sorted keys and base64 decimal-offset cursors.
type fakeData struct {
	mu          sync.Mutex
	collections map[string]map[string]storedDocument
	queries     int
	actors      []string
	onQuery     func(*fakeData)
}

func newFakeData() *fakeData {
	return &fakeData{collections: map[string]map[string]storedDocument{}}
}

func (data *fakeData) put(collection, key string, value json.RawMessage) {
	if data.collections[collection] == nil {
		data.collections[collection] = map[string]storedDocument{}
	}
	current := data.collections[collection][key]
	data.collections[collection][key] = storedDocument{revision: current.revision + 1, value: value}
}

func (data *fakeData) Get(_ context.Context, meta *workerrpc.Meta, reference workerrpc.AddonDataReference, key string) (workerrpc.AddonDataDocument, error) {
	data.mu.Lock()
	defer data.mu.Unlock()
	data.record(meta)
	document, exists := data.collections[reference.DataID][key]
	if !exists {
		return workerrpc.AddonDataDocument{}, workerrpc.NewRPCError(workerrpc.JSONRPCApplication, workerrpc.KindNotFound, "missing", false, nil)
	}
	return workerrpc.AddonDataDocument{Key: key, Revision: document.revision, Value: document.value}, nil
}

func (data *fakeData) Query(_ context.Context, meta *workerrpc.Meta, query workerrpc.AddonDataQuery) (workerrpc.AddonDataQueryResult, error) {
	data.mu.Lock()
	data.record(meta)
	data.queries++
	hook := data.onQuery
	data.onQuery = nil
	data.mu.Unlock()
	if hook != nil {
		hook(data)
	}
	data.mu.Lock()
	defer data.mu.Unlock()
	keys := make([]string, 0)
	for key := range data.collections[query.Reference.DataID] {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	start := 0
	if query.Cursor != "" {
		body, _ := base64.RawURLEncoding.DecodeString(query.Cursor)
		start, _ = strconv.Atoi(string(body))
	}
	end := min(start+query.Limit, len(keys))
	result := workerrpc.AddonDataQueryResult{}
	for _, key := range keys[start:end] {
		document := data.collections[query.Reference.DataID][key]
		result.Documents = append(result.Documents, workerrpc.AddonDataDocument{Key: key, Revision: document.revision, Value: document.value})
	}
	if end < len(keys) {
		result.NextCursor = base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(end)))
	}
	return result, nil
}

func (data *fakeData) record(meta *workerrpc.Meta) {
	if meta != nil && meta.Actor != nil {
		data.actors = append(data.actors, meta.Actor.Role)
	}
}

func fixtureRecords(t *testing.T) []json.RawMessage {
	t.Helper()
	body, err := os.ReadFile("../../tests/fixtures/publish.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			Published json.RawMessage `json:"published"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	records := make([]json.RawMessage, 0, len(fixture.Cases))
	for _, testCase := range fixture.Cases {
		records = append(records, testCase.Published)
	}
	return records
}

func publish(t *testing.T, data *fakeData, records []json.RawMessage) {
	t.Helper()
	for _, record := range records {
		var identity struct {
			ID string `json:"id"`
		}
		if err := json.Unmarshal(record, &identity); err != nil {
			t.Fatal(err)
		}
		data.put(homebrew.PublishedCollection, identity.ID, record)
	}
	data.put(homebrew.MetaCollection, homebrew.MetaKey, json.RawMessage(`{"schemaVersion":1,"revision":1,"publishedAt":1,"recordCount":`+strconv.Itoa(len(records))+`}`))
}

var player = &workerrpc.Meta{Actor: &workerrpc.Actor{Role: "player"}}

func call(t *testing.T, handler *Handler, method string, params string) map[string]any {
	t.Helper()
	result, err := handler.HandleRPC(context.Background(), workerrpc.Request{Method: MethodPrefix + method, Params: json.RawMessage(params), Meta: player})
	if err != nil {
		t.Fatalf("%s %s: %v", method, params, err)
	}
	body, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(body, &decoded); err != nil {
		t.Fatal(err)
	}
	return decoded
}

func callError(t *testing.T, handler *Handler, method string, params string) *workerrpc.RPCError {
	t.Helper()
	_, err := handler.HandleRPC(context.Background(), workerrpc.Request{Method: MethodPrefix + method, Params: json.RawMessage(params), Meta: player})
	var failure *workerrpc.RPCError
	if !errors.As(err, &failure) || failure.Data == nil {
		t.Fatalf("%s %s: expected an RPC error, got %v", method, params, err)
	}
	return failure
}

func catalogSet(t *testing.T, handler *Handler) map[string]any {
	t.Helper()
	catalog := call(t, handler, "catalog", `{}`)
	if catalog["contractVersion"] != "content-catalog.v1" {
		t.Fatalf("catalog %v", catalog)
	}
	sets := catalog["sets"].([]any)
	if len(sets) != 1 {
		t.Fatalf("sets %v", sets)
	}
	return sets[0].(map[string]any)
}

// The Engine's provider client rejects a catalog unless the digest is 64
// lowercase hex characters and the kind counts sum to the record count.
func assertEngineCatalog(t *testing.T, set map[string]any) {
	t.Helper()
	digest, _ := set["schemaSha256"].(string)
	if len(digest) != 64 || strings.Trim(digest, "0123456789abcdef") != "" {
		t.Fatalf("digest %q", digest)
	}
	total := 0
	for _, count := range set["kinds"].(map[string]any) {
		if count.(float64) < 1 {
			t.Fatalf("kind count %v", count)
		}
		total += int(count.(float64))
	}
	if total != int(set["recordCount"].(float64)) || set["id"] != SetID || set["revision"] == "" {
		t.Fatalf("catalog set %v", set)
	}
}

func TestEmptyBeforeFirstPublish(t *testing.T) {
	data := newFakeData()
	handler, err := New(data, nil)
	if err != nil {
		t.Fatal(err)
	}
	set := catalogSet(t, handler)
	assertEngineCatalog(t, set)
	if set["recordCount"].(float64) != 0 || !strings.HasPrefix(set["revision"].(string), "0-") {
		t.Fatalf("empty catalog %v", set)
	}
	page := call(t, handler, "query", `{"setId":"rules","kind":"magic-item","limit":200}`)
	if len(page["records"].([]any)) != 0 || page["nextCursor"] != nil {
		t.Fatalf("empty query %v", page)
	}
	if data.queries != 0 {
		t.Fatal("an unpublished add-on should not scan records")
	}
}

func TestServesPublishedRecordsLikeTheEngineExpects(t *testing.T) {
	data := newFakeData()
	publish(t, data, fixtureRecords(t))
	handler, _ := New(data, nil)
	set := catalogSet(t, handler)
	assertEngineCatalog(t, set)
	if set["kinds"].(map[string]any)["magic-item"].(float64) != 6 {
		t.Fatalf("kinds %v", set["kinds"])
	}
	revision := set["revision"].(string)

	seen := []string{}
	cursor := ""
	for range 10 {
		params := `{"setId":"rules","kind":"magic-item","limit":1}`
		if cursor != "" {
			params = `{"setId":"rules","kind":"magic-item","limit":1,"cursor":"` + cursor + `"}`
		}
		page := call(t, handler, "query", params)
		if page["contractVersion"] != "content-query-result.v1" || page["setId"] != SetID || page["revision"] != revision {
			t.Fatalf("page %v", page)
		}
		for _, raw := range page["records"].([]any) {
			record := raw.(map[string]any)
			value := record["value"].(map[string]any)
			if record["kind"] != "magic-item" || value["kind"] != "magic-item" || value["id"] != record["id"] || value["name"] == "" {
				t.Fatalf("record %v", record)
			}
			seen = append(seen, record["id"].(string))
		}
		next, _ := page["nextCursor"].(string)
		if next == "" {
			break
		}
		if len(next) > 32 {
			t.Fatalf("cursor %q exceeds the Engine's 32-character limit", next)
		}
		cursor = next
	}
	if strings.Join(seen, ",") != "hb.defense,hb.destiny,hb.edge,hb.lantern,hb.ring-of-wit,hb.trinket" {
		t.Fatalf("records %v", seen)
	}

	got := call(t, handler, "get", `{"setId":"rules","kind":"magic-item","id":"hb.defense"}`)
	value := got["record"].(map[string]any)["value"].(map[string]any)
	if got["contractVersion"] != "content-record.v1" || value["name"] != "Cursed Card: Defense" || value["characterMechanics"] != "complete" {
		t.Fatalf("get %v", got)
	}
	for _, params := range []string{
		`{"setId":"rules","kind":"magic-item","id":"hb.missing"}`,
		`{"setId":"rules","kind":"spell","id":"hb.defense"}`,
	} {
		if failure := callError(t, handler, "get", params); failure.Data.Kind != workerrpc.KindNotFound {
			t.Fatalf("%s: %v", params, failure)
		}
	}
	other := call(t, handler, "query", `{"setId":"rules","kind":"ruleset","limit":20}`)
	if len(other["records"].([]any)) != 0 {
		t.Fatalf("a homebrew provider must never publish a ruleset: %v", other)
	}
	for _, role := range data.actors {
		if role != "player" {
			t.Fatalf("reads used %q authority instead of the caller's", role)
		}
	}
}

func TestInvalidDocumentsAreSkipped(t *testing.T) {
	data := newFakeData()
	records := fixtureRecords(t)
	broken := bytes.Replace(records[0], []byte(`"armorClass"`), []byte(`"attackBonus"`), 1)
	foreign := json.RawMessage(strings.ReplaceAll(string(records[3]), "hb.trinket", "trinket"))
	publish(t, data, []json.RawMessage{broken, records[1], records[2]})
	data.put(homebrew.PublishedCollection, "trinket", foreign)
	var log bytes.Buffer
	handler, _ := New(data, &log)
	set := catalogSet(t, handler)
	assertEngineCatalog(t, set)
	if set["recordCount"].(float64) != 2 {
		t.Fatalf("served %v records", set["recordCount"])
	}
	if !strings.Contains(log.String(), "hb.defense") || !strings.Contains(log.String(), "trinket") {
		t.Fatalf("diagnostics %q", log.String())
	}
}

func TestCachesUntilRepublished(t *testing.T) {
	data := newFakeData()
	records := fixtureRecords(t)
	publish(t, data, records[:2])
	handler, _ := New(data, nil)
	first := catalogSet(t, handler)["revision"].(string)
	scans := data.queries
	if again := catalogSet(t, handler)["revision"].(string); again != first || data.queries != scans {
		t.Fatalf("an unchanged publish was rescanned (%d -> %d queries)", scans, data.queries)
	}
	page := call(t, handler, "query", `{"setId":"rules","kind":"magic-item","limit":1}`)
	staleCursor := page["nextCursor"].(string)

	publish(t, data, records[2:])
	second := catalogSet(t, handler)
	if second["revision"] == first || second["recordCount"].(float64) != 6 {
		t.Fatalf("republish not observed: %v", second)
	}
	failure := callError(t, handler, "query", `{"setId":"rules","kind":"magic-item","limit":1,"cursor":"`+staleCursor+`"}`)
	if failure.Data.Kind != workerrpc.KindInvalidRequest {
		t.Fatalf("stale cursor: %v", failure)
	}
}

func TestRepublishDuringScanIsRetried(t *testing.T) {
	data := newFakeData()
	records := fixtureRecords(t)
	publish(t, data, records[:1])
	data.onQuery = func(data *fakeData) {
		data.mu.Lock()
		defer data.mu.Unlock()
		publishLocked(data, records[1:])
	}
	handler, _ := New(data, nil)
	set := catalogSet(t, handler)
	if set["recordCount"].(float64) != 6 {
		t.Fatalf("a scan racing a publish must settle on the later publish: %v", set)
	}
}

func publishLocked(data *fakeData, records []json.RawMessage) {
	for _, record := range records {
		var identity struct {
			ID string `json:"id"`
		}
		_ = json.Unmarshal(record, &identity)
		data.put(homebrew.PublishedCollection, identity.ID, record)
	}
	data.put(homebrew.MetaCollection, homebrew.MetaKey, json.RawMessage(`{"schemaVersion":1,"revision":2,"publishedAt":2,"recordCount":6}`))
}

func TestRejectsMalformedRequests(t *testing.T) {
	handler, _ := New(newFakeData(), nil)
	for method, params := range map[string]string{
		"catalog": `{"setId":"rules"}`,
		"get":     `{"setId":"other","kind":"magic-item","id":"hb.x"}`,
		"query":   `{"setId":"rules","limit":201}`,
	} {
		if failure := callError(t, handler, method, params); failure.Data.Kind != workerrpc.KindInvalidRequest {
			t.Fatalf("%s: %v", method, failure)
		}
	}
	if failure := callError(t, handler, "query", `{"setId":"rules","cursor":"not-a-cursor"}`); failure.Data.Kind != workerrpc.KindInvalidRequest {
		t.Fatalf("cursor: %v", failure)
	}
	if failure := callError(t, handler, "describe", `{}`); failure.Data.Kind != workerrpc.KindNotFound {
		t.Fatalf("unknown method: %v", failure)
	}
}

func TestWithdrawnRecordsAreNotServed(t *testing.T) {
	data := newFakeData()
	records := fixtureRecords(t)
	withdrawn := json.RawMessage(strings.Replace(string(records[0]), `"withdrawn": false`, `"withdrawn": true`, 1))
	if string(withdrawn) == string(records[0]) {
		t.Fatal("fixture has no withdrawn flag")
	}
	publish(t, data, append([]json.RawMessage{withdrawn}, records[1:]...))
	var log bytes.Buffer
	handler, _ := New(data, &log)
	if count := catalogSet(t, handler)["recordCount"].(float64); count != 5 {
		t.Fatalf("served %v records", count)
	}
	if failure := callError(t, handler, "get", `{"setId":"rules","kind":"magic-item","id":"hb.defense"}`); failure.Data.Kind != workerrpc.KindNotFound {
		t.Fatalf("withdrawn record served: %v", failure)
	}
	if log.Len() != 0 {
		t.Fatalf("a withdrawn record is not a problem: %q", log.String())
	}
}

func fixtureSubclass(t *testing.T) json.RawMessage {
	t.Helper()
	body, err := os.ReadFile("../../tests/fixtures/subclasses.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Published json.RawMessage `json:"published"`
	}
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	return fixture.Published
}

func TestServesSubclassesWithTheirFeatures(t *testing.T) {
	data := newFakeData()
	subclass := fixtureSubclass(t)
	broken := json.RawMessage(strings.Replace(string(subclass), `"resistances": ["thunder"]`, `"teleport": 30`, 1))
	broken = json.RawMessage(strings.ReplaceAll(string(broken), "storm-drum", "broken-drum"))
	withdrawn := json.RawMessage(strings.Replace(strings.ReplaceAll(string(subclass), "storm-drum", "old-drum"), `"withdrawn": false`, `"withdrawn": true`, 1))
	publish(t, data, fixtureRecords(t)[:1])
	data.put(homebrew.PublishedSubclassesCollection, "hb.storm-drum", subclass)
	data.put(homebrew.PublishedSubclassesCollection, "hb.broken-drum", broken)
	data.put(homebrew.PublishedSubclassesCollection, "hb.old-drum", withdrawn)
	var log bytes.Buffer
	handler, _ := New(data, &log)
	set := catalogSet(t, handler)
	assertEngineCatalog(t, set)
	kinds := set["kinds"].(map[string]any)
	if kinds["magic-item"].(float64) != 1 || kinds["subclass"].(float64) != 1 || kinds["feature"].(float64) != 4 {
		t.Fatalf("kinds %v", kinds)
	}
	if !strings.Contains(log.String(), "hb.broken-drum") {
		t.Fatalf("an invalid subclass must be reported: %q", log.String())
	}
	features := call(t, handler, "query", `{"setId":"rules","kind":"feature","limit":200}`)["records"].([]any)
	ids := []string{}
	for _, raw := range features {
		record := raw.(map[string]any)
		if record["kind"] != "feature" || record["value"].(map[string]any)["subclassId"] != "hb.storm-drum" {
			t.Fatalf("feature %v", record)
		}
		ids = append(ids, record["id"].(string))
	}
	if strings.Join(ids, ",") != "hb.storm-drum.rolling-thunder,hb.storm-drum.storm-voice,hb.storm-drum.thunder-ward,hb.storm-drum.war-drum" {
		t.Fatalf("features %v", ids)
	}
	got := call(t, handler, "get", `{"setId":"rules","kind":"subclass","id":"hb.storm-drum"}`)["record"].(map[string]any)
	if got["value"].(map[string]any)["classId"] != "barbarian" {
		t.Fatalf("subclass %v", got)
	}
	if failure := callError(t, handler, "get", `{"setId":"rules","kind":"magic-item","id":"hb.storm-drum"}`); failure.Data.Kind != workerrpc.KindNotFound {
		t.Fatalf("a subclass id is not an item: %v", failure)
	}
}
