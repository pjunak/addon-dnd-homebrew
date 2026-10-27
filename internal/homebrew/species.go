package homebrew

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
)

// A species draft publishes as one Engine `species` record in the
// Compendium's shape: sizes, speeds, darkvision and resistances are fields of
// their own, everything else the Engine's grants, and lineages the variants a
// player picks one of. The contracts state every rule but two, checked below.
// src/model.ts enforces the same rules.

const (
	SpeciesCollection          = "homebrew_species"
	PublishedSpeciesCollection = "homebrew_published_species"
	SpeciesContract            = "homebrew-species.schema.json"
	PublishedSpeciesContract   = "published-species.schema.json"
	SpeciesRecordKind          = "species"
)

type Lineage struct {
	ID     string         `json:"id"`
	Name   string         `json:"name"`
	Text   string         `json:"text"`
	Grants map[string]any `json:"grants,omitempty"`
}

type Species struct {
	ID            string         `json:"id"`
	SchemaVersion int            `json:"schemaVersion"`
	Name          string         `json:"name"`
	CreatureType  string         `json:"creatureType"`
	Sizes         []string       `json:"sizes"`
	Speed         int            `json:"speed"`
	Speeds        map[string]any `json:"speeds"`
	Darkvision    int            `json:"darkvision"`
	Resistances   []string       `json:"resistances"`
	Traits        []Trait        `json:"traits"`
	Lineages      []Lineage      `json:"lineages"`
	Grants        map[string]any `json:"grants,omitempty"`
	Text          string         `json:"text"`
	UpdatedAt     int64          `json:"updatedAt"`
}

type Trait struct {
	Name string `json:"name"`
	Text string `json:"text"`
}

// PublishedSpecies is the served form of one species draft. Like an item, a
// removed species is withdrawn rather than deleted.
type PublishedSpecies struct {
	ID            string          `json:"id"`
	SchemaVersion int             `json:"schemaVersion"`
	SpeciesID     string          `json:"speciesId"`
	Withdrawn     bool            `json:"withdrawn"`
	Record        json.RawMessage `json:"record"`
}

// DecodeSpecies checks a stored or imported species draft against its
// contract and the rule a schema cannot state.
func DecodeSpecies(body []byte) (Species, error) {
	if err := ValidateContract(SpeciesContract, body); err != nil {
		return Species{}, fmt.Errorf("species %s", err)
	}
	var species Species
	if err := json.Unmarshal(body, &species); err != nil {
		return Species{}, fmt.Errorf("species is malformed: %w", err)
	}
	if err := distinctLineages(species.Lineages); err != nil {
		return Species{}, fmt.Errorf("species %s: %w", species.ID, err)
	}
	return species, nil
}

// DecodePublishedSpecies reads one served species document: its record must
// pass the record schema the host checks responses against, belong to it, and
// name its size as the Engine reads it.
func DecodePublishedSpecies(body []byte) (PublishedSpecies, error) {
	if err := ValidateContract(PublishedSpeciesContract, body); err != nil {
		return PublishedSpecies{}, fmt.Errorf("published species %s", err)
	}
	var published PublishedSpecies
	if err := json.Unmarshal(body, &published); err != nil {
		return PublishedSpecies{}, fmt.Errorf("published species is malformed: %w", err)
	}
	var record struct {
		ID          string    `json:"id"`
		Size        string    `json:"size"`
		SizeOptions []string  `json:"sizeOptions"`
		Lineages    []Lineage `json:"lineages"`
	}
	if err := json.Unmarshal(published.Record, &record); err != nil {
		return PublishedSpecies{}, errors.New("a published species record is malformed")
	}
	if published.ID != IDPrefix+published.SpeciesID || record.ID != published.ID {
		return PublishedSpecies{}, fmt.Errorf("published species %q does not match its species id", published.ID)
	}
	if err := distinctLineages(record.Lineages); err != nil {
		return PublishedSpecies{}, fmt.Errorf("published species %s: %w", published.ID, err)
	}
	// The Engine reads size only without options, so alone it is one size
	// label; with options it is their summary, "Small or Medium".
	if fixed := len(record.SizeOptions) == 0; fixed && !slices.Contains(speciesSizes, record.Size) ||
		!fixed && record.Size != strings.Join(record.SizeOptions, " or ") {
		return PublishedSpecies{}, fmt.Errorf("published species %s: its size does not match its size options", published.ID)
	}
	return published, nil
}

var speciesSizes = []string{"Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"}

// distinctLineages: the Engine matches a character's lineage by id, so two
// lineages may not share one.
func distinctLineages(lineages []Lineage) error {
	seen := map[string]bool{}
	for index, lineage := range lineages {
		if seen[lineage.ID] {
			return fmt.Errorf("lineage %d repeats the id %s", index+1, lineage.ID)
		}
		seen[lineage.ID] = true
	}
	return nil
}
