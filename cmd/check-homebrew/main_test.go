package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTheSampleFileIsValid(t *testing.T) {
	var out bytes.Buffer
	if err := run([]string{"../../docs/examples/sample-items.json"}, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out.String(), "VALID: 15 new, 0 changed, 0 unchanged, 0 removed (merge).") {
		t.Fatalf("report:\n%s", out.String())
	}
}

func TestTheSampleSubclassIsValid(t *testing.T) {
	var out bytes.Buffer
	if err := run([]string{"../../docs/examples/sample-subclass.json"}, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out.String(), "VALID: 1 new, 0 changed, 0 unchanged, 0 removed (merge).") ||
		!strings.Contains(out.String(), "create homebrew_subclasses/banner-warden") {
		t.Fatalf("report:\n%s", out.String())
	}
}

func TestAnExportTurnsTheReportIntoUpdates(t *testing.T) {
	var fixture struct {
		Stored struct {
			Sets  []json.RawMessage `json:"sets"`
			Items []json.RawMessage `json:"items"`
		} `json:"stored"`
	}
	body, err := os.ReadFile("../../tests/fixtures/imports.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(body, &fixture); err != nil {
		t.Fatal(err)
	}
	export := write(t, "export.json", map[string]any{
		"format": "dnd-homebrew", "schemaVersion": 1, "generatedAt": 1, "mode": "merge",
		"sets": fixture.Stored.Sets, "items": fixture.Stored.Items,
	})
	document := write(t, "items.json", map[string]any{
		"format": "dnd-homebrew", "schemaVersion": 1, "sets": []any{},
		"items": []any{map[string]any{"id": "defense", "text": "+1 bonus to Armor Class while carried."}},
	})
	var out bytes.Buffer
	if err := run([]string{document, export}, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out.String(), "VALID: 0 new, 1 changed, 0 unchanged, 0 removed (merge).") ||
		!strings.Contains(out.String(), "homebrew_items/defense") {
		t.Fatalf("report:\n%s", out.String())
	}
}

func TestAProblemNamesTheEntry(t *testing.T) {
	document := write(t, "items.json", map[string]any{
		"format": "dnd-homebrew", "schemaVersion": 1, "sets": []any{},
		"items": []any{map[string]any{"id": "ring", "name": "Ring",
			"characterEffects": []any{map[string]any{"target": "armorClass", "key": "DEX", "mode": "add", "value": 1}}}},
	})
	err := run([]string{document}, &bytes.Buffer{})
	if err == nil || !strings.Contains(err.Error(), "items[0]") || !strings.Contains(err.Error(), "armorClass takes no key") {
		t.Fatalf("error %v", err)
	}
	if err := run(nil, &bytes.Buffer{}); err == nil || !strings.Contains(err.Error(), "usage") {
		t.Fatalf("usage error %v", err)
	}
}

func write(t *testing.T, name string, value any) string {
	t.Helper()
	body, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, body, 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestTheSampleFeatsAreValid(t *testing.T) {
	var out bytes.Buffer
	if err := run([]string{"../../docs/examples/sample-feats.json"}, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out.String(), "VALID: 4 new, 0 changed, 0 unchanged, 0 removed (merge).") ||
		!strings.Contains(out.String(), "create homebrew_feats/storm-touched") {
		t.Fatalf("report:\n%s", out.String())
	}
}

func TestTheSampleSpellsAreValid(t *testing.T) {
	var out bytes.Buffer
	if err := run([]string{"../../docs/examples/sample-spells.json"}, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out.String(), "VALID: 3 new, 0 changed, 0 unchanged, 0 removed (merge).") ||
		!strings.Contains(out.String(), "create homebrew_spells/ember-lance") {
		t.Fatalf("report:\n%s", out.String())
	}
}

func TestTheSampleSpeciesAreValid(t *testing.T) {
	var out bytes.Buffer
	if err := run([]string{"../../docs/examples/sample-species.json"}, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out.String(), "VALID: 2 new, 0 changed, 0 unchanged, 0 removed (merge).") ||
		!strings.Contains(out.String(), "create homebrew_species/emberkin") {
		t.Fatalf("report:\n%s", out.String())
	}
}
