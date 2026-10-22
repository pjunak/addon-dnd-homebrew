# Homebrew items format

One JSON document holds item sets and items. Import it from **Homebrew
→ Import file** or from the DM Tools Import Center; **Export** writes the same
shape. Files are limited to 2 MiB and 256 changes per import.

```json
{
  "format": "dnd-homebrew",
  "schemaVersion": 1,
  "mode": "merge",
  "sets": [
    { "id": "runestones", "name": "Runestones", "namePrefix": "Runestone",
      "itemType": "Wondrous Item", "rarity": "Uncommon", "bodyPlacements": ["other"],
      "playerVisible": true }
  ],
  "items": [
    { "id": "ward", "setId": "runestones", "name": "Ward",
      "text": "You gain a +1 bonus to Armor Class.",
      "characterEffects": [{ "target": "armorClass", "mode": "add", "value": 1 }] },
    { "id": "fortune", "setId": "runestones", "name": "Fortune",
      "text": "Once per Long Rest, you can reroll a D20 Test. You must use the new roll.",
      "grants": { "resources": [{ "key": "uses", "name": "Fortune", "fixed": 1, "recharge": "long" }] } }
  ]
}
```

[`examples/sample-items.json`](examples/sample-items.json) is a complete file
with every kind of effect and property.

## Write many items at once

A file can hold a whole card pack or treasure list, up to 256 changes per
import. To turn notes, a PDF or a conversation into a file, by hand or with an
AI assistant:

1. **Export** the current drafts from Homebrew, so ids and sets that
   already exist are reused rather than duplicated.
2. Give the writer this page, the [sample](examples/sample-items.json), the
   export and the source text. Ask for a `merge` file with only the sets and
   items to add or change, effects and grants only where the item's rule
   matches them exactly, and the rest of the rule in `text`.
3. Check the file offline from a clone of this repository, and fix every
   problem it names until it prints `VALID`:

   ```text
   go run ./cmd/check-homebrew items.json homebrew-<date>.json
   ```

   The second file is the export; leave it out for an empty campaign. The
   report lists what the import would create, change, skip or remove.
4. Import the file and read the review before saving. Imports write drafts;
   **Publish** when the items are ready for character sheets.

## Document

| Field | Required | Meaning |
| --- | --- | --- |
| `format` | yes | `"dnd-homebrew"` |
| `schemaVersion` | yes | `1` |
| `mode` | no | `"merge"` (default) adds and updates; `"replace"` also deletes drafts missing from the file |
| `generatedAt` | no | Informational timestamp written by Export |
| `sets`, `items` | yes | Lists, possibly empty |

Unknown fields anywhere are refused. In `merge` mode an entry updates the draft
with the same `id`; a field the entry leaves out keeps its stored value, so
re-importing a card pack does not reset visibility the DM changed. A new draft
takes the defaults below. Entries that match what is stored are skipped.

## Set

