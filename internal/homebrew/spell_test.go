package homebrew

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

type spellFixture struct {
	Valid   []json.RawMessage `json:"valid"`
	Invalid []struct {
		Name   string                     `json:"name"`
		Change map[string]json.RawMessage `json:"change"`
	} `json:"invalid"`
	Published json.RawMessage `json:"published"`
}

func loadSpellFixture(t *testing.T) spellFixture {
	t.Helper()
	body, err := os.ReadFile("../../tests/fixtures/spells.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture spellFixture
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	return fixture
}

func TestSpellDraftsMatchSharedFixture(t *testing.T) {
	fixture := loadSpellFixture(t)
	for _, body := range fixture.Valid {
		if _, err := DecodeSpell(body); err != nil {
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
		if _, err := DecodeSpell(body); err == nil {
			t.Errorf("%s was accepted", testCase.Name)
		}
	}
}

func TestPublishedSpellBelongsToItsDraft(t *testing.T) {
	fixture := loadSpellFixture(t)
	published, err := DecodePublishedSpell(fixture.Published)
	if err != nil {
		t.Fatal(err)
	}
	if published.ID != "hb.ember-lance" || published.SpellID != "ember-lance" || published.Withdrawn {
		t.Fatalf("published spell = %+v", published)
	}
	renamed := strings.Replace(string(fixture.Published), `"spellId": "ember-lance"`, `"spellId": "other"`, 1)
	if _, err := DecodePublishedSpell([]byte(renamed)); err == nil {
		t.Fatal("a spell id that does not match the record was accepted")
	}
	for name, change := range map[string]func(record map[string]any){
		"a record of another kind":                func(record map[string]any) { record["kind"] = "feat" },
		"a material without a material component": func(record map[string]any) { record["components"] = []string{"V", "S"} },
		"a material component without material":   func(record map[string]any) { delete(record, "material") },
	} {
		var document map[string]any
		if err := json.Unmarshal(fixture.Published, &document); err != nil {
			t.Fatal(err)
		}
		change(document["record"].(map[string]any))
		body, _ := json.Marshal(document)
		if _, err := DecodePublishedSpell(body); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
}
