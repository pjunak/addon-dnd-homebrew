package importer

import (
	"bytes"
	"encoding/json"
	"fmt"
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
		servedSchema = "content-record.schema.json#/properties/value"
		engineGrants = homebrew.GrantsContract
		recordGrants = "homebrew-common.schema.json#/$defs/recordGrants"
		itemGrants   = "homebrew-common.schema.json#/$defs/itemGrants"
		featSchema   = "homebrew-feat.schema.json"
		featRecord   = "published-feat.schema.json"
		spellSchema  = "homebrew-spell.schema.json"
		spellRecord  = "published-spell.schema.json"
		speciesDraft = "homebrew-species.schema.json"
		speciesServe = "published-species.schema.json"
	)
	schemas := compileSchemas(t, setSchema, itemSchema, recordSchema, servedSchema, engineGrants, recordGrants, itemGrants, featSchema, featRecord, spellSchema, spellRecord, speciesDraft, speciesServe)
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
	plan, err := buildPlan(example, noDrafts(), 1)
	if err != nil {
		t.Fatal(err)
	}
	imports := loadImportFixture(t)
	plans := []importPlan{plan}
	for _, testCase := range imports.Cases {
		if testCase.ErrorIncludes == "" {
			planned, err := buildPlan(testCase.Document, drafts{sets: storedMap(t, imports.Stored.Sets), items: storedMap(t, imports.Stored.Items), subclasses: map[string]stored{}}, imports.Now)
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
			switch mutation.Reference.DataID {
			case homebrew.SetsCollection:
				name = setSchema
			case homebrew.FeatsCollection:
				name = featSchema
			case homebrew.SpellsCollection:
				name = spellSchema
			case homebrew.SpeciesCollection:
				name = speciesDraft
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
	// The host validates served records against the published record shape,
	// and their grants must also be ones the Engine accepts.
	for _, testCase := range publish.Cases {
		accept(itemSchema, testCase.Name+" (item)", testCase.Item)
		accept(recordSchema, testCase.Name+" (published)", testCase.Published)
		var published struct {
			Record struct {
				Grants json.RawMessage `json:"grants"`
			} `json:"record"`
		}
		var served struct {
			Record json.RawMessage `json:"record"`
		}
		if json.Unmarshal(testCase.Published, &published) != nil || json.Unmarshal(testCase.Published, &served) != nil {
			t.Fatal(testCase.Name)
		}
		accept(servedSchema, testCase.Name+" (served)", served.Record)
		if published.Record.Grants != nil {
			accept(engineGrants, testCase.Name+" (served grants)", published.Record.Grants)
		}
	}

	// Subclass and feature records are served under the same response schema.
	var subclasses struct {
		Published struct {
			Records []json.RawMessage `json:"records"`
		} `json:"published"`
	}
	if body, err := os.ReadFile("../../tests/fixtures/subclasses.json"); err != nil || json.Unmarshal(body, &subclasses) != nil {
		t.Fatalf("subclass fixture: %v", err)
	}
	for index, record := range subclasses.Published.Records {
		accept(servedSchema, fmt.Sprintf("published subclass record %d (served)", index+1), record)
	}

	// Feats, spells and species: every valid draft, the published document and its served record.
	for _, kind := range []struct{ label, fixture, draft, published string }{
		{"feat", "feats.json", featSchema, featRecord},
		{"spell", "spells.json", spellSchema, spellRecord},
		{"species", "species.json", speciesDraft, speciesServe},
	} {
		var fixture struct {
			Valid     []json.RawMessage `json:"valid"`
			Published json.RawMessage   `json:"published"`
		}
		if body, err := os.ReadFile("../../tests/fixtures/" + kind.fixture); err != nil || json.Unmarshal(body, &fixture) != nil {
			t.Fatalf("%s fixture: %v", kind.label, err)
		}
		for index, draft := range fixture.Valid {
			accept(kind.draft, fmt.Sprintf("%s %d", kind.label, index+1), draft)
		}
		accept(kind.published, "published "+kind.label, fixture.Published)
		var served struct {
			Record json.RawMessage `json:"record"`
		}
		if json.Unmarshal(fixture.Published, &served) != nil {
			t.Fatal("published " + kind.label)
		}
		accept(servedSchema, "published "+kind.label+" (served)", served.Record)
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
		accept(engineGrants, testCase.Name+" (served)", testCase.Grants)
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
