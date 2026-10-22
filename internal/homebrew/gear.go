package homebrew

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
)

// A magic weapon or armor names its base: the Engine's baseItem
// (internal/rules/magic_gear.go) with Homebrew's stricter limits. src/model.ts
// enforces the same rules.

const (
	MaxBaseIDs = 20
	MaxBonus   = 5
)

var (
	BaseItemKinds    = []string{"weapon", "armor"}
	WeaponCategories = []string{"simple", "martial"}
	WeaponRanges     = []string{"melee", "ranged"}
	ArmorTypes       = []string{"light", "medium", "heavy", "shield"}
)

// BaseItem is the weapon or armor a magic item is: fixed base record ids, or
// filters over every record of its kind, and a bonus.
type BaseItem struct {
	Kind       string   `json:"kind"`
	IDs        []string `json:"ids,omitempty"`
	Categories []string `json:"categories,omitempty"`
	Ranges     []string `json:"ranges,omitempty"`
	Properties []string `json:"properties,omitempty"`
	ArmorTypes []string `json:"armorTypes,omitempty"`
	Except     []string `json:"except,omitempty"`
	Bonus      *Bonus   `json:"bonus,omitempty"`
}

// Bonus is one bonus, or a list the player picks from. It encodes as it was
// written, so a published record round-trips exactly.
type Bonus struct {
	Values []int
	List   bool
}

func (bonus Bonus) MarshalJSON() ([]byte, error) {
	if bonus.List || len(bonus.Values) != 1 {
		return json.Marshal(bonus.Values)
	}
	return json.Marshal(bonus.Values[0])
}

func (bonus *Bonus) UnmarshalJSON(body []byte) error {
	var one int
	if json.Unmarshal(body, &one) == nil {
		*bonus = Bonus{Values: []int{one}}
		return nil
	}
	var list []int
	if json.Unmarshal(body, &list) != nil || list == nil {
		return errors.New("a bonus is a whole number or a list of them")
	}
	*bonus = Bonus{Values: list, List: true}
	return nil
}

var errBaseFilter = errors.New("choose each base filter from its options, once")

// baseList checks an optional list: when present it holds 1 to limit
// distinct valid entries.
func baseList(values []string, limit int, valid func(string) bool) bool {
	if values == nil {
		return true
	}
	if len(values) == 0 || len(values) > limit || hasDuplicate(values) {
		return false
	}
	for _, value := range values {
		if !valid(value) {
			return false
		}
	}
	return true
}

func ValidateBaseItem(base BaseItem) error {
	if !slices.Contains(BaseItemKinds, base.Kind) {
		return errors.New(`a base item kind is "weapon" or "armor"`)
	}
	if !baseList(base.IDs, MaxBaseIDs, ValidID) || !baseList(base.Except, MaxBaseIDs, ValidID) {
		return fmt.Errorf("name at most %d base records by id, each once", MaxBaseIDs)
	}
	in := func(options []string) func(string) bool {
		return func(value string) bool { return slices.Contains(options, value) }
	}
	if !baseList(base.Categories, len(WeaponCategories), in(WeaponCategories)) || !baseList(base.Ranges, len(WeaponRanges), in(WeaponRanges)) ||
		!baseList(base.Properties, 20, ValidID) || !baseList(base.ArmorTypes, len(ArmorTypes), in(ArmorTypes)) {
		return errBaseFilter
	}
	if base.Kind == "weapon" && base.ArmorTypes != nil || base.Kind == "armor" && (base.Categories != nil || base.Ranges != nil || base.Properties != nil) {
		return errors.New("filter a weapon by category, range and property, and armor by armor type")
	}
	if base.IDs != nil && (base.Categories != nil || base.Ranges != nil || base.Properties != nil || base.ArmorTypes != nil || base.Except != nil) {
		return errors.New("name the base records or filter them, not both")
	}
	if bonus := base.Bonus; bonus != nil {
		valid := len(bonus.Values) > 0 && len(bonus.Values) <= MaxBonus && !hasDuplicate(bonus.Values)
		for _, value := range bonus.Values {
			valid = valid && value >= 1 && value <= MaxBonus
		}
		if !valid {
			return fmt.Errorf("a bonus is a whole number from 1 to %d, or a list of them", MaxBonus)
		}
	}
	return nil
}
