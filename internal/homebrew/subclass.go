package homebrew

import (
	"encoding/json"
	"errors"
	"fmt"
)

// A subclass draft holds its features; publishing turns it into one Engine
// `subclass` record and one `feature` record per feature. Its mechanics are
// the Engine's grants vocabulary, kept as JSON and checked against the
// contracts, so the editor and the importer accept exactly what the host
// serves. src/model.ts enforces the same rules.

const (
	SubclassesCollection          = "homebrew_subclasses"
	PublishedSubclassesCollection = "homebrew_published_subclasses"
	SubclassContract              = "homebrew-subclass.schema.json"
	PublishedSubclassContract     = "published-subclass.schema.json"
)

type Feature struct {
	ID      string         `json:"id"`
	Level   int            `json:"level"`
	Name    string         `json:"name"`
	Text    string         `json:"text"`
	Excerpt string         `json:"excerpt"`
	Grants  map[string]any `json:"grants,omitempty"`
}

type Subclass struct {
	ID            string    `json:"id"`
	SchemaVersion int       `json:"schemaVersion"`
	Name          string    `json:"name"`
	ClassID       string    `json:"classId"`
	SubclassLevel int       `json:"subclassLevel"`
	Features      []Feature `json:"features"`
	UpdatedAt     int64     `json:"updatedAt"`
}

// PublishedSubclass is the served form of one subclass draft: its subclass
// record first, then its feature records. Like an item, a removed subclass is
// withdrawn rather than deleted.
type PublishedSubclass struct {
	ID            string            `json:"id"`
	SchemaVersion int               `json:"schemaVersion"`
	SubclassID    string            `json:"subclassId"`
	ClassID       string            `json:"classId"`
	Withdrawn     bool              `json:"withdrawn"`
	Records       []json.RawMessage `json:"records"`
}

// DecodeSubclass checks a stored or imported subclass draft against its
// contract and the rules a schema cannot state.
func DecodeSubclass(body []byte) (Subclass, error) {
	if err := ValidateContract(SubclassContract, body); err != nil {
		return Subclass{}, fmt.Errorf("subclass %s", err)
	}
	var subclass Subclass
	if err := json.Unmarshal(body, &subclass); err != nil {
		return Subclass{}, fmt.Errorf("subclass is malformed: %w", err)
	}
	seen := map[string]bool{}
	for index, feature := range subclass.Features {
		if seen[feature.ID] {
			return Subclass{}, fmt.Errorf("subclass %s: feature %d repeats the id %s", subclass.ID, index+1, feature.ID)
		}
		seen[feature.ID] = true
	}
	return subclass, nil
}

// FeatureRecordID names a feature record after its subclass record. Ids never
// contain a dot, so two subclasses cannot produce the same feature id.
func FeatureRecordID(subclassRecordID, featureID string) string {
	return subclassRecordID + "." + featureID
}

// DecodePublishedSubclass reads one served subclass document: its records
// must pass the record schema the host checks responses against, and belong
// together.
func DecodePublishedSubclass(body []byte) (PublishedSubclass, error) {
	if err := ValidateContract(PublishedSubclassContract, body); err != nil {
		return PublishedSubclass{}, fmt.Errorf("published subclass %s", err)
	}
	var published PublishedSubclass
	if err := json.Unmarshal(body, &published); err != nil {
		return PublishedSubclass{}, fmt.Errorf("published subclass is malformed: %w", err)
	}
	if published.ID != IDPrefix+published.SubclassID {
		return PublishedSubclass{}, fmt.Errorf("published subclass %q does not match its subclass id", published.ID)
	}
	seen := map[string]bool{}
	for index, raw := range published.Records {
		var record struct {
			Kind       string `json:"kind"`
			ID         string `json:"id"`
			ClassID    string `json:"classId"`
			SubclassID string `json:"subclassId"`
			LocalID    string `json:"localId"`
		}
		if err := json.Unmarshal(raw, &record); err != nil {
			return PublishedSubclass{}, errors.New("a published subclass record is malformed")
		}
		var problem string
		switch {
		case record.ClassID != published.ClassID:
			problem = "names another class"
		case index == 0 && (record.Kind != "subclass" || record.ID != published.ID):
			problem = "must be the subclass record"
		case index > 0 && (record.Kind != "feature" || record.SubclassID != published.ID || record.ID != FeatureRecordID(published.ID, record.LocalID)):
			problem = "must be one of the subclass's features"
		case seen[record.ID]:
			problem = "repeats a record id"
		}
		if problem != "" {
			return PublishedSubclass{}, fmt.Errorf("published subclass %s: record %d %s", published.ID, index+1, problem)
		}
		seen[record.ID] = true
	}
	return published, nil
}
