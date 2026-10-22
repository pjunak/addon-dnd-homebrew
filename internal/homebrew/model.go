// Package homebrew holds the stored shapes of item sets, item drafts and
// published magic-item records, and the checks that keep them acceptable to
// the D&D Engine. contracts/*.schema.json is the host-enforced form of the
// same rules; this package adds the cross-field rules a schema cannot state.
package homebrew

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/pjunak/addon-dnd-homebrew/internal/jsonexact"
)

const (
	SchemaVersion       = 1
	IDPrefix            = "hb."
	SetsCollection      = "homebrew_sets"
	ItemsCollection     = "homebrew_items"
	PublishedCollection = "homebrew_published"
	MetaCollection      = "homebrew_meta"
	MetaKey             = "publish"
	RecordKind          = "magic-item"
	RecordEdition       = "2024"
	RecordBook          = "homebrew"
	MaxEffects          = 40
	MaxMarkdown         = 20000
)

var (
	Abilities      = []string{"STR", "DEX", "CON", "INT", "WIS", "CHA"}
	Skills         = []string{"acrobatics", "animalHandling", "arcana", "athletics", "deception", "history", "insight", "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightOfHand", "stealth", "survival"}
	Rarities       = []string{"Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Rarity Varies"}
	BodyPlacements = []string{"head", "body", "wrists", "legs", "feet", "face", "neck", "shoulders", "waist", "gloves", "other"}
	Modes          = []string{"set", "add", "minimum", "maximum"}
)

// Effect is the Engine's character effect: a whole-number change to one
// derived value while the item is equipped (and attuned when it requires it).
type Effect struct {
	Target string `json:"target"`
	Key    string `json:"key,omitempty"`
	Mode   string `json:"mode"`
	Value  int    `json:"value"`
}

