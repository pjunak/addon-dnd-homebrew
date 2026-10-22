package homebrew

import (
	"encoding/json"
	"os"
	"testing"
)

// The grants vocabulary fixture is built from the schema itself; the browser
// validator (src/schema.ts) reads the same cases.
func TestGrantsVocabularyMatchesSharedFixture(t *testing.T) {
	body, err := os.ReadFile("../../tests/fixtures/vocabulary.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Valid, Invalid []struct {
			Name   string          `json:"name"`
			Grants json.RawMessage `json:"grants"`
		}
	}
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	if len(fixture.Valid) < 49 || len(fixture.Invalid) == 0 {
		t.Fatalf("the fixture covers %d valid and %d invalid cases", len(fixture.Valid), len(fixture.Invalid))
	}
	for _, testCase := range fixture.Valid {
		if err := ValidateContract(GrantsContract, testCase.Grants); err != nil {
			t.Errorf("%s: %v", testCase.Name, err)
		}
	}
	for _, testCase := range fixture.Invalid {
		if ValidateContract(GrantsContract, testCase.Grants) == nil {
			t.Errorf("%s was accepted", testCase.Name)
		}
	}
}
