package importer

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/santhosh-tekuri/jsonschema/v6"

	"github.com/pjunak/addon-dnd-homebrew/internal/homebrew"
)

// The host validates every collection write against contracts/ with this
// library; drafts and records the model accepts must pass there too.
func compileSchemas(t *testing.T, names ...string) map[string]*jsonschema.Schema {
	t.Helper()
	compiler := jsonschema.NewCompiler()
	compiler.DefaultDraft(jsonschema.Draft2020)
	compiler.AssertFormat()
	files, err := filepath.Glob("../../contracts/*.schema.json")
	if err != nil || len(files) == 0 {
		t.Fatalf("no schemas: %v", err)
	}
	for _, file := range files {
		body, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		document, err := jsonschema.UnmarshalJSON(bytes.NewReader(body))
		if err != nil {
			t.Fatalf("%s: %v", file, err)
		}
		if err := compiler.AddResource("file:///addon/contracts/"+filepath.Base(file), document); err != nil {
			t.Fatal(err)
		}
	}
	schemas := map[string]*jsonschema.Schema{}
	for _, name := range names {
		schema, err := compiler.Compile("file:///addon/contracts/" + name)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		schemas[name] = schema
	}
	return schemas
}

func validate(t *testing.T, schema *jsonschema.Schema, label string, body []byte) error {
	t.Helper()
	document, err := jsonschema.UnmarshalJSON(bytes.NewReader(body))
	if err != nil {
		t.Fatalf("%s: %v", label, err)
	}
	return schema.Validate(document)
}

func TestStoredShapesMatchCollectionSchemas(t *testing.T) {
	const (
		setSchema    = "homebrew-set.schema.json"
		itemSchema   = "homebrew-item.schema.json"
		recordSchema = "published-record.schema.json"
		recordGrants = "homebrew-common.schema.json#/$defs/recordGrants"
		itemGrants   = "homebrew-common.schema.json#/$defs/itemGrants"
	)
	schemas := compileSchemas(t, setSchema, itemSchema, recordSchema, recordGrants, itemGrants)
	accept := func(name, label string, body []byte) {
		t.Helper()
		if err := validate(t, schemas[name], label, body); err != nil {
			t.Errorf("%s does not match %s: %v", label, name, err)
		}
	}

	example, err := os.ReadFile("../../docs/examples/sample-items.json")
	if err != nil {
		t.Fatal(err)
	}
	plan, err := buildPlan(example, map[string]stored{}, map[string]stored{}, 1)
	if err != nil {
		t.Fatal(err)
	}
	imports := loadImportFixture(t)
	plans := []importPlan{plan}
	for _, testCase := range imports.Cases {
		if testCase.ErrorIncludes == "" {
			planned, err := buildPlan(testCase.Document, storedMap(t, imports.Stored.Sets), storedMap(t, imports.Stored.Items), imports.Now)
			if err != nil {
				t.Fatal(err)
			}
			plans = append(plans, planned)
		}
	}
	for _, planned := range plans {
		for _, mutation := range planned.Mutations {
			if mutation.Operation != "put" {
				continue
			}
			name := itemSchema
			if mutation.Reference.DataID == homebrew.SetsCollection {
				name = setSchema
			}
			accept(name, mutation.Reference.DataID+"/"+mutation.Key, mutation.Value.(json.RawMessage))
		}
	}

	var publish struct {
		Sets  []json.RawMessage `json:"sets"`
		Cases []struct {
			Name      string          `json:"name"`
			Item      json.RawMessage `json:"item"`
			Published json.RawMessage `json:"published"`
		} `json:"cases"`
	}
	if body, err := os.ReadFile("../../tests/fixtures/publish.json"); err != nil || json.Unmarshal(body, &publish) != nil {
		t.Fatalf("publish fixture: %v", err)
	}
	for _, set := range publish.Sets {
		accept(setSchema, "publish fixture set", set)
	}
	for _, testCase := range publish.Cases {
		accept(itemSchema, testCase.Name+" (item)", testCase.Item)
		accept(recordSchema, testCase.Name+" (published)", testCase.Published)
	}

	var effects struct {
		Grants struct {
			Valid []struct {
				Name   string          `json:"name"`
				Grants json.RawMessage `json:"grants"`
			} `json:"valid"`
		} `json:"grants"`
	}
	if body, err := os.ReadFile("../../tests/fixtures/effects.json"); err != nil || json.Unmarshal(body, &effects) != nil {
		t.Fatalf("effects fixture: %v", err)
	}
	for _, testCase := range effects.Grants.Valid {
		accept(recordGrants, testCase.Name, testCase.Grants)
		var grants map[string]json.RawMessage
		_ = json.Unmarshal(testCase.Grants, &grants)
		if _, conditions := grants["conditions"]; !conditions {
			accept(itemGrants, testCase.Name+" (draft)", testCase.Grants)
		}
	}

	item := `{"id":"luck","schemaVersion":1,"setId":"","name":"Luck","text":"","overrides":{},"tags":[],"characterMechanics":"complete","characterEffects":[],"playerVisible":false,"retired":false,"updatedAt":1,"grants":{"advantages":[{"on":"deathSave"}]}}`
	accept(itemSchema, "an item automated by grants alone", []byte(item))
	for label, body := range map[string]string{
		"a narrative item with grants":          `{"id":"luck","schemaVersion":1,"setId":"","name":"Luck","text":"","overrides":{},"tags":[],"characterMechanics":"narrative","characterEffects":[],"playerVisible":false,"retired":false,"updatedAt":1,"grants":{"advantages":[{"on":"deathSave"}]}}`,
		"a complete item with neither":          `{"id":"luck","schemaVersion":1,"setId":"","name":"Luck","text":"","overrides":{},"tags":[],"characterMechanics":"complete","characterEffects":[],"playerVisible":false,"retired":false,"updatedAt":1}`,
		"a draft condition":                     `{"id":"luck","schemaVersion":1,"setId":"","name":"Luck","text":"","overrides":{},"tags":[],"characterMechanics":"complete","characterEffects":[],"playerVisible":false,"retired":false,"updatedAt":1,"grants":{"conditions":[{"id":"lucky","name":"Lucky","summary":""}]}}`,
		"a spellcasting ability without spells": `{"id":"luck","schemaVersion":1,"setId":"","name":"Luck","text":"","overrides":{},"tags":[],"characterMechanics":"complete","characterEffects":[],"playerVisible":false,"retired":false,"updatedAt":1,"grants":{"castingAbility":{"fixed":"WIS"}}}`,
		"a free spell":                          `{"id":"luck","schemaVersion":1,"setId":"","name":"Luck","text":"","overrides":{},"tags":[],"characterMechanics":"complete","characterEffects":[],"playerVisible":false,"retired":false,"updatedAt":1,"grants":{"spells":[{"ids":["bless"],"free":"1/long"}]}}`,
	} {
		if validate(t, schemas[itemSchema], label, []byte(body)) == nil {
			t.Errorf("the item schema accepts %s", label)
		}
	}
}
