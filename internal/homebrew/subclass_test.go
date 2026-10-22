package homebrew

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

type subclassFixture struct {
	Valid   []json.RawMessage `json:"valid"`
	Invalid []struct {
		Name   string                     `json:"name"`
		Change map[string]json.RawMessage `json:"change"`
	} `json:"invalid"`
	Published json.RawMessage `json:"published"`
}

func loadSubclassFixture(t *testing.T) subclassFixture {
	t.Helper()
	body, err := os.ReadFile("../../tests/fixtures/subclasses.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture subclassFixture
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	return fixture
}

func TestSubclassDraftsMatchSharedFixture(t *testing.T) {
	fixture := loadSubclassFixture(t)
	for _, body := range fixture.Valid {
		if _, err := DecodeSubclass(body); err != nil {
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
		if _, err := DecodeSubclass(body); err == nil {
			t.Errorf("%s was accepted", testCase.Name)
		}
	}
}

func TestPublishedSubclassRecordsBelongTogether(t *testing.T) {
	fixture := loadSubclassFixture(t)
	published, err := DecodePublishedSubclass(fixture.Published)
	if err != nil {
		t.Fatal(err)
	}
	if published.ID != "hb.storm-drum" || len(published.Records) != 5 {
		t.Fatalf("decoded %+v", published)
	}
	text := string(fixture.Published)
	for name, broken := range map[string]string{
		"a feature of another subclass": strings.Replace(text, `"subclassId": "hb.storm-drum",
        "level": 6`, `"subclassId": "hb.other",
        "level": 6`, 1),
		"a record of another class": strings.Replace(text, `"classId": "barbarian",
        "subclassId": "hb.storm-drum",
        "level": 10`, `"classId": "fighter",
        "subclassId": "hb.storm-drum",
        "level": 10`, 1),
		"a grant the vocabulary lacks":     strings.Replace(text, `"resistances": ["thunder"]`, `"teleport": 30`, 1),
		"an id that is not its subclass's": strings.Replace(text, `"subclassId": "storm-drum"`, `"subclassId": "storm-drums"`, 1),
	} {
		if broken == text {
			t.Fatalf("%s: the fixture changed shape", name)
		}
		if _, err := DecodePublishedSubclass([]byte(broken)); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
}
