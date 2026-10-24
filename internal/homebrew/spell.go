package homebrew

import (
	"encoding/json"
	"errors"
	"fmt"
)

// A spell draft publishes as one Engine `spell` record in the Compendium's
// shape; its classes put it on those classes' spell lists. The contracts state
// every rule, so the editor, the importer and the host accept the same spells.
// src/model.ts enforces the same rules.

const (
	SpellsCollection          = "homebrew_spells"
	PublishedSpellsCollection = "homebrew_published_spells"
	SpellContract             = "homebrew-spell.schema.json"
	PublishedSpellContract    = "published-spell.schema.json"
	SpellRecordKind           = "spell"
)

type Spell struct {
	ID            string   `json:"id"`
	SchemaVersion int      `json:"schemaVersion"`
	Name          string   `json:"name"`
	Level         int      `json:"level"`
	School        string   `json:"school"`
	Classes       []string `json:"classes"`
	Ritual        bool     `json:"ritual"`
	Concentration bool     `json:"concentration"`
	CastingTime   string   `json:"castingTime"`
	Range         string   `json:"range"`
	Components    []string `json:"components"`
	Material      string   `json:"material"`
	Duration      string   `json:"duration"`
	Text          string   `json:"text"`
	UpdatedAt     int64    `json:"updatedAt"`
}

// PublishedSpell is the served form of one spell draft. Like an item, a
// removed spell is withdrawn rather than deleted.
type PublishedSpell struct {
	ID            string          `json:"id"`
	SchemaVersion int             `json:"schemaVersion"`
	SpellID       string          `json:"spellId"`
	Withdrawn     bool            `json:"withdrawn"`
	Record        json.RawMessage `json:"record"`
}

// DecodeSpell checks a stored or imported spell draft against its contract.
func DecodeSpell(body []byte) (Spell, error) {
	if err := ValidateContract(SpellContract, body); err != nil {
		return Spell{}, fmt.Errorf("spell %s", err)
	}
	var spell Spell
	if err := json.Unmarshal(body, &spell); err != nil {
		return Spell{}, fmt.Errorf("spell is malformed: %w", err)
	}
	return spell, nil
}

// DecodePublishedSpell reads one served spell document: its record must pass
// the record schema the host checks responses against and belong to it.
func DecodePublishedSpell(body []byte) (PublishedSpell, error) {
	if err := ValidateContract(PublishedSpellContract, body); err != nil {
		return PublishedSpell{}, fmt.Errorf("published spell %s", err)
	}
	var published PublishedSpell
	if err := json.Unmarshal(body, &published); err != nil {
		return PublishedSpell{}, fmt.Errorf("published spell is malformed: %w", err)
	}
	var record struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(published.Record, &record); err != nil {
		return PublishedSpell{}, errors.New("a published spell record is malformed")
	}
	if published.ID != IDPrefix+published.SpellID || record.ID != published.ID {
		return PublishedSpell{}, fmt.Errorf("published spell %q does not match its spell id", published.ID)
	}
	return published, nil
}
