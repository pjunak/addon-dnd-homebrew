package homebrew

import (
	"encoding/json"
	"errors"
	"fmt"
)

// A feat draft publishes as one Engine `feat` record. Its grants are the
// Engine's vocabulary and its prerequisite the Engine's predicates, kept as
// JSON and checked against the contracts plus the rules below, so the editor
// and the importer accept exactly what the host serves. src/model.ts enforces
// the same rules.

const (
	FeatsCollection          = "homebrew_feats"
	PublishedFeatsCollection = "homebrew_published_feats"
	FeatContract             = "homebrew-feat.schema.json"
	PublishedFeatContract    = "published-feat.schema.json"
	FeatRecordKind           = "feat"
	// maxPrerequisiteDepth bounds how deep any and all nest.
	maxPrerequisiteDepth = 3
)

type Feat struct {
	ID            string          `json:"id"`
	SchemaVersion int             `json:"schemaVersion"`
	Name          string          `json:"name"`
	Category      string          `json:"category"`
	Prerequisites map[string]any  `json:"prerequisites"`
	Repeatable    json.RawMessage `json:"repeatable"`
	Grants        map[string]any  `json:"grants,omitempty"`
	UpdatedAt     int64           `json:"updatedAt"`
}

// PublishedFeat is the served form of one feat draft. Like an item, a removed
// feat is withdrawn rather than deleted.
type PublishedFeat struct {
	ID            string          `json:"id"`
	SchemaVersion int             `json:"schemaVersion"`
	FeatID        string          `json:"featId"`
	Withdrawn     bool            `json:"withdrawn"`
	Record        json.RawMessage `json:"record"`
}

// DecodeFeat checks a stored or imported feat draft against its contract and
// the rules a schema cannot state.
func DecodeFeat(body []byte) (Feat, error) {
	if err := ValidateContract(FeatContract, body); err != nil {
		return Feat{}, fmt.Errorf("feat %s", err)
	}
	var feat Feat
	if err := json.Unmarshal(body, &feat); err != nil {
		return Feat{}, fmt.Errorf("feat is malformed: %w", err)
	}
	if err := featRules(feat.Prerequisites, feat.Repeatable, feat.Grants); err != nil {
		return Feat{}, fmt.Errorf("feat %s: %w", feat.ID, err)
	}
	return feat, nil
}

// DecodePublishedFeat reads one served feat document: its record must pass
// the record schema the host checks responses against and belong to it.
func DecodePublishedFeat(body []byte) (PublishedFeat, error) {
	if err := ValidateContract(PublishedFeatContract, body); err != nil {
		return PublishedFeat{}, fmt.Errorf("published feat %s", err)
	}
	var published PublishedFeat
	if err := json.Unmarshal(body, &published); err != nil {
		return PublishedFeat{}, fmt.Errorf("published feat is malformed: %w", err)
	}
	var record struct {
		ID            string          `json:"id"`
		Prerequisites map[string]any  `json:"prerequisites"`
		Repeatable    json.RawMessage `json:"repeatable"`
		Grants        map[string]any  `json:"grants"`
	}
	if err := json.Unmarshal(published.Record, &record); err != nil {
		return PublishedFeat{}, errors.New("a published feat record is malformed")
	}
	if published.ID != IDPrefix+published.FeatID || record.ID != published.ID {
		return PublishedFeat{}, fmt.Errorf("published feat %q does not match its feat id", published.ID)
	}
	if err := featRules(record.Prerequisites, record.Repeatable, record.Grants); err != nil {
		return PublishedFeat{}, fmt.Errorf("published feat %s: %w", published.ID, err)
	}
	return published, nil
}

// featRules are what the contracts cannot state: how deep a prerequisite
// nests, and that a feat repeated once per choice names one of its own
// enumerated choices of one listed value, as the Engine requires.
func featRules(prerequisites map[string]any, repeatable json.RawMessage, grants map[string]any) error {
	if prerequisiteDepth(prerequisites) > maxPrerequisiteDepth {
		return fmt.Errorf("prerequisites nest any and all at most %d deep", maxPrerequisiteDepth)
	}
	var policy struct {
		By     string `json:"by"`
		Choice string `json:"choice"`
	}
	if json.Unmarshal(repeatable, &policy) != nil || policy.By != "choice" {
		return nil
	}
	choices, _ := grants["choices"].([]any)
	for _, raw := range choices {
		choice, _ := raw.(map[string]any)
		from, _ := choice["from"].([]any)
		if choice["id"] == policy.Choice && choice["type"] == "enumerated" && choice["count"] == float64(1) && len(from) > 0 {
			return nil
		}
	}
	return errors.New("repeating once per choice needs one of the feat's choices, of one listed value")
}

func prerequisiteDepth(value map[string]any) int {
	deepest := 0
	for _, key := range []string{"any", "all"} {
		list, _ := value[key].([]any)
		for _, raw := range list {
			if child, ok := raw.(map[string]any); ok {
				deepest = max(deepest, 1+prerequisiteDepth(child))
			}
		}
	}
	return deepest
}