| Field | Default | Rule |
| --- | --- | --- |
| `id` | required | Lowercase words joined by hyphens, at most 64 characters; permanent |
| `name` | required | One line, at most 120 characters |
| `itemType` | required | One line, for example `Wondrous Item`, `Ring` |
| `rarity` | required | `Common`, `Uncommon`, `Rare`, `Very Rare`, `Legendary`, `Artifact`, `Rarity Varies` |
| `attunement` | `false` | Items require attunement |
| `bodyPlacements` | `[]` | Any of `head`, `body`, `wrists`, `legs`, `feet`, `face`, `neck`, `shoulders`, `waist`, `gloves`, `other` |
| `tags` | `[]` | At most 20 lowercase hyphenated words |
| `namePrefix` | `""` | Shown as `<prefix>: <item name>` |
| `description` | `""` | Markdown appended to every item |
| `curse` | `""` | Markdown appended as **Curse.** |
| `playerVisible` | `false` | The set may appear in the player gallery |
| `condition` | none | A condition every item of the set gives; see [Set condition](#set-condition) |
| `weightLb` | none | Each item's weight in pounds, 0 to 100000 (fractions allowed); unknown when left out |

## Item

| Field | Default | Rule |
| --- | --- | --- |
| `id` | required | As for sets; the published record is `hb.<id>` |
| `name` | required | One line, at most 120 characters |
| `setId` | `""` | An existing or imported set, or `""` |
| `text` | `""` | Markdown; the effect as the player reads it |
| `characterEffects` | `[]` | See [Effects](#effects) |
| `grants` | none | See [Grants](#grants) |
| `characterMechanics` | from effects, grants and bonus | `"complete"` with effects, grants or a weapon or armor bonus, `"narrative"` with none of them |
| `overrides` | `{}` | Any of `itemType`, `rarity`, `attunement`, `bodyPlacements`, `weightLb`, replacing the set value |
| `attunementPrerequisites` | none | Who may attune; see [Attunement requirement](#attunement-requirement) |
| `container` | none | What the item holds: `{ "capacityLb": 30 }` (more than 0, at most 100000), `{ "weightless": true }` for contents that do not count toward the carrier's load, or both |
| `baseItem` | none | The weapon or armor the item is, with its bonus; see [Weapon or armor](#weapon-or-armor) |
| `tags` | `[]` | As for sets |
| `playerVisible` | `false` | Listed in the gallery when its set is visible too |
| `retired` | `false` | Hidden from the gallery; still usable on sheets |

## Effects

Each effect is `{ "target", "key"?, "mode", "value" }`, with `mode` one of
`set`, `add`, `minimum`, `maximum` and `value` a whole number from -100000 to
100000. These are exactly the effects the D&D Engine applies to items.

| Target | Key |
| --- | --- |
| `abilityScore`, `abilityCap`, `savingThrow` | `STR`, `DEX`, `CON`, `INT`, `WIS` or `CHA` |
| `armorClass`, `initiative`, `speed`, `maxHp`, `attunementLimit` | none |
| `proficiency` | a skill (`insight`, `stealth`, `sleightOfHand`, …) or an ability for its saving throw; always `"mode": "set", "value": 1` |
| `sense`, `resourceMax` | a name such as `darkvision` |

An item may not repeat an effect, set the same value twice, or give a minimum
above its maximum. "+1 Intelligence, up to a maximum of 20" is two effects:
`abilityScore INT add 1` and `abilityScore INT maximum 20`. The maximum applies
to the final score, so it also caps a score that another effect raises above 20;
treat such combinations as the DM's call.

## Grants

`grants` is what an item does besides fixed numbers: the feature vocabulary of
the D&D Engine, limited to the fields below. It needs D&D Engine 5.4.0 or
later; an older Engine ignores it, so the item stays usable but those parts are
text only. The editor writes this object; a file may too.

```json
"grants": {
  "advantages": [{ "on": "save", "abilities": ["WIS"], "when": "to resist the Charmed condition" }],
  "castingAbility": { "id": "casting", "choose": ["INT", "WIS", "CHA"] },
  "resources": [{ "key": "uses", "name": "Divine Guidance", "fixed": 1, "recharge": "long" }],
  "spells": [{ "ids": ["bless"], "resource": "uses" }],
  "activations": [{ "id": "open-sky", "name": "Under open sky", "modifiers": [
    { "target": "senseBonus", "key": "darkvision", "add": 30 },
    { "target": "sense", "key": "darkvision", "value": 60 }] }],
  "resistances": ["fire"]
}
```

Everything applies while the item is in effect: equipped, and attuned when it
requires attunement. Only the first copy of the same item counts. A field may
not be empty: leave it out instead. Any other field or value is refused.

| Field | Entries | Rules |
| --- | --- | --- |
| `advantages` | 1–20 | `on`: `save`, `check`, `attack`, `initiative`, `concentration` or `deathSave`. Optional `mode` (`"disadvantage"`; Advantage by default), `abilities` (saves and checks only), `skills` (checks only) and `when`, one line of at most 200 characters. An entry with `when` is listed on the sheet without marking the rolls. |
| `resources` | 1–10 | Limited uses: `key` (lowercase words joined by hyphens, distinct), `name`, `fixed` (1–100) and `recharge` (`"short"` or `"long"`), all required. The sheet tracks them for the item, even while it is unequipped. |
| `spells` | 1–20 | Named spells `{ "ids": [...] }`, or the player's pick `{ "id", "choose": 1–10, "spellLevel" or "maxSpellLevel": 0–9, "from"? }`. `from` narrows a pick by `class`, `school` (lowercase), `ids` or `"ritual": true`. A spell is cast with one of the item's uses (`"resource": "<key>"`, or `{ "key", "cost" }`), `"atWill": true`, or neither for a cantrip. Item spells never use spell slots. |
| `castingAbility` | — | `{ "fixed": "WIS" }`, or `{ "id": "casting", "choose": ["INT", "WIS", "CHA"] }` for the player to pick once per item. Allowed only with `spells`. |
| `activations` | 1–10 | Toggles the player switches on the sheet: `id` (distinct), `name`, optional `condition` (one line, when it applies) and 1–20 `modifiers`. |
| `resistances`, `damageImmunities` | — | Damage types: `acid`, `bludgeoning`, `cold`, `fire`, `force`, `lightning`, `necrotic`, `piercing`, `poison`, `psychic`, `radiant`, `slashing`, `thunder`. |
| `conditionImmunities` | — | `blinded`, `charmed`, `deafened`, `exhaustion`, `frightened`, `grappled`, `incapacitated`, `invisible`, `paralyzed`, `petrified`, `poisoned`, `prone`, `restrained`, `stunned`, `unconscious`. |

A toggle modifier is one of:

| `target` | Fields | Effect while on |
| --- | --- | --- |
| `advantage` | as an `advantages` entry | Advantage or Disadvantage on a roll |
| `sense` | `key` (such as `darkvision`), `value` 1–1000 | The sense reaches at least this many feet |
| `senseBonus` | `key`, `add` 1–1000 | The sense reaches this much farther, or this far when the character lacks it |
| `resistance`, `damageImmunity` | `value`, a damage type | |
| `conditionImmunity` | `value`, a condition | |

Not allowed on items: free casts, always-prepared or class spells, spell
choices at the class's level, level replacements, toggles that extend or
depend on other toggles, exclusive groups, and toggles that spend uses.

Ids are permanent once characters use the item: a use `key` holds spent
counts, a toggle `id` its state, and a spell choice `id` the player's pick.
Spells are entered by id (`bless`, `cure-wounds`); the Engine checks them
against the rules data. A named spell with neither a use nor `atWill` counts
as a cantrip; the Engine refuses a leveled one.

In an import, `"grants": {}` removes the stored grants, and `"container": {}`
or `"attunementPrerequisites": {}` removes those.

## Set condition

```json
"condition": { "id": "rune-bound", "name": "Rune-Bound", "summary": "Level 3 or more: …" }
```

Every item of the set gives this condition. On a character sheet its level
is the number of the set's items in effect; it has no automated effect, so
`summary` (at most 2000 characters) says what each level does. `id` is
lowercase words joined by hyphens and may not be a standard condition such as
`charmed`. In an import, `"condition": {}` removes it.

## Attunement requirement

Who may attune to an item that requires attunement, in the D&D Engine's
prerequisite vocabulary. Exactly one of:

| Requirement | Meaning | Published text |
| --- | --- | --- |
| `{ "spellcaster": true }` | A character with spellcasting of its own (not from an item) | *Requires Attunement by a Spellcaster* |
| `{ "classes": { "wizard": 1 } }` | At least that level (1–20) in the class | *by a Wizard*, or *by a Paladin of level 5 or higher* |
| `{ "any": [{ "classes": { "cleric": 1 } }, { "classes": { "paladin": 1 } }] }` | Any of 2 to 13 classes, each listed once | *by a Cleric or Paladin* |
| `{ "text": "a Dwarf" }` | Anything else, one line of at most 300 characters | *by a Dwarf* |

Class ids are the Compendium's (`cleric`, `wizard`). The sheet checks a
class or spellcaster requirement when the item is attuned and blocks it if the
character does not qualify; a requirement in words always needs the DM to
confirm it on the character. An item with a requirement must require
attunement, through its set or its override.

## Weapon or armor

A magic weapon or armor names its base, a weapon or armor record from the
rules data (the Compendium's), and the bonus it adds. The sheet then treats it
as that weapon or armor: attacks, Armor Class, hands and weight come from the
base, and the bonus adds to attack and damage rolls (a weapon) or to Armor
Class (armor or a shield).

```json
"baseItem": { "kind": "weapon", "ids": ["longsword"], "bonus": 1 }
```

| Field | Rule |
| --- | --- |
| `kind` | `weapon` or `armor` (armor includes shields) |
| `ids` | 1 to 20 base record ids, each once, such as `longsword` or `chain-mail` |
| `categories`, `ranges`, `properties` | Instead of `ids`, for a weapon: any weapon whose category (`simple`, `martial`), range (`melee`, `ranged`) and properties (`finesse`, `thrown`, …; it must have every one) match |
| `armorTypes` | Instead of `ids`, for armor: any armor of these types (`light`, `medium`, `heavy`, `shield`) |
| `except` | With filters, ids left out, such as `hide-armor` |
| `bonus` | A whole number from 1 to 5, or a list such as `[1, 2, 3]` |

With no `ids` and no filters, any weapon or any armor will do. When several
records match, or `bonus` is a list, the player picks one on the sheet;
"Weapon (Any Simple or Martial), +1, +2 or +3" is
`{ "kind": "weapon", "categories": ["simple", "martial"], "bonus": [1, 2, 3] }`.
A bonus makes the item automated and applies only while the item is equipped,
and attuned when it requires attunement. A text-only item may name its base
without a bonus. In an import, `"baseItem": {}` removes it. Use the
Compendium's ids for the base; without the Compendium installed, the sheet
cannot find the base and shows a warning instead.

## Published record

Publishing combines a set and an item into one Engine `magic-item` record:

| Record field | Source |
| --- | --- |
| `id` | `hb.<item id>` |
| `name` | `<namePrefix>: <name>`, or the name alone |
| `itemType`, `rarity`, `attunement`, `bodyPlacements` | the item override, else the set, else `Wondrous Item`, `Common`, `false`, none |
| `tags` | `homebrew`, the set id, set tags, item tags |
| `text` | `*<type>, <rarity>[ (Requires Attunement[ by <who>])]*`, the item text, the set description, `**Curse.** <curse>` |
| `weightLb` | the item override, else the set; absent when neither has one |
| `attunementPrerequisites`, `container`, `baseItem` | the item |
| `characterEffects` | the item |
| `grants` | the item's grants, plus the set condition as `conditions: [{ id, name, summary }]`; absent when neither exists |
| `characterMechanics` | `complete` when the record has effects, grants or a bonus, else `narrative`. A text-only item in a set with a condition is `complete` and carries only the condition. |
| `edition`, `book` | `2024`, `homebrew` |

An item is in the gallery when the item and its set are both visible to
players and it is not retired.
