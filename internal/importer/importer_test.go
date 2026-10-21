package importer

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pjunak/addon-dnd-homebrew/internal/homebrew"
	"github.com/pjunak/ttrpg-codex/sdk/go/workerrpc"
)

type importFixture struct {
	Now    int64 `json:"now"`
	Stored struct {
		Classes []json.RawMessage `json:"classes"`
		Items   []json.RawMessage `json:"items"`
	} `json:"stored"`
	Cases []struct {
		Name          string                    `json:"name"`
		Document      json.RawMessage           `json:"document"`
		Summary       *summary                  `json:"summary"`
		Changes       [][3]string               `json:"changes"`
		Values        map[string]map[string]any `json:"values"`
		ErrorIncludes string                    `json:"errorIncludes"`
	} `json:"cases"`
}

func loadImportFixture(t *testing.T) importFixture {
	t.Helper()
	body, err := os.ReadFile("../../tests/fixtures/imports.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture importFixture
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	return fixture
}

func storedMap(t *testing.T, documents []json.RawMessage) map[string]stored {
	t.Helper()
	result := map[string]stored{}
	for _, document := range documents {
		result[idOf(document)] = stored{body: document, revision: 4}
	}
	return result
}

func TestPlansMatchSharedFixture(t *testing.T) {
	fixture := loadImportFixture(t)
	for _, testCase := range fixture.Cases {
		t.Run(testCase.Name, func(t *testing.T) {
			plan, err := buildPlan(testCase.Document, storedMap(t, fixture.Stored.Classes), storedMap(t, fixture.Stored.Items), fixture.Now)
			if testCase.ErrorIncludes != "" {
				if err == nil || !strings.Contains(err.Error(), testCase.ErrorIncludes) {
					t.Fatalf("expected an error mentioning %q, got %v", testCase.ErrorIncludes, err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if plan.Summary != *testCase.Summary {
				t.Fatalf("summary %+v, want %+v", plan.Summary, *testCase.Summary)
			}
			changes := [][3]string{}
			for _, change := range plan.Changes {
				changes = append(changes, [3]string{change.Collection, change.ID, change.Operation})
			}
			if !reflect.DeepEqual(changes, append([][3]string{}, testCase.Changes...)) {
				t.Fatalf("changes %v, want %v", changes, testCase.Changes)
			}
			for path, expected := range testCase.Values {
				collection, key, _ := strings.Cut(path, "/")
				value := mutationValue(t, plan, collection, key)
				for field, want := range expected {
					if !reflect.DeepEqual(value[field], want) {
						t.Fatalf("%s.%s = %#v, want %#v", path, field, value[field], want)
					}
				}
			}
			for _, mutation := range plan.Mutations {
				if mutation.Operation != "put" {
					continue
				}
				body := mutation.Value.(json.RawMessage)
				var err error
				if mutation.Reference.DataID == homebrew.ClassesCollection {
					_, err = homebrew.DecodeClass(body)
				} else {
					_, err = homebrew.DecodeItem(body)
				}
				if err != nil {
					t.Fatalf("planned %s/%s is not a valid draft: %v", mutation.Reference.DataID, mutation.Key, err)
				}
				if mutation.ExpectedRevision != 0 && mutation.ExpectedRevision != 4 {
					t.Fatalf("expected revision %d", mutation.ExpectedRevision)
				}
			}
		})
	}
}

func mutationValue(t *testing.T, plan importPlan, collection, key string) map[string]any {
	t.Helper()
	for _, mutation := range plan.Mutations {
		if mutation.Reference.DataID == collection && mutation.Key == key {
			var value map[string]any
			if err := json.Unmarshal(mutation.Value.(json.RawMessage), &value); err != nil {
				t.Fatal(err)
			}
			return value
		}
	}
	t.Fatalf("no mutation for %s/%s", collection, key)
	return nil
}

func TestSampleExampleImports(t *testing.T) {
	body, err := os.ReadFile("../../docs/examples/sample-items.json")
	if err != nil {
		t.Fatal(err)
	}
	plan, err := buildPlan(body, map[string]stored{}, map[string]stored{}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if plan.Summary.Creates != 13 || len(plan.Mutations) != 13 {
		t.Fatalf("summary %+v", plan.Summary)
	}
	complete, granted := 0, 0
	for _, mutation := range plan.Mutations {
		if mutation.Reference.DataID != homebrew.ItemsCollection {
			class, err := homebrew.DecodeClass(mutation.Value.(json.RawMessage))
			if err != nil {
				t.Fatal(err)
			}
			if class.Condition == nil || class.Condition.ID != "rune-bound" {
				t.Fatalf("class condition %+v", class.Condition)
			}
			continue
		}
		item, err := homebrew.DecodeItem(mutation.Value.(json.RawMessage))
		if err != nil {
			t.Fatal(err)
		}
		if item.CharacterMechanics == "complete" {
			complete++
		}
		if item.Grants != nil {
			granted++
		}
	}
	if complete != 11 || granted != 7 {
		t.Fatalf("%d automated items and %d with grants, want 11 and 7", complete, granted)
	}
}

type fakeStore struct {
	mu          sync.Mutex
	collections map[string]map[string]workerrpc.AddonDataDocument
	tombstones  map[string]int64
	revisions   map[string]int64
	commits     int
}

func newFakeStore() *fakeStore {
	return &fakeStore{collections: map[string]map[string]workerrpc.AddonDataDocument{}, tombstones: map[string]int64{}, revisions: map[string]int64{}}
}

func (store *fakeStore) Get(_ context.Context, _ *workerrpc.Meta, reference workerrpc.AddonDataReference, key string) (workerrpc.AddonDataDocument, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	if document, exists := store.collections[reference.DataID][key]; exists {
		return document, nil
	}
	details := any(nil)
	if revision, deleted := store.tombstones[reference.DataID+"/"+key]; deleted {
		details = map[string]any{"deletedRevision": revision}
	}
	return workerrpc.AddonDataDocument{}, workerrpc.NewRPCError(workerrpc.JSONRPCApplication, workerrpc.KindNotFound, "missing", false, details)
}

func (store *fakeStore) Query(_ context.Context, _ *workerrpc.Meta, query workerrpc.AddonDataQuery) (workerrpc.AddonDataQueryResult, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	revision := store.revisions[query.Reference.DataID]
	result := workerrpc.AddonDataQueryResult{DataRevision: &revision}
	for _, document := range store.collections[query.Reference.DataID] {
		result.Documents = append(result.Documents, document)
	}
	return result, nil
}

func (store *fakeStore) TransactGuarded(_ context.Context, _ *workerrpc.Meta, mutations []workerrpc.AddonDataMutation, expected []workerrpc.AddonDataSetRevision) (workerrpc.AddonDataCommit, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, guard := range expected {
		if store.revisions[guard.DataID] != guard.Revision {
			return workerrpc.AddonDataCommit{}, workerrpc.NewRPCError(workerrpc.JSONRPCApplication, workerrpc.KindConflict, "stale", false, nil)
		}
	}
	for _, mutation := range mutations {
		collection := mutation.Reference.DataID
		if store.collections[collection] == nil {
			store.collections[collection] = map[string]workerrpc.AddonDataDocument{}
		}
		current, exists := store.collections[collection][mutation.Key]
		if !exists {
			current.Revision = store.tombstones[collection+"/"+mutation.Key]
		}
		if current.Revision != mutation.ExpectedRevision {
			return workerrpc.AddonDataCommit{}, workerrpc.NewRPCError(workerrpc.JSONRPCApplication, workerrpc.KindConflict, "stale document", false, nil)
		}
	}
	for _, mutation := range mutations {
		collection := mutation.Reference.DataID
		store.revisions[collection]++
		if mutation.Operation == "delete" {
			delete(store.collections[collection], mutation.Key)
			store.tombstones[collection+"/"+mutation.Key] = mutation.ExpectedRevision + 1
			continue
		}
		body, _ := json.Marshal(mutation.Value)
		store.collections[collection][mutation.Key] = workerrpc.AddonDataDocument{Key: mutation.Key, Revision: mutation.ExpectedRevision + 1, Value: body}
	}
	store.commits++
	return workerrpc.AddonDataCommit{}, nil
}

var dm = &workerrpc.Meta{Actor: &workerrpc.Actor{Role: "dm"}, IdempotencyKey: "key-1"}

func handle(t *testing.T, handler *Handler, meta *workerrpc.Meta, method string, params any) (map[string]any, error) {
	t.Helper()
	body, _ := json.Marshal(params)
	result, err := handler.HandleRPC(context.Background(), workerrpc.Request{Method: MethodPrefix + method, Params: body, Meta: meta})
	if err != nil {
		return nil, err
	}
	encoded, _ := json.Marshal(result)
	var decoded map[string]any
	_ = json.Unmarshal(encoded, &decoded)
	return decoded, nil
}

func kindOf(err error) string {
	var failure *workerrpc.RPCError
	if errors.As(err, &failure) && failure.Data != nil {
		return failure.Data.Kind
	}
	return ""
}

func TestPreviewCommitRoundTrip(t *testing.T) {
	store := newFakeStore()
	handler, _ := New(store)
	described, err := handle(t, handler, dm, "describe", map[string]any{})
	if err != nil || described["formats"].([]any)[0] != Format {
		t.Fatalf("describe %v %v", described, err)
	}
	document := json.RawMessage(`{"format":"dnd-homebrew-items","schemaVersion":1,"classes":[{"id":"omens","name":"Omens","itemType":"Wondrous Item","rarity":"Rare"}],"items":[{"id":"destiny","classId":"omens","name":"Destiny"}]}`)
	preview, err := handle(t, handler, dm, "preview", map[string]any{"contractVersion": "import-preview.v1", "format": Format, "document": document})
	if err != nil {
		t.Fatal(err)
	}
	if preview["contractVersion"] != "import-preview-result.v1" || preview["summary"].(map[string]any)["creates"].(float64) != 2 {
		t.Fatalf("preview %v", preview)
	}
	token := preview["token"].(string)
	commitMeta := &workerrpc.Meta{Actor: dm.Actor}
	if _, err := handle(t, handler, commitMeta, "commit", map[string]any{"contractVersion": "import-commit.v1", "token": token}); kindOf(err) != workerrpc.KindValidationFailed {
		t.Fatalf("commit without an idempotency key: %v", err)
	}
	committed, err := handle(t, handler, dm, "commit", map[string]any{"contractVersion": "import-commit.v1", "token": token})
	if err != nil || committed["writes"].(float64) != 2 || store.commits != 1 {
		t.Fatalf("commit %v %v", committed, err)
	}
	if _, err := handle(t, handler, dm, "commit", map[string]any{"contractVersion": "import-commit.v1", "token": token}); kindOf(err) != workerrpc.KindNotFound {
		t.Fatalf("a token is single-use: %v", err)
	}
	again, err := handle(t, handler, dm, "preview", map[string]any{"contractVersion": "import-preview.v1", "format": Format, "document": document})
	if err != nil || again["summary"].(map[string]any)["skips"].(float64) != 2 {
		t.Fatalf("re-preview %v %v", again, err)
	}
}

func TestReplaceThenRecreateUsesTombstones(t *testing.T) {
	store := newFakeStore()
	handler, _ := New(store)
	run := func(document string) {
		t.Helper()
		preview, err := handle(t, handler, dm, "preview", map[string]any{"contractVersion": "import-preview.v1", "format": Format, "document": json.RawMessage(document)})
		if err != nil {
			t.Fatal(err)
		}
		meta := &workerrpc.Meta{Actor: dm.Actor, IdempotencyKey: preview["token"].(string)[:10]}
		if _, err := handle(t, handler, meta, "commit", map[string]any{"contractVersion": "import-commit.v1", "token": preview["token"]}); err != nil {
			t.Fatalf("commit %s: %v", document, err)
		}
	}
	run(`{"format":"dnd-homebrew-items","schemaVersion":1,"classes":[],"items":[{"id":"luna","name":"Luna"}]}`)
	run(`{"format":"dnd-homebrew-items","schemaVersion":1,"mode":"replace","classes":[],"items":[]}`)
	if len(store.collections[homebrew.ItemsCollection]) != 0 {
		t.Fatal("replace kept a draft")
	}
	run(`{"format":"dnd-homebrew-items","schemaVersion":1,"classes":[],"items":[{"id":"luna","name":"Luna"}]}`)
	if store.collections[homebrew.ItemsCollection]["luna"].Revision != 3 {
		t.Fatalf("recreated revision %d", store.collections[homebrew.ItemsCollection]["luna"].Revision)
	}
}

func TestCommitRefusesStalePlans(t *testing.T) {
	store := newFakeStore()
	handler, _ := New(store)
	document := json.RawMessage(`{"format":"dnd-homebrew-items","schemaVersion":1,"classes":[],"items":[{"id":"luna","name":"Luna"}]}`)
	preview, err := handle(t, handler, dm, "preview", map[string]any{"contractVersion": "import-preview.v1", "format": Format, "document": document})
	if err != nil {
		t.Fatal(err)
	}
	store.revisions[homebrew.ItemsCollection]++
	if _, err := handle(t, handler, dm, "commit", map[string]any{"contractVersion": "import-commit.v1", "token": preview["token"]}); kindOf(err) != workerrpc.KindConflict {
		t.Fatalf("stale commit: %v", err)
	}
}

func TestPlansExpire(t *testing.T) {
	handler, _ := New(newFakeStore())
	now := time.Unix(100, 0)
	handler.now = func() time.Time { return now }
	document := json.RawMessage(`{"format":"dnd-homebrew-items","schemaVersion":1,"classes":[],"items":[]}`)
	preview, err := handle(t, handler, dm, "preview", map[string]any{"contractVersion": "import-preview.v1", "format": Format, "document": document})
	if err != nil {
		t.Fatal(err)
	}
	now = now.Add(planLifetime)
	if _, err := handle(t, handler, dm, "commit", map[string]any{"contractVersion": "import-commit.v1", "token": preview["token"]}); kindOf(err) != workerrpc.KindNotFound {
		t.Fatalf("expired plan: %v", err)
	}
}

func TestImportsRequireTheDM(t *testing.T) {
	handler, _ := New(newFakeStore())
	for _, meta := range []*workerrpc.Meta{nil, {Actor: &workerrpc.Actor{Role: "player"}}} {
		if _, err := handle(t, handler, meta, "describe", map[string]any{}); kindOf(err) != workerrpc.KindUnauthorized {
			t.Fatalf("%v: %v", meta, err)
		}
	}
	if _, err := handle(t, handler, dm, "preview", map[string]any{"contractVersion": "import-preview.v1", "format": "dm-tools-planning", "document": map[string]any{}}); kindOf(err) != workerrpc.KindValidationFailed {
		t.Fatalf("foreign format: %v", err)
	}
}
