package homebrew

import (
	"errors"
	"fmt"
	"math"
	"slices"
	"sort"
	"strings"
	"unicode/utf8"
)

// Grants are what an item does besides fixed numbers: the feature `grants`
// vocabulary of the D&D Engine (5.4 and later), limited to the allowlist
// below. They stay untyped JSON so a draft is stored and served exactly as
// written; src/model.ts grantsProblem enforces the same rules.

var (
	AdvantageRolls  = []string{"save", "check", "attack", "initiative", "concentration", "deathSave"}
	DamageTypes     = []string{"acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"}
	ConditionIDs    = []string{"blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"}
	SpellSchools    = []string{"abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"}
	ModifierTargets = []string{"advantage", "sense", "senseBonus", "resistance", "conditionImmunity", "damageImmunity"}
	grantFields     = []string{"advantages", "castingAbility", "resources", "spells", "activations", "resistances", "damageImmunities", "conditionImmunities", "conditions"}
)

const MaxConditionSummary = 2000

// Condition is a level-counted condition an item gives: the set condition
// of a draft, and each grants.conditions entry of a published record.
type Condition struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Summary string `json:"summary"`
}

// ValidateGrants checks a published record's grants against the Engine
// allowlist. A draft's grants also may not declare conditions; those come
// from its set.
func ValidateGrants(grants map[string]any) error {
	if len(grants) == 0 {
		return errors.New("grants must declare something; leave the field out instead")
	}
	for _, key := range sortedKeys(grants) {
		if !slices.Contains(grantFields, key) {
			return fmt.Errorf("grants.%s is not supported", key)
		}
	}
	resources := map[string]int{}
	if raw, exists := grants["resources"]; exists {
		entries, err := entries(raw, "resources", 10)
		if err != nil {
			return err
		}
		for index, raw := range entries {
			key, fixed, err := validResource(raw)
			if err != nil {
				return fmt.Errorf("use %d: %w", index+1, err)
			}
			if _, repeated := resources[key]; repeated {
				return fmt.Errorf("use %d repeats the key %s", index+1, key)
			}
			resources[key] = fixed
		}
	}
	if raw, exists := grants["advantages"]; exists {
		entries, err := entries(raw, "advantages", 20)
		if err != nil {
			return err
		}
		for index, raw := range entries {
			entry, ok := raw.(map[string]any)
			if !ok {
				return fmt.Errorf("advantage %d must be an object", index+1)
			}
			if err := validAdvantage(entry, false); err != nil {
				return fmt.Errorf("advantage %d: %w", index+1, err)
			}
		}
	}
	if raw, exists := grants["castingAbility"]; exists {
		if err := validCastingAbility(raw); err != nil {
			return err
		}
		if _, hasSpells := grants["spells"]; !hasSpells {
			return errors.New("a spellcasting ability needs a spell")
		}
	}
	if raw, exists := grants["spells"]; exists {
		entries, err := entries(raw, "spells", 20)
		if err != nil {
			return err
		}
		choices := map[string]bool{}
		for index, raw := range entries {
			id, err := validSpell(raw, resources)
			if err != nil {
				return fmt.Errorf("spell %d: %w", index+1, err)
			}
			if id != "" && choices[id] {
				return fmt.Errorf("spell %d repeats the choice id %s", index+1, id)
			}
			choices[id] = true
		}
	}
	if raw, exists := grants["activations"]; exists {
		entries, err := entries(raw, "activations", 10)
		if err != nil {
			return err
		}
		ids := map[string]bool{}
		for index, raw := range entries {
			id, err := validActivation(raw)
			if err != nil {
				return fmt.Errorf("toggle %d: %w", index+1, err)
			}
			if ids[id] {
				return fmt.Errorf("toggle %d repeats the id %s", index+1, id)
			}
			ids[id] = true
		}
	}
	for _, field := range []string{"resistances", "damageImmunities"} {
		if raw, exists := grants[field]; exists {
			if err := validChoices(raw, DamageTypes); err != nil {
				return fmt.Errorf("%s: %w", field, err)
			}
		}
	}
	if raw, exists := grants["conditionImmunities"]; exists {
		if err := validChoices(raw, ConditionIDs); err != nil {
			return fmt.Errorf("conditionImmunities: %w", err)
		}
	}
	if raw, exists := grants["conditions"]; exists {
		entries, err := entries(raw, "conditions", 10)
		if err != nil {
			return err
		}
		ids := map[string]bool{}
		for index, raw := range entries {
			condition, err := conditionOf(raw)
			if err == nil {
				err = ValidateCondition(condition)
			}
			if err != nil {
				return fmt.Errorf("condition %d: %w", index+1, err)
			}
			if ids[condition.ID] {
				return fmt.Errorf("condition %d repeats the id %s", index+1, condition.ID)
			}
			ids[condition.ID] = true
		}
	}
	return nil
}