type ItemSet struct {
	ID             string   `json:"id"`
	SchemaVersion  int      `json:"schemaVersion"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	Curse          string   `json:"curse"`
	ItemType       string   `json:"itemType"`
	Rarity         string   `json:"rarity"`
	Attunement     bool     `json:"attunement"`
	BodyPlacements []string `json:"bodyPlacements"`
	Tags           []string `json:"tags"`
	NamePrefix     string   `json:"namePrefix"`
	PlayerVisible  bool     `json:"playerVisible"`
	UpdatedAt      int64    `json:"updatedAt"`
	// Condition is given by every item of the set; its level on a sheet is
	// the number of the set's items in effect.
	Condition *Condition `json:"condition,omitempty"`
	// WeightLb is each item's weight in pounds unless the item overrides it.
	WeightLb *float64 `json:"weightLb,omitempty"`
}

// Overrides replace the set defaults for one item; an absent field inherits.
type Overrides struct {
	ItemType       *string   `json:"itemType,omitempty"`
	Rarity         *string   `json:"rarity,omitempty"`
	Attunement     *bool     `json:"attunement,omitempty"`
	BodyPlacements *[]string `json:"bodyPlacements,omitempty"`
	WeightLb       *float64  `json:"weightLb,omitempty"`
}

type Item struct {
	ID                 string    `json:"id"`
	SchemaVersion      int       `json:"schemaVersion"`
	SetID              string    `json:"setId"`
	Name               string    `json:"name"`
	Text               string    `json:"text"`
	Overrides          Overrides `json:"overrides"`
	Tags               []string  `json:"tags"`
	CharacterMechanics string    `json:"characterMechanics"`
	CharacterEffects   []Effect  `json:"characterEffects"`
	PlayerVisible      bool      `json:"playerVisible"`
	Retired            bool      `json:"retired"`
	UpdatedAt          int64     `json:"updatedAt"`
	// Grants is absent (nil) or an allowlisted object; see ValidateGrants.
	Grants map[string]any `json:"grants,omitempty"`
	// AttunementPrerequisites is absent (nil) or who may attune; see
	// ValidateRequirement.
	AttunementPrerequisites map[string]any `json:"attunementPrerequisites,omitempty"`
	Container               *Container     `json:"container,omitempty"`
	BaseItem                *BaseItem      `json:"baseItem,omitempty"`
}

// Record is the magic-item record served as dnd5e.rules-data.
type Record struct {
	Kind                    string         `json:"kind"`
	ID                      string         `json:"id"`
	Name                    string         `json:"name"`
	Edition                 string         `json:"edition"`
	Book                    string         `json:"book"`
	ItemType                string         `json:"itemType"`
	Rarity                  string         `json:"rarity"`
	Attunement              bool           `json:"attunement"`
	Tags                    []string       `json:"tags"`
	Text                    string         `json:"text"`
	CharacterMechanics      string         `json:"characterMechanics"`
	CharacterEffects        []Effect       `json:"characterEffects"`
	BodyPlacements          []string       `json:"bodyPlacements,omitempty"`
	Grants                  map[string]any `json:"grants,omitempty"`
	WeightLb                *float64       `json:"weightLb,omitempty"`
	AttunementPrerequisites map[string]any `json:"attunementPrerequisites,omitempty"`
	Container               *Container     `json:"container,omitempty"`
	BaseItem                *BaseItem      `json:"baseItem,omitempty"`
}

// Published is one served record. A removed item is withdrawn rather than
// deleted: browsers cannot learn a deleted key's tombstone revision, so a
// deleted record could never be republished under the same id.
type Published struct {
	ID            string `json:"id"`
	SchemaVersion int    `json:"schemaVersion"`
	ItemID        string `json:"itemId"`
	SetID         string `json:"setId"`
	SetName       string `json:"setName"`
	PlayerVisible bool   `json:"playerVisible"`
	Retired       bool   `json:"retired"`
	Withdrawn     bool   `json:"withdrawn"`
	Record        Record `json:"record"`
}

type Meta struct {
	SchemaVersion int   `json:"schemaVersion"`
	Revision      int64 `json:"revision"`
	PublishedAt   int64 `json:"publishedAt"`
	RecordCount   int   `json:"recordCount"`
}

var setFields = []string{"id", "schemaVersion", "name", "description", "curse", "itemType", "rarity", "attunement", "bodyPlacements", "tags", "namePrefix", "playerVisible", "updatedAt"}
var itemFields = []string{"id", "schemaVersion", "setId", "name", "text", "overrides", "tags", "characterMechanics", "characterEffects", "playerVisible", "retired", "updatedAt"}
var publishedFields = []string{"id", "schemaVersion", "itemId", "setId", "setName", "playerVisible", "retired", "withdrawn", "record"}
var recordFields = []string{"kind", "id", "name", "edition", "book", "itemType", "rarity", "attunement", "tags", "text", "characterMechanics", "characterEffects"}

// DecodeSet reads one stored or imported set exactly.
func DecodeSet(body []byte) (ItemSet, error) {
	var set ItemSet
	if err := decodeExact(body, &set, setFields); err != nil {
		return ItemSet{}, err
	}
	if set.Condition != nil {
		var raw, condition map[string]json.RawMessage
		if json.Unmarshal(body, &raw) != nil || json.Unmarshal(raw["condition"], &condition) != nil {
			return ItemSet{}, errors.New("set condition must be an object")
		}
		if err := requireFields(condition, []string{"id", "name", "summary"}); err != nil {
			return ItemSet{}, fmt.Errorf("set condition: %w", err)
		}
	}
	return set, ValidateSet(set)
}

// DecodeItem reads one stored or imported item draft exactly.
func DecodeItem(body []byte) (Item, error) {
	var item Item
	if err := decodeExact(body, &item, itemFields); err != nil {
		return Item{}, err
	}
	return item, ValidateItem(item)
}

// DecodePublished reads one published record exactly, as the provider serves it.
func DecodePublished(body []byte) (Published, error) {
	var raw map[string]json.RawMessage
	if jsonexact.Decode(body, &raw) != nil {
		return Published{}, errors.New("published record must be one JSON object")
	}
	if err := requireFields(raw, publishedFields); err != nil {
		return Published{}, err
	}
	var record map[string]json.RawMessage
	if jsonexact.Decode(raw["record"], &record) != nil {
		return Published{}, errors.New("published record body must be an object")
	}
	if err := requireFields(record, recordFields); err != nil {
		return Published{}, err
	}
	var published Published
	if err := jsonexact.Decode(body, &published); err != nil {
		return Published{}, fmt.Errorf("published record is malformed: %w", err)
	}
	if err := refuseNull(body); err != nil {
		return Published{}, err
	}
	return published, ValidatePublished(published)
}

func DecodeMeta(body []byte) (Meta, error) {
	var meta Meta
	if err := decodeExact(body, &meta, []string{"schemaVersion", "revision", "publishedAt", "recordCount"}); err != nil {
		return Meta{}, err
	}
	if meta.SchemaVersion != SchemaVersion || meta.Revision < 1 || meta.PublishedAt < 0 || meta.RecordCount < 0 || meta.RecordCount > 10000 {
		return Meta{}, errors.New("publish metadata is invalid")
	}
	return meta, nil
}

func ValidateSet(set ItemSet) error {
	switch {
	case set.SchemaVersion != SchemaVersion:
		return errors.New("set schemaVersion must be 1")
	case !ValidID(set.ID):
		return fmt.Errorf("set id %q must be lowercase words joined by hyphens", set.ID)
	case !validName(set.Name, 120):
		return fmt.Errorf("set %s needs a one-line name of at most 120 characters", set.ID)
	case set.NamePrefix != "" && !validName(set.NamePrefix, 60):
		return fmt.Errorf("set %s name prefix must be one line of at most 60 characters", set.ID)
	case !validMarkdown(set.Description) || !validMarkdown(set.Curse):
		return fmt.Errorf("set %s description and curse are limited to %d characters", set.ID, MaxMarkdown)
	case !validName(set.ItemType, 120):
		return fmt.Errorf("set %s needs an item type", set.ID)
	case !slices.Contains(Rarities, set.Rarity):
		return fmt.Errorf("set %s has an unknown rarity %q", set.ID, set.Rarity)
	case set.UpdatedAt < 0:
		return fmt.Errorf("set %s updatedAt is invalid", set.ID)
	}
	if err := validPlacements(set.BodyPlacements); err != nil {
		return fmt.Errorf("set %s: %w", set.ID, err)
	}
	if err := validTags(set.Tags); err != nil {
		return fmt.Errorf("set %s: %w", set.ID, err)
	}
	if set.Condition != nil {
		if err := ValidateCondition(*set.Condition); err != nil {
			return fmt.Errorf("set %s: %w", set.ID, err)
		}
	}
	if set.WeightLb != nil && !ValidWeight(*set.WeightLb) {
		return fmt.Errorf("set %s: %w", set.ID, errWeight)
	}
	return nil
}

func ValidateItem(item Item) error {
	switch {
	case item.SchemaVersion != SchemaVersion:
		return errors.New("item schemaVersion must be 1")
	case !ValidID(item.ID):
		return fmt.Errorf("item id %q must be lowercase words joined by hyphens", item.ID)
	case item.SetID != "" && !ValidID(item.SetID):
		return fmt.Errorf("item %s has an invalid setId", item.ID)
	case !validName(item.Name, 120):
		return fmt.Errorf("item %s needs a one-line name of at most 120 characters", item.ID)
	case !validMarkdown(item.Text):
		return fmt.Errorf("item %s text is limited to %d characters", item.ID, MaxMarkdown)
	case item.UpdatedAt < 0:
		return fmt.Errorf("item %s updatedAt is invalid", item.ID)
	}
	if overrides := item.Overrides; overrides.ItemType != nil && !validName(*overrides.ItemType, 120) {
		return fmt.Errorf("item %s item type override is invalid", item.ID)
	} else if overrides.Rarity != nil && !slices.Contains(Rarities, *overrides.Rarity) {
		return fmt.Errorf("item %s has an unknown rarity override", item.ID)
	} else if overrides.BodyPlacements != nil {
		if err := validPlacements(*overrides.BodyPlacements); err != nil {
			return fmt.Errorf("item %s: %w", item.ID, err)
		}
	}
	if err := validCarrying(item.Overrides.WeightLb, item.Container, item.AttunementPrerequisites); err != nil {
		return fmt.Errorf("item %s: %w", item.ID, err)
	}
	if err := validTags(item.Tags); err != nil {
		return fmt.Errorf("item %s: %w", item.ID, err)
	}
	if _, exists := item.Grants["conditions"]; exists {
		return fmt.Errorf("item %s: conditions come from the item's set", item.ID)
	}
	if item.BaseItem != nil {
		if err := ValidateBaseItem(*item.BaseItem); err != nil {
			return fmt.Errorf("item %s: %w", item.ID, err)
		}
	}
	if err := ValidateMechanics(item.CharacterMechanics, item.CharacterEffects, item.Grants, item.BaseItem); err != nil {
		return fmt.Errorf("item %s: %w", item.ID, err)
	}
	return nil
}

// ValidatePublished accepts only records the Engine evaluates without a
// source blocker: the hb. namespace, magic-item kind, supported effects and
// allowlisted grants.
func ValidatePublished(published Published) error {
	record := published.Record
	switch {
	case published.SchemaVersion != SchemaVersion:
		return errors.New("published schemaVersion must be 1")
	case !ValidID(published.ItemID) || published.ID != IDPrefix+published.ItemID || record.ID != published.ID:
		return fmt.Errorf("published record %q does not match its item id", published.ID)
	case published.SetID != "" && !ValidID(published.SetID):
		return fmt.Errorf("published record %s has an invalid setId", published.ID)
	case (published.SetID == "") != (published.SetName == "") || published.SetName != "" && !validName(published.SetName, 120):
		return fmt.Errorf("published record %s has an invalid set name", published.ID)
	case record.Kind != RecordKind || record.Edition != RecordEdition || record.Book != RecordBook:
		return fmt.Errorf("published record %s must be a 2024 homebrew magic-item", published.ID)
	case !validName(record.Name, 243):
		return fmt.Errorf("published record %s has an invalid name", published.ID)
	case !validName(record.ItemType, 120) || !slices.Contains(Rarities, record.Rarity):
		return fmt.Errorf("published record %s has an invalid item type or rarity", published.ID)
	case utf8.RuneCountInString(record.Text) > 61000:
		return fmt.Errorf("published record %s text is too long", published.ID)
	case len(record.Tags) > 42 || hasDuplicate(record.Tags):
		return fmt.Errorf("published record %s has invalid tags", published.ID)
	}
	for _, tag := range record.Tags {
		if tag == "" || utf8.RuneCountInString(tag) > 64 {
			return fmt.Errorf("published record %s has an invalid tag", published.ID)
		}
	}
	if record.BodyPlacements != nil {
		if len(record.BodyPlacements) == 0 {
			return fmt.Errorf("published record %s lists no body placements", published.ID)
		}
		if err := validPlacements(record.BodyPlacements); err != nil {
			return fmt.Errorf("published record %s: %w", published.ID, err)
		}
	}
	if err := validCarrying(record.WeightLb, record.Container, record.AttunementPrerequisites); err != nil {
		return fmt.Errorf("published record %s: %w", published.ID, err)
	}
	if record.AttunementPrerequisites != nil && !record.Attunement {
		return fmt.Errorf("published record %s: %w", published.ID, errRequirementNeedsAttunement)
	}
	if record.BaseItem != nil {
		if err := ValidateBaseItem(*record.BaseItem); err != nil {
			return fmt.Errorf("published record %s: %w", published.ID, err)
		}
	}
	if err := ValidateMechanics(record.CharacterMechanics, record.CharacterEffects, record.Grants, record.BaseItem); err != nil {
		return fmt.Errorf("published record %s: %w", published.ID, err)
	}
	return nil
}

// ValidateMechanics mirrors the Engine's item gate: "complete" needs at least
// one supported effect, allowlisted grants or a weapon or armor bonus;
// "narrative" declares none of them, though it may name its base. A nil
// grants map or base means the field is absent.
func ValidateMechanics(mechanics string, effects []Effect, grants map[string]any, base *BaseItem) error {
	bonus := base != nil && base.Bonus != nil
	switch mechanics {
	case "narrative":
		if len(effects) > 0 || grants != nil || bonus {
			return errors.New("a narrative item cannot declare character effects, grants or a bonus")
		}
		return nil
	case "complete":
		if len(effects) == 0 && grants == nil && !bonus {
			return errors.New("an automated item needs at least one character effect, grant or bonus")
		}
	default:
		return errors.New(`characterMechanics must be "complete" or "narrative"`)
	}
	if grants != nil {
		if err := ValidateGrants(grants); err != nil {
			return err
		}
	}
	if len(effects) > MaxEffects {
		return fmt.Errorf("an item declares at most %d effects", MaxEffects)
	}
	seen := make(map[Effect]bool, len(effects))
	sets := make(map[string]bool)
	bounds := make(map[string][2]int)
	for index, effect := range effects {
		if err := ValidateEffect(effect); err != nil {
			return fmt.Errorf("effect %d: %w", index+1, err)
		}
		if seen[effect] {
			return fmt.Errorf("effect %d repeats an earlier effect", index+1)
		}
		seen[effect] = true
		if effect.Target == "proficiency" {
			continue
		}
		slot := effect.Target + ":" + effect.Key
		switch effect.Mode {
		case "set":
			if sets[slot] {
				return fmt.Errorf("effect %d sets %s twice", index+1, describeSlot(effect))
			}
			sets[slot] = true
		case "minimum", "maximum":
			limits, exists := bounds[slot]
			if !exists {
				limits = [2]int{-1_000_000, 1_000_000}
			}
			if effect.Mode == "minimum" {
				limits[0] = max(limits[0], effect.Value)
			} else {
				limits[1] = min(limits[1], effect.Value)
			}
			if limits[0] > limits[1] {
				return fmt.Errorf("effect %d makes the minimum of %s exceed its maximum", index+1, describeSlot(effect))
			}
			bounds[slot] = limits
		}
	}
	return nil
}

// ValidateEffect is the Engine's validCharacterEffect plus its proficiency rule.
func ValidateEffect(effect Effect) error {
	if !slices.Contains(Modes, effect.Mode) {
		return fmt.Errorf("mode %q is not set, add, minimum or maximum", effect.Mode)
	}
	if effect.Value < -100000 || effect.Value > 100000 {
		return errors.New("value must be a whole number between -100000 and 100000")
	}
	switch effect.Target {
	case "abilityScore", "abilityCap", "savingThrow":
		if !slices.Contains(Abilities, effect.Key) {
			return fmt.Errorf("%s needs an ability key (STR, DEX, CON, INT, WIS or CHA)", effect.Target)
		}
	case "armorClass", "initiative", "speed", "maxHp", "attunementLimit":
		if effect.Key != "" {
			return fmt.Errorf("%s takes no key", effect.Target)
		}
	case "proficiency":
		if !slices.Contains(Skills, effect.Key) && !slices.Contains(Abilities, effect.Key) {
			return errors.New("proficiency needs a skill or saving-throw ability key")
		}
		if effect.Mode != "set" || effect.Value != 1 {
			return errors.New("proficiency must use mode set with value 1")
		}
	case "sense", "resourceMax":
		if !validEffectKey(effect.Key) {
			return fmt.Errorf("%s needs a key such as darkvision", effect.Target)
		}
	default:
		return fmt.Errorf("target %q is not supported", effect.Target)
	}
	return nil
}

func ValidID(value string) bool {
	if len(value) < 1 || len(value) > 64 || value[0] == '-' || value[len(value)-1] == '-' || strings.Contains(value, "--") {
		return false
	}
	for _, character := range value {
		if !(character >= 'a' && character <= 'z' || character >= '0' && character <= '9' || character == '-') {
			return false
		}
	}
	return true
}

func validEffectKey(value string) bool {
	if len(value) < 1 || len(value) > 60 || value[0] < 'a' || value[0] > 'z' {
		return false
	}
	separator := false
	for _, character := range value[1:] {
		alphanumeric := character >= 'a' && character <= 'z' || character >= 'A' && character <= 'Z' || character >= '0' && character <= '9'
		if alphanumeric {
			separator = false
			continue
		}
		if (character == '-' || character == '_') && !separator {
			separator = true
			continue
		}
		return false
	}
	return !separator
}

func validName(value string, limit int) bool {
	if value == "" || utf8.RuneCountInString(value) > limit || strings.ContainsAny(value, "\n\r\u2028\u2029") {
		return false
	}
	first, _ := utf8.DecodeRuneInString(value)
	last, _ := utf8.DecodeLastRuneInString(value)
	return !unicode.IsSpace(first) && !unicode.IsSpace(last)
}

func validMarkdown(value string) bool {
	return utf8.RuneCountInString(value) <= MaxMarkdown
}

func validPlacements(values []string) error {
	if len(values) > len(BodyPlacements) || hasDuplicate(values) {
		return errors.New("body placements must be distinct")
	}
	for _, value := range values {
		if !slices.Contains(BodyPlacements, value) {
			return fmt.Errorf("body placement %q is not supported", value)
		}
	}
	return nil
}

func validTags(values []string) error {
	if len(values) > 20 || hasDuplicate(values) {
		return errors.New("tags must be at most 20 distinct values")
	}
	for _, value := range values {
		if len(value) > 60 || !ValidID(value) {
			return fmt.Errorf("tag %q must be lowercase words joined by hyphens", value)
		}
	}
	return nil
}

func hasDuplicate[T comparable](values []T) bool {
	seen := make(map[T]bool, len(values))
	for _, value := range values {
		if seen[value] {
			return true
		}
		seen[value] = true
	}
	return false
}

func describeSlot(effect Effect) string {
	if effect.Key == "" {
		return effect.Target
	}
	return effect.Target + " " + effect.Key
}

func decodeExact(body []byte, target any, required []string) error {
	var raw map[string]json.RawMessage
	if jsonexact.Decode(body, &raw) != nil {
		return errors.New("value must be one JSON object")
	}
	if err := requireFields(raw, required); err != nil {
		return err
	}
	if err := jsonexact.Decode(body, target); err != nil {
		return fmt.Errorf("value is malformed: %w", err)
	}
	return refuseNull(body)
}

func refuseNull(body []byte) error {
	var value any
	if json.Unmarshal(body, &value) != nil || hasNull(value) {
		return errors.New("value must not contain null")
	}
	return nil
}

func requireFields(raw map[string]json.RawMessage, required []string) error {
	for _, field := range required {
		if value, exists := raw[field]; !exists || string(value) == "null" {
			return fmt.Errorf("missing field %q", field)
		}
	}
	return nil
}
