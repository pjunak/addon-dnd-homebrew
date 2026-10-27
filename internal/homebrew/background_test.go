package homebrew

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

type backgroundFixture struct {
	Valid   []json.RawMessage `json:"valid"`
	Invalid []struct {
		Name   string                     `json:"name"`
		Change map[string]json.RawMessage `json:"change"`
	} `json:"invalid"`
	Published json.RawMessage `json:"published"`
}

func loadBackgroundFixture(t *testing.T) backgroundFixture {
	t.Helper()
	body, err := os.ReadFile("../../tests/fixtures/backgrounds.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture backgroundFixture
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	return fixture
}

func TestBackgroundDraftsMatchSharedFixture(t *testing.T) {
	fixture := loadBackgroundFixture(t)
	for _, body := range fixture.Valid {
		if _, err := DecodeBackground(body); err != nil {
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
		if _, err := DecodeBackground(body); err == nil {
			t.Errorf("%s was accepted", testCase.Name)
		}
	}
}

func TestPublishedBackgroundBelongsToItsDraft(t *testing.T) {
	fixture := loadBackgroundFixture(t)
	published, err := DecodePublishedBackground(fixture.Published)
	if err != nil {
		t.Fatal(err)
	}
	if published.ID != "hb.lamplighter" || published.BackgroundID != "lamplighter" || published.Withdrawn {
		t.Fatalf("published background = %+v", published)
	}
	renamed := strings.Replace(string(fixture.Published), `"backgroundId": "lamplighter"`, `"backgroundId": "other"`, 1)
	if _, err := DecodePublishedBackground([]byte(renamed)); err == nil {
		t.Fatal("a background id that does not match the record was accepted")
	}
	for name, change := range map[string]func(record map[string]any){
		"a record of another kind": func(record map[string]any) { record["kind"] = "feat" },
		"a fixed tool and a tool choice": func(record map[string]any) {
			record["toolProficiencyChoice"] = map[string]any{"count": 1, "from": []string{"a", "b"}}
		},
		"picking every listed tool": func(record map[string]any) {
			delete(record, "toolProficiency")
			record["toolProficiencyChoice"] = map[string]any{"count": 2, "from": []string{"a", "b"}}
		},
		"feat choices without a feat": func(record map[string]any) { delete(record, "originFeat") },
		"an AC bonus":                 func(record map[string]any) { record["grants"] = map[string]any{"acBonus": 1} },
	} {
		var document map[string]any
		if err := json.Unmarshal(fixture.Published, &document); err != nil {
			t.Fatal(err)
		}
		change(document["record"].(map[string]any))
		body, _ := json.Marshal(document)
		if _, err := DecodePublishedBackground(body); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
}