// ValidateCondition accepts a granted condition. A standard condition id is
// refused: a granted row has no automated effect and would read as the real
// condition.
func ValidateCondition(condition Condition) error {
	switch {
	case !ValidID(condition.ID):
		return fmt.Errorf("condition id %q must be lowercase words joined by hyphens", condition.ID)
	case slices.Contains(ConditionIDs, condition.ID):
		return fmt.Errorf("condition id %q is a standard condition", condition.ID)
	case !validName(condition.Name, 120):
		return errors.New("a condition needs a one-line name of at most 120 characters")
	case utf8.RuneCountInString(condition.Summary) > MaxConditionSummary:
		return fmt.Errorf("a condition summary is limited to %d characters", MaxConditionSummary)
	}
	return nil
}

func validResource(raw any) (string, int, error) {
	entry, err := fields(raw, []string{"key", "name", "fixed", "recharge"}, []string{"key", "name", "fixed", "recharge"})
	if err != nil {
		return "", 0, err
	}
	key, _ := entry["key"].(string)
	name, _ := entry["name"].(string)
	fixed, isInteger := integerIn(entry["fixed"], 1, 100)
	switch {
	case !ValidID(key):
		return "", 0, errors.New("the key must be lowercase words joined by hyphens")
	case !validName(name, 120):
		return "", 0, errors.New("a use needs a one-line name of at most 120 characters")
	case !isInteger:
		return "", 0, errors.New("the count must be a whole number from 1 to 100")
	case entry["recharge"] != "short" && entry["recharge"] != "long":
		return "", 0, errors.New(`recharge must be "short" or "long"`)
	}
	return key, fixed, nil
}

func validAdvantage(entry map[string]any, modifier bool) error {
	allowed := []string{"on", "mode", "abilities", "skills", "when"}
	if modifier {
		allowed = append(allowed, "target")
	}
	if _, err := fields(entry, allowed, []string{"on"}); err != nil {
		return err
	}
	on, _ := entry["on"].(string)
	if !slices.Contains(AdvantageRolls, on) {
		return errors.New("on must be save, check, attack, initiative, concentration or deathSave")
	}
	if mode, exists := entry["mode"]; exists && mode != "advantage" && mode != "disadvantage" {
		return errors.New(`mode must be "advantage" or "disadvantage"`)
	}
	if raw, exists := entry["abilities"]; exists {
		if on != "save" && on != "check" {
			return errors.New("abilities narrow only saving throws and ability checks")
		}
		if err := validChoices(raw, Abilities); err != nil {
			return fmt.Errorf("abilities: %w", err)
		}
	}
	if raw, exists := entry["skills"]; exists {
		if on != "check" {
			return errors.New("skills narrow only ability checks")
		}
		if err := validChoices(raw, Skills); err != nil {
			return fmt.Errorf("skills: %w", err)
		}
	}
	if raw, exists := entry["when"]; exists {
		if when, _ := raw.(string); !validName(when, 200) {
			return errors.New("when must be one line of at most 200 characters")
		}
	}
	return nil
}

