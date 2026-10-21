package homebrew

import (
	"bytes"
	"encoding/json"
	"os"
	"reflect"
	"strings"
	"testing"
)

type effectFixture struct {
	Valid       []Effect   `json:"valid"`
	Invalid     []Effect   `json:"invalid"`
	InvalidSets [][]Effect `json:"invalidSets"`
	ValidSets   [][]Effect `json:"validSets"`
	Grants      struct {
		Valid   []grantsCase `json:"valid"`
		Invalid []grantsCase `json:"invalid"`
	} `json:"grants"`
}

type grantsCase struct {
	Name   string         `json:"name"`
	Grants map[string]any `json:"grants"`
}

func loadEffectFixture(t *testing.T) effectFixture {
	t.Helper()
	body, err := os.ReadFile("../../tests/fixtures/effects.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture effectFixture
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	return fixture
}

func TestEffectsMatchSharedFixture(t *testing.T) {
	fixture := loadEffectFixture(t)
	for _, effect := range fixture.Valid {
		if err := ValidateEffect(effect); err != nil {
			t.Errorf("%+v: %v", effect, err)
		}
	}
	for _, effect := range fixture.Invalid {
		if ValidateEffect(effect) == nil {
			t.Errorf("%+v was accepted", effect)
		}
	}
	for _, effects := range fixture.InvalidSets {
		if ValidateMechanics("complete", effects, nil) == nil {
			t.Errorf("%+v was accepted", effects)
		}
	}
	for _, effects := range fixture.ValidSets {
		if err := ValidateMechanics("complete", effects, nil); err != nil {
			t.Errorf("%+v: %v", effects, err)
		}
	}
}

func TestGrantsMatchSharedFixture(t *testing.T) {
	fixture := loadEffectFixture(t)
	if len(fixture.Grants.Valid) == 0 || len(fixture.Grants.Invalid) == 0 {
		t.Fatal("the fixture has no grants cases")
	}
	for _, testCase := range fixture.Grants.Valid {
		if err := ValidateGrants(testCase.Grants); err != nil {
			t.Errorf("%s: %v", testCase.Name, err)
		}
	}
	for _, testCase := range fixture.Grants.Invalid {
		if ValidateGrants(testCase.Grants) == nil {
			t.Errorf("%s was accepted", testCase.Name)
		}
	}
}

func TestMechanicsAgreeWithEngineGate(t *testing.T) {
	effect := []Effect{{Target: "armorClass", Mode: "add", Value: 1}}
	grants := map[string]any{"advantages": []any{map[string]any{"on": "deathSave"}}}
	if ValidateMechanics("narrative", effect, nil) == nil {
		t.Fatal("a narrative item with effects is an Engine blocker")
	}
	if ValidateMechanics("narrative", nil, grants) == nil {
		t.Fatal("a narrative item with grants is an Engine blocker")
	}
	if ValidateMechanics("complete", nil, nil) == nil {
		t.Fatal("a complete item without effects or grants is meaningless")
	}
	if err := ValidateMechanics("complete", nil, grants); err != nil {
		t.Fatalf("grants alone make an item complete: %v", err)
	}
	if ValidateMechanics("complete", effect, map[string]any{}) == nil {
		t.Fatal("empty grants were accepted")
	}
	if ValidateMechanics("partial", nil, nil) == nil {
		t.Fatal("unknown mechanics were accepted")
	}
	if err := ValidateMechanics("narrative", []Effect{}, nil); err != nil {
		t.Fatal(err)
	}
}

func validItemJSON() string {
	return `{"id":"defense","schemaVersion":1,"setId":"cursed-cards","name":"Defense","text":"+1 permanent bonus to Armor Class.","overrides":{},"tags":[],"characterMechanics":"complete","characterEffects":[{"target":"armorClass","mode":"add","value":1}],"playerVisible":true,"retired":false,"updatedAt":1}`
}

func TestDecodeItem(t *testing.T) {
	item, err := DecodeItem([]byte(validItemJSON()))
	if err != nil {
		t.Fatal(err)
	}
	if item.SetID != "cursed-cards" || len(item.CharacterEffects) != 1 {
		t.Fatalf("decoded %+v", item)
	}
	for name, body := range map[string]string{
		"unknown field":    strings.Replace(validItemJSON(), `"retired":false`, `"retired":false,"extra":1`, 1),
		"missing field":    strings.Replace(validItemJSON(), `"retired":false,`, ``, 1),
		"bad id":           strings.Replace(validItemJSON(), `"id":"defense"`, `"id":"Defense"`, 1),
		"padded name":      strings.Replace(validItemJSON(), `"name":"Defense"`, `"name":" Defense"`, 1),
		"two-line name":    strings.Replace(validItemJSON(), `"name":"Defense"`, `"name":"De\nfense"`, 1),
		"bad effect":       strings.Replace(validItemJSON(), `"armorClass"`, `"attackBonus"`, 1),
		"narrative + fx":   strings.Replace(validItemJSON(), `"complete"`, `"narrative"`, 1),
		"bad override":     strings.Replace(validItemJSON(), `"overrides":{}`, `"overrides":{"rarity":"Mythic"}`, 1),
		"unknown override": strings.Replace(validItemJSON(), `"overrides":{}`, `"overrides":{"weight":1}`, 1),
		"bad tag":          strings.Replace(validItemJSON(), `"tags":[]`, `"tags":["Card"]`, 1),
		"duplicate tag":    strings.Replace(validItemJSON(), `"tags":[]`, `"tags":["card","card"]`, 1),
		"bad schema":       strings.Replace(validItemJSON(), `"schemaVersion":1`, `"schemaVersion":2`, 1),
		"null grants":      strings.Replace(validItemJSON(), `"retired":false`, `"retired":false,"grants":null`, 1),
		"empty grants":     strings.Replace(validItemJSON(), `"retired":false`, `"retired":false,"grants":{}`, 1),
		"bad grant":        strings.Replace(validItemJSON(), `"retired":false`, `"retired":false,"grants":{"advantages":[{"on":"damage"}]}`, 1),
		"draft condition":  strings.Replace(validItemJSON(), `"retired":false`, `"retired":false,"grants":{"conditions":[{"id":"fate-touched","name":"Fate-Touched","summary":""}]}`, 1),
		"narrative grants": strings.Replace(strings.Replace(validItemJSON(), `"retired":false`, `"retired":false,"grants":{"advantages":[{"on":"deathSave"}]}`, 1), `"characterMechanics":"complete","characterEffects":[{"target":"armorClass","mode":"add","value":1}]`, `"characterMechanics":"narrative","characterEffects":[]`, 1),
		"null override":    strings.Replace(validItemJSON(), `"overrides":{}`, `"overrides":{"rarity":null}`, 1),
	} {
		if _, err := DecodeItem([]byte(body)); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
}

func TestDecodeItemGrants(t *testing.T) {
	body := strings.Replace(validItemJSON(), `"retired":false`, `"retired":false,"grants":{"resources":[{"key":"uses","name":"Defense","fixed":1,"recharge":"long"}],"spells":[{"ids":["shield"],"resource":"uses"}],"castingAbility":{"id":"casting","choose":["INT","WIS","CHA"]}}`, 1)
	item, err := DecodeItem([]byte(body))
	if err != nil {
		t.Fatal(err)
	}
	if len(item.Grants) != 3 {
		t.Fatalf("decoded grants %+v", item.Grants)
	}
	grantsOnly := strings.Replace(body, `"characterEffects":[{"target":"armorClass","mode":"add","value":1}]`, `"characterEffects":[]`, 1)
	if _, err := DecodeItem([]byte(grantsOnly)); err != nil {
		t.Fatalf("an item automated by grants alone: %v", err)
	}
}

func TestDecodeSet(t *testing.T) {
	body := `{"id":"cursed-cards","schemaVersion":1,"name":"Cursed Cards","description":"","curse":"","itemType":"Wondrous Item","rarity":"Rare","attunement":false,"bodyPlacements":["other"],"tags":["card"],"namePrefix":"Cursed Card","playerVisible":false,"updatedAt":0}`
	if _, err := DecodeSet([]byte(body)); err != nil {
		t.Fatal(err)
	}
	withCondition := strings.Replace(body, `"updatedAt":0`, `"updatedAt":0,"condition":{"id":"fate-touched","name":"Fate-Touched","summary":""}`, 1)
	set, err := DecodeSet([]byte(withCondition))
	if err != nil {
		t.Fatal(err)
	}
	if set.Condition == nil || set.Condition.ID != "fate-touched" {
		t.Fatalf("decoded condition %+v", set.Condition)
	}
	for name, broken := range map[string]string{
		"rarity":            strings.Replace(body, `"Rare"`, `"rare"`, 1),
		"placement":         strings.Replace(body, `["other"]`, `["pocket"]`, 1),
		"type":              strings.Replace(body, `"Wondrous Item"`, `""`, 1),
		"name":              strings.Replace(body, `"Cursed Cards"`, `""`, 1),
		"condition summary": strings.Replace(withCondition, `,"summary":""`, ``, 1),
		"condition id":      strings.Replace(withCondition, `"fate-touched"`, `"Fate Touched"`, 1),
		"standard id":       strings.Replace(withCondition, `"fate-touched"`, `"charmed"`, 1),
		"condition field":   strings.Replace(withCondition, `"summary":""`, `"summary":"","maximumLevel":3`, 1),
		"null condition":    strings.Replace(body, `"updatedAt":0`, `"updatedAt":0,"condition":null`, 1),
	} {
		if _, err := DecodeSet([]byte(broken)); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
}

func TestDecodePublished(t *testing.T) {
	body, err := os.ReadFile("../../tests/fixtures/publish.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			Name      string          `json:"name"`
			Published json.RawMessage `json:"published"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	if len(fixture.Cases) == 0 {
		t.Fatal("publish fixture has no cases")
	}
	for _, testCase := range fixture.Cases {
		published, err := DecodePublished(testCase.Published)
		if err != nil {
			t.Errorf("%s: %v", testCase.Name, err)
			continue
		}
		if published.Record.ID != IDPrefix+published.ItemID {
			t.Errorf("%s: identity %q", testCase.Name, published.Record.ID)
		}
		// The worker serves the decoded record re-encoded; it must equal what was published.
		var stored struct {
			Record map[string]any `json:"record"`
		}
		var served map[string]any
		body, _ := json.Marshal(published.Record)
		if json.Unmarshal(testCase.Published, &stored) != nil || json.Unmarshal(body, &served) != nil || !reflect.DeepEqual(stored.Record, served) {
			t.Errorf("%s: serves %s", testCase.Name, body)
		}
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, fixture.Cases[0].Published); err != nil {
		t.Fatal(err)
	}
	valid := compact.Bytes()
	for name, broken := range map[string]string{
		"foreign id":   strings.Replace(string(valid), `"id":"hb.defense"`, `"id":"defense"`, 2),
		"kind":         strings.Replace(string(valid), `"magic-item"`, `"gear"`, 1),
		"book":         strings.Replace(string(valid), `"homebrew"`, `"dmg"`, 1),
		"missing text": strings.Replace(string(valid), `"text":`, `"notes":`, 1),
	} {
		if _, err := DecodePublished([]byte(broken)); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
}

func TestDecodeMeta(t *testing.T) {
	if _, err := DecodeMeta([]byte(`{"schemaVersion":1,"revision":3,"publishedAt":10,"recordCount":44}`)); err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{`{"schemaVersion":1,"revision":0,"publishedAt":10,"recordCount":1}`, `{"schemaVersion":1,"revision":1,"publishedAt":10}`, `[]`} {
		if _, err := DecodeMeta([]byte(body)); err == nil {
			t.Errorf("%s was accepted", body)
		}
	}
}
