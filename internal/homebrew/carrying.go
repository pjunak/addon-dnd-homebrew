package homebrew

import (
	"errors"
	"fmt"
	"math"
)

// Weight, containers and attunement requirements are record facts the Engine
// reads for carrying and attunement (character_carrying.go and the attunement
// prerequisite check in character_equipment.go). src/model.ts enforces the
// same rules.

const MaxWeight = 100000

// Container is what an item holds: a capacity in pounds and/or contents that
// do not count toward the carrier. At least one is declared.
type Container struct {
	CapacityLb *float64 `json:"capacityLb,omitempty"`
	Weightless *bool    `json:"weightless,omitempty"`
}

var (
	errWeight                     = fmt.Errorf("a weight is a number of pounds from 0 to %d", MaxWeight)
	errRequirementNeedsAttunement = errors.New("an attunement requirement needs an item that requires attunement")
)

func ValidWeight(value float64) bool {
	return !math.IsNaN(value) && value >= 0 && value <= MaxWeight
}

func ValidateContainer(container Container) error {
	switch {
	case container.CapacityLb == nil && container.Weightless == nil:
		return errors.New("a container declares a capacity, weightless contents or both")
	case container.CapacityLb != nil && (*container.CapacityLb <= 0 || !ValidWeight(*container.CapacityLb)):
		return fmt.Errorf("a container capacity is more than 0 and at most %d pounds", MaxWeight)
	case container.Weightless != nil && !*container.Weightless:
		return errors.New("weightless is true when present")
	}
	return nil
}

// ValidateRequirement accepts who may attune to an item, in the Engine's
// prerequisite vocabulary as the Compendium uses it: any spellcaster, one class
// at a minimum level, any of several classes, or words the DM confirms.
func ValidateRequirement(requirement map[string]any) error {
	if len(requirement) != 1 {
		return errors.New("an attunement requirement is one of spellcaster, classes, any or text")
	}
	for key, raw := range requirement {
		switch key {
		case "spellcaster":
			if raw != true {
				return errors.New("spellcaster is true when present")
			}
		case "classes":
			if _, err := classLevel(raw); err != nil {
				return err
			}
		case "any":
			list, ok := raw.([]any)
			if !ok || len(list) < 2 || len(list) > 13 {
				return errors.New("any lists 2 to 13 classes")
			}
			seen := map[string]bool{}
			for _, entry := range list {
				option, err := fields(entry, []string{"classes"}, []string{"classes"})
				if err != nil {
					return fmt.Errorf("any: %w", err)
				}
				class, err := classLevel(option["classes"])
				if err != nil {
					return fmt.Errorf("any: %w", err)
				}
				if seen[class] {
					return fmt.Errorf("any repeats the class %s", class)
				}
				seen[class] = true
			}
		case "text":
			if text, _ := raw.(string); !validName(text, 300) {
				return errors.New("a requirement in words is one line of at most 300 characters")
			}
		default:
			return fmt.Errorf("attunement requirement %q is not supported", key)
		}
	}
	return nil
}

// classLevel reads {"<class id>": <minimum level>} with one class.
func classLevel(raw any) (string, error) {
	classes, ok := raw.(map[string]any)
	if !ok || len(classes) != 1 {
		return "", errors.New("classes names one class id and its minimum level")
	}
	for class, level := range classes {
		if !ValidID(class) {
			return "", fmt.Errorf("class id %q must be lowercase words joined by hyphens", class)
		}
		if _, isInteger := integerIn(level, 1, 20); !isInteger {
			return "", errors.New("a minimum class level is a whole number from 1 to 20")
		}
		return class, nil
	}
	return "", nil
}

// validCarrying checks the optional weight, container and requirement of a
// draft or a published record.
func validCarrying(weight *float64, container *Container, requirement map[string]any) error {
	if weight != nil && !ValidWeight(*weight) {
		return errWeight
	}
	if container != nil {
		if err := ValidateContainer(*container); err != nil {
			return err
		}
	}
	if requirement != nil {
		return ValidateRequirement(requirement)
	}
	return nil
}