func validCastingAbility(raw any) error {
	entry, ok := raw.(map[string]any)
	if !ok {
		return errors.New("castingAbility must be an object")
	}
	if _, fixed := entry["fixed"]; fixed {
		if _, err := fields(entry, []string{"fixed"}, []string{"fixed"}); err != nil {
			return fmt.Errorf("castingAbility: %w", err)
		}
		if ability, _ := entry["fixed"].(string); !slices.Contains(Abilities, ability) {
			return errors.New("castingAbility.fixed must be an ability")
		}
		return nil
	}
	if _, err := fields(entry, []string{"id", "choose"}, []string{"id", "choose"}); err != nil {
		return fmt.Errorf("castingAbility: %w", err)
	}
	if id, _ := entry["id"].(string); !ValidID(id) {
		return errors.New("castingAbility.id must be lowercase words joined by hyphens")
	}
	if err := validChoices(entry["choose"], Abilities); err != nil {
		return fmt.Errorf("castingAbility.choose: %w", err)
	}
	return nil
}

// validSpell returns the choice id of a choice entry, or "" for named spells.
func validSpell(raw any, resources map[string]int) (string, error) {
	entry, ok := raw.(map[string]any)
	if !ok {
		return "", errors.New("must be an object")
	}
	id := ""
	if _, named := entry["ids"]; named {
		if _, err := fields(entry, []string{"ids", "resource", "atWill"}, []string{"ids"}); err != nil {
			return "", err
		}
		if err := validSpellRefs(entry["ids"], 20); err != nil {
			return "", fmt.Errorf("ids: %w", err)
		}
	} else {
		if _, err := fields(entry, []string{"id", "choose", "spellLevel", "maxSpellLevel", "from", "resource", "atWill"}, []string{"id", "choose"}); err != nil {
			return "", err
		}
		id, _ = entry["id"].(string)
		if !ValidID(id) {
			return "", errors.New("id must be lowercase words joined by hyphens")
		}
		if _, isInteger := integerIn(entry["choose"], 1, 10); !isInteger {
			return "", errors.New("choose must be a whole number from 1 to 10")
		}
		_, exact := entry["spellLevel"]
		_, highest := entry["maxSpellLevel"]
		if exact == highest {
			return "", errors.New("a spell choice needs exactly one of spellLevel and maxSpellLevel")
		}
		level, isInteger := integerIn(entry["spellLevel"], 0, 9)
		if highest {
			level, isInteger = integerIn(entry["maxSpellLevel"], 0, 9)
		}
		if !isInteger {
			return "", errors.New("the spell level must be a whole number from 0 to 9")
		}
		if raw, exists := entry["from"]; exists {
			if err := validSpellFilter(raw); err != nil {
				return "", fmt.Errorf("from: %w", err)
			}
		}
		_, resource := entry["resource"]
		_, atWill := entry["atWill"]
		if level > 0 && !resource && !atWill {
			return "", errors.New("a leveled spell choice needs a resource or atWill")
		}
	}
	if raw, exists := entry["resource"]; exists {
		if err := validSpellResource(raw, resources); err != nil {
			return "", err
		}
		if _, atWill := entry["atWill"]; atWill {
			return "", errors.New("a spell spends a resource or is cast at will, not both")
		}
	}
	if raw, exists := entry["atWill"]; exists && raw != true {
		return "", errors.New("atWill must be true when present")
	}
	return id, nil
}

