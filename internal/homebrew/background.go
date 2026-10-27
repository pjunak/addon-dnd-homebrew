package homebrew

import (
	"encoding/json"
	"errors"
	"fmt"
)

// A background draft publishes as one Engine `background` record in the
// Compendium's shape: three abilities to raise, an origin feat, skill and tool
// proficiencies and the Engine's grants. The contracts state every rule but
// one, checked below. src/model.ts enforces the same rules.

const (
	BackgroundsCollection          = "homebrew_backgrounds"
	PublishedBackgroundsCollection = "homebrew_published_backgrounds"
	BackgroundContract             = "homebrew-background.schema.json"
	PublishedBackgroundContract    = "published-background.schema.json"
	BackgroundRecordKind           = "background"
)

type Background struct {
	ID                 string            `json:"id"`
	SchemaVersion      int               `json:"schemaVersion"`
	Name               string            `json:"name"`
	AbilityScores      []string          `json:"abilityScores"`
	OriginFeat         string            `json:"originFeat"`
	OriginFeatChoices  map[string]string `json:"originFeatChoices,omitempty"`
	SkillProficiencies []string          `json:"skillProficiencies"`
	Tools              []string          `json:"tools"`
	ToolPicks          int               `json:"toolPicks"`
	Equipment          string            `json:"equipment"`
	Grants             map[string]any    `json:"grants,omitempty"`
	Text               string            `json:"text"`
	UpdatedAt          int64             `json:"updatedAt"`
}

// PublishedBackground is the served form of one background draft. Like an
// item, a removed background is withdrawn rather than deleted.
type PublishedBackground struct {
	ID            string          `json:"id"`
	SchemaVersion int             `json:"schemaVersion"`
	BackgroundID  string          `json:"backgroundId"`
	Withdrawn     bool            `json:"withdrawn"`
	Record        json.RawMessage `json:"record"`
}

// DecodeBackground checks a stored or imported background draft against its
// contract and the rule a schema cannot state.
func DecodeBackground(body []byte) (Background, error) {
	if err := ValidateContract(BackgroundContract, body); err != nil {
		return Background{}, fmt.Errorf("background %s", err)
	}
	var background Background
	if err := json.Unmarshal(body, &background); err != nil {
		return Background{}, fmt.Errorf("background is malformed: %w", err)
	}
	// A player picks fewer tools than the background lists; one tool, or
	// none, is given outright.
	if picks, listed := background.ToolPicks, len(background.Tools); listed < 2 && picks != 1 || listed >= 2 && picks >= listed {
		return Background{}, fmt.Errorf("background %s: the player picks fewer tools than it lists", background.ID)
	}
	return background, nil
}

// DecodePublishedBackground reads one served background document: its record
// must pass the record schema the host checks responses against, belong to
// it, and offer fewer tools than it lists.
func DecodePublishedBackground(body []byte) (PublishedBackground, error) {
	if err := ValidateContract(PublishedBackgroundContract, body); err != nil {
		return PublishedBackground{}, fmt.Errorf("published background %s", err)
	}
	var published PublishedBackground
	if err := json.Unmarshal(body, &published); err != nil {
		return PublishedBackground{}, fmt.Errorf("published background is malformed: %w", err)
	}
	var record struct {
		ID     string `json:"id"`
		Choice *struct {
			Count int      `json:"count"`
			From  []string `json:"from"`
		} `json:"toolProficiencyChoice"`
	}
	if err := json.Unmarshal(published.Record, &record); err != nil {
		return PublishedBackground{}, errors.New("a published background record is malformed")
	}
	if published.ID != IDPrefix+published.BackgroundID || record.ID != published.ID {
		return PublishedBackground{}, fmt.Errorf("published background %q does not match its background id", published.ID)
	}
	if record.Choice != nil && record.Choice.Count >= len(record.Choice.From) {
		return PublishedBackground{}, fmt.Errorf("published background %s: the player picks fewer tools than it lists", published.ID)
	}
	return published, nil
}
