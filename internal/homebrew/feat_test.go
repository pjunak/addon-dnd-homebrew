package homebrew

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

type featFixture struct {
	Valid   []json.RawMessage `json:"valid"`
	Invalid []struct {
		Name   string                     `json:"name"`
		Change map[string]json.RawMessage `json:"change"`
	} `json:"invalid"`
	Published json.RawMessage `json:"published"`
}

func loadFeatFixture(t *testing.T) featFixture {
	t.Helper()
	body, err := os.ReadFile("../../tests/fixtures/feats.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture featFixture
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	return fixture
}

func TestFeatDraftsMatchSharedFixture(t *testing.T) {
	fixture := loadFeatFixture(t)
	for _, body := range fixture.Valid {
		if _, err := DecodeFeat(body); err != nil {
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
		if _, err := DecodeFeat(body); err == nil {
			t.Errorf("%s was accepted", testCase.Name)
		}
	}
}

func TestPublishedFeatBelongsToItsDraft(t *testing.T) {
	fixture := loadFeatFixture(t)
	published, err := DecodePublishedFeat(fixture.Published)
	if err != nil {
		t.Fatal(err)
	}
	if published.ID != "hb.storm-touched" || published.FeatID != "storm-touched" || published.Withdrawn {
		t.Fatalf("published feat = %+v", published)
	}
	renamed := strings.Replace(string(fixture.Published), `"featId": "storm-touched"`, `"featId": "other"`, 1)
	if _, err := DecodePublishedFeat([]byte(renamed)); err == nil {
		t.Fatal("a feat id that does not match the record was accepted")
	}
	var document map[string]any
	if err := json.Unmarshal(fixture.Published, &document); err != nil {
		t.Fatal(err)
	}
	record := document["record"].(map[string]any)
	record["kind"] = "subclass"
	body, _ := json.Marshal(document)
	if _, err := DecodePublishedFeat(body); err == nil {
		t.Fatal("a record of another kind was accepted")
	}
}