func validSpellResource(raw any, resources map[string]int) error {
	key, isKey := raw.(string)
	cost := 1
	if !isKey {
		entry, err := fields(raw, []string{"key", "cost"}, []string{"key"})
		if err != nil {
			return fmt.Errorf("resource: %w", err)
		}
		key, _ = entry["key"].(string)
		if value, exists := entry["cost"]; exists {
			var isInteger bool
			if cost, isInteger = integerIn(value, 1, 100); !isInteger {
				return errors.New("resource.cost must be a whole number from 1 to 100")
			}
		}
	}
	fixed, declared := resources[key]
	if !declared {
		return fmt.Errorf("resource %q is not one of this item's uses", key)
	}
	if cost > fixed {
		return fmt.Errorf("resource.cost %d is more than the %d uses of %s", cost, fixed, key)
	}
	return nil
}

func validSpellFilter(raw any) error {
	entry, err := fields(raw, []string{"class", "school", "ids", "ritual"}, nil)
	if err != nil {
		return err
	}
	if len(entry) == 0 {
		return errors.New("a spell filter needs class, school, ids or ritual")
	}
	if value, exists := entry["class"]; exists {
		if err := validIDs(value, 20); err != nil {
			return fmt.Errorf("class: %w", err)
		}
	}
	if value, exists := entry["school"]; exists {
		if err := validChoices(value, SpellSchools); err != nil {
			return fmt.Errorf("school: %w", err)
		}
	}
	if value, exists := entry["ids"]; exists {
		if err := validSpellRefs(value, 20); err != nil {
			return fmt.Errorf("ids: %w", err)
		}
	}
	if value, exists := entry["ritual"]; exists && value != true {
		return errors.New("ritual must be true when present")
	}
	return nil
}

func validActivation(raw any) (string, error) {
	entry, err := fields(raw, []string{"id", "name", "condition", "modifiers"}, []string{"id", "name", "modifiers"})
	if err != nil {
		return "", err
	}
	id, _ := entry["id"].(string)
	name, _ := entry["name"].(string)
	switch {
	case !ValidID(id):
		return "", errors.New("the id must be lowercase words joined by hyphens")
	case !validName(name, 120):
		return "", errors.New("a toggle needs a one-line name of at most 120 characters")
	}
	if raw, exists := entry["condition"]; exists {
		if condition, _ := raw.(string); !validName(condition, 200) {
			return "", errors.New("condition must be one line of at most 200 characters")
		}
	}
	modifiers, err := entries(entry["modifiers"], "modifiers", 20)
	if err != nil {
		return "", err
	}
	for index, raw := range modifiers {
		if err := validModifier(raw); err != nil {
			return "", fmt.Errorf("change %d: %w", index+1, err)
		}
	}
	return id, nil
}

func validModifier(raw any) error {
	entry, ok := raw.(map[string]any)
	if !ok {
		return errors.New("must be an object")
	}
	target, _ := entry["target"].(string)
	switch target {
	case "advantage":
		return validAdvantage(entry, true)
	case "sense", "senseBonus":
		amount := "value"
		if target == "senseBonus" {
			amount = "add"
		}
		if _, err := fields(entry, []string{"target", "key", amount}, []string{"target", "key", amount}); err != nil {
			return err
		}
		// The Engine reads a granted sense key as an id, stricter than an effect key.
		if !ValidID(stringOf(entry["key"])) {
			return fmt.Errorf("%s needs a key such as darkvision", target)
		}
		if _, isInteger := integerIn(entry[amount], 1, 1000); !isInteger {
			return fmt.Errorf("%s %s must be a whole number of feet from 1 to 1000", target, amount)
		}
	case "resistance", "damageImmunity", "conditionImmunity":
		if _, err := fields(entry, []string{"target", "value"}, []string{"target", "value"}); err != nil {
			return err
		}
		vocabulary := DamageTypes
		if target == "conditionImmunity" {
			vocabulary = ConditionIDs
		}
		if !slices.Contains(vocabulary, stringOf(entry["value"])) {
			return fmt.Errorf("%s value %v is not supported", target, entry["value"])
		}
	default:
		return fmt.Errorf("target %q is not supported", target)
	}
	return nil
}

