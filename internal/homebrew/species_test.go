package homebrew

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

type speciesFixture struct {
	Valid   []json.RawMessage `json:"valid"`
	Invalid []struct {
		Name   string                     `json:"name"`
		Change map[string]json.RawMessage `json:"change"`
	} `json:"invalid"`
	Published json.RawMessage `json:"published"`
}

func loadSpeciesFixture(t *testing.T) speciesFixture {
	t.Helper()
	body, err := os.ReadFile("../../tests/fixtures/species.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture speciesFixture
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	return fixture
}

func TestSpeciesDraftsMatchSharedFixture(t *testing.T) {
	fixture := loadSpeciesFixture(t)
	for _, body := range fixture.Valid {
		if _, err := DecodeSpecies(body); err != nil {
			t.Errorf("%s: %v", body[:40], err)
		}
	}
	for _, testCase := range fixture.Invalid {
		var draft map[string]json.RawMessage
		if err := json.Unmarshal(fixture.Valid[0], &draft); err != nil {
			t.Fatal(err)
		}
		for key, value := range testCase.Change {
			draft[key] = value
		}
		body, _ := json.Marshal(draft)
		if _, err := DecodeSpecies(body); err == nil {
			t.Errorf("%s was accepted", testCase.Name)
		}
	}
}

func TestPublishedSpeciesBelongsToItsDraft(t *testing.T) {
	fixture := loadSpeciesFixture(t)
	published, err := DecodePublishedSpecies(fixture.Published)
	if err != nil {
		t.Fatal(err)
	}
	if published.ID != "hb.emberkin" || published.SpeciesID != "emberkin" || published.Withdrawn {
		t.Fatalf("published species = %+v", published)
	}
	renamed := strings.Replace(string(fixture.Published), `"speciesId": "emberkin"`, `"speciesId": "other"`, 1)
	if _, err := DecodePublishedSpecies([]byte(renamed)); err == nil {
		t.Fatal("a species id that does not match the record was accepted")
	}
	for name, change := range map[string]func(record map[string]any){
		"a record of another kind":       func(record map[string]any) { record["kind"] = "feat" },
		"a size that is not its options": func(record map[string]any) { record["size"] = "Medium" },
		"a summary as a fixed size":      func(record map[string]any) { delete(record, "sizeOptions") },
		"one size option":                func(record map[string]any) { record["sizeOptions"] = []string{"Medium"}; record["size"] = "Medium" },
		"no walking speed":               func(record map[string]any) { record["speeds"] = map[string]any{"climb": "speed"} },
		"two lineages with one id": func(record map[string]any) {
			record["lineages"] = []any{map[string]any{"id": "a", "name": "A"}, map[string]any{"id": "a", "name": "B"}}
		},
		"a lineage that keeps its draft text": func(record map[string]any) {
			record["lineages"] = []any{map[string]any{"id": "a", "name": "A", "text": ""}}
		},
	} {
		var document map[string]any
		if err := json.Unmarshal(fixture.Published, &document); err != nil {
			t.Fatal(err)
		}
		change(document["record"].(map[string]any))
		body, _ := json.Marshal(document)
		if _, err := DecodePublishedSpecies(body); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
}