func conditionOf(raw any) (Condition, error) {
	entry, err := fields(raw, []string{"id", "name", "summary"}, []string{"id", "name", "summary"})
	if err != nil {
		return Condition{}, err
	}
	id, idText := entry["id"].(string)
	name, nameText := entry["name"].(string)
	summary, summaryText := entry["summary"].(string)
	if !idText || !nameText || !summaryText {
		return Condition{}, errors.New("id, name and summary must be text")
	}
	return Condition{ID: id, Name: name, Summary: summary}, nil
}

// --- JSON helpers ----------------------------------------------------------

func entries(raw any, field string, limit int) ([]any, error) {
	list, ok := raw.([]any)
	if !ok || len(list) == 0 || len(list) > limit {
		return nil, fmt.Errorf("%s must list 1 to %d entries", field, limit)
	}
	return list, nil
}

// fields checks an object's keys: only allowed ones, and every required one.
func fields(raw any, allowed, required []string) (map[string]any, error) {
	entry, ok := raw.(map[string]any)
	if !ok {
		return nil, errors.New("must be an object")
	}
	for _, key := range sortedKeys(entry) {
		if !slices.Contains(allowed, key) {
			return nil, fmt.Errorf("field %q is not supported", key)
		}
	}
	for _, key := range required {
		if _, exists := entry[key]; !exists {
			return nil, fmt.Errorf("missing field %q", key)
		}
	}
	return entry, nil
}

func validChoices(raw any, vocabulary []string) error {
	list, ok := raw.([]any)
	if !ok || len(list) == 0 || len(list) > len(vocabulary) {
		return errors.New("list distinct supported values")
	}
	seen := map[string]bool{}
	for _, value := range list {
		text, _ := value.(string)
		if !slices.Contains(vocabulary, text) || seen[text] {
			return fmt.Errorf("value %v is unsupported or repeated", value)
		}
		seen[text] = true
	}
	return nil
}

func validIDs(raw any, limit int) error {
	list, ok := raw.([]any)
	if !ok || len(list) == 0 || len(list) > limit {
		return fmt.Errorf("list 1 to %d ids", limit)
	}
	seen := map[string]bool{}
	for _, value := range list {
		id, _ := value.(string)
		if !ValidID(id) || seen[id] {
			return fmt.Errorf("id %v is invalid or repeated", value)
		}
		seen[id] = true
	}
	return nil
}

// ValidSpellRef reports a spell from the rules data, or this campaign's own as
// hb.<id>.
func ValidSpellRef(id string) bool {
	return ValidID(id) || strings.HasPrefix(id, IDPrefix) && ValidID(strings.TrimPrefix(id, IDPrefix))
}

func validSpellRefs(raw any, limit int) error {
	list, ok := raw.([]any)
	if !ok || len(list) == 0 || len(list) > limit {
		return fmt.Errorf("list 1 to %d spell ids", limit)
	}
	seen := map[string]bool{}
	for _, value := range list {
		id, _ := value.(string)
		if !ValidSpellRef(id) || seen[id] {
			return fmt.Errorf("spell id %v is invalid or repeated", value)
		}
		seen[id] = true
	}
	return nil
}

func integerIn(raw any, low, high int) (int, bool) {
	number, ok := raw.(float64)
	if !ok || number != math.Trunc(number) || number < float64(low) || number > float64(high) {
		return 0, false
	}
	return int(number), true
}

func stringOf(raw any) string {
	text, _ := raw.(string)
	return text
}

func sortedKeys(entry map[string]any) []string {
	keys := make([]string, 0, len(entry))
	for key := range entry {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// hasNull reports a JSON null anywhere in a decoded value. Stored shapes never
// contain one, and the browser model refuses it, so the worker does too.
func hasNull(value any) bool {
	switch typed := value.(type) {
	case nil:
		return true
	case map[string]any:
		for _, entry := range typed {
			if hasNull(entry) {
				return true
			}
		}
	case []any:
		for _, entry := range typed {
			if hasNull(entry) {
				return true
			}
		}
	}
	return false
}
