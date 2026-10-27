# Homebrew format

One JSON document holds item sets, items, subclasses, feats and spells. Import it from
**Homebrew → Import file** or from the DM Tools Import Center; **Export**
writes the same shape. Files are limited to 2 MiB and 256 changes per import.

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
with every kind of effect and property, and
[`examples/sample-subclass.json`](examples/sample-subclass.json) holds a
[subclass](#subclass).

## Write many items at once

A file can hold a whole card pack or treasure list, up to 256 changes per
import. To turn notes, a PDF or a conversation into a file, by hand or with an
AI assistant:

1. **Export** the current drafts from Homebrew, so ids and sets that
   already exist are reused rather than duplicated.
2. Give the writer this page, the [sample](examples/sample-items.json), the
   export and the source text. Ask for a `merge` file with only the sets,
   items, subclasses, feats and spells to add or change, effects and grants
   only where the rule matches them exactly, and the rest of the rule in
   `text`.
   For a subclass or a feat, also give the writer the Compendium's record
   schema (`addon-dnd-2024-compendium/data/SCHEMA.md`), which explains the
   grants.
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
| `subclasses` | no | A list of [subclasses](#subclass) |
| `feats` | no | A list of [feats](#feat) |
| `spells` | no | A list of [spells](#spell) |

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
| `spells` | 1–20 | Named spells `{ "ids": [...] }` (rules-data ids, or this campaign's own as `hb.<id>`), or the player's pick `{ "id", "choose": 1–10, "spellLevel" or "maxSpellLevel": 0–9, "from"? }`. `from` narrows a pick by `class`, `school` (lowercase), `ids` or `"ritual": true`. A spell is cast with one of the item's uses (`"resource": "<key>"`, or `{ "key", "cost" }`), `"atWill": true`, or neither for a cantrip. Item spells never use spell slots. |
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

## Subclass

```json
{ "id": "banner-warden", "name": "Banner Warden", "classId": "fighter", "subclassLevel": 3,
  "text": "Banner Wardens carry their company's colors into battle.",
  "classResources": [{ "key": "rallying-cries", "name": "Rallying Cries", "fixed": 1,
    "proficiencyBonus": true, "recharge": "long" }],
  "features": [
    { "id": "raise-the-banner", "level": 3, "name": "Raise the Banner",
      "text": "As a Bonus Action, expend one Rallying Cry: +1 AC while the banner is raised.",
      "grants": { "activations": [{ "id": "raise-the-banner", "name": "Raise the Banner",
        "resource": "rallying-cries", "modifiers": [{ "target": "armorClass", "add": 1 }] }] } }
  ] }
```

| Field | Required | Default | Meaning |
| --- | --- | --- | --- |
| `id` | yes | | Lowercase words joined by hyphens, at most 64 characters; permanent |
| `name` | yes | | One line, at most 120 characters |
| `classId` | yes | | The class it belongs to, by the Compendium's id (`fighter`) |
| `subclassLevel` | yes | | The class level a character chooses it at, 1–20 (usually 3) |
| `text` | no | `""` | Markdown, at most 20,000 characters |
| `excerpt` | no | `""` | A one-line summary, at most 300 characters |
| `features` | no | `[]` | Up to 40 features, below |
| `grants` | no | | Grants of the subclass itself, from its subclass level |
| `spells` | no | `[]` | Up to 30 spell grants with a class `level`, such as `{ "level": 3, "ids": ["bless"], "alwaysPrepared": true }` for domain spells |
| `classResources` | no | `[]` | Up to 10 pools, such as superiority dice, in the grants' `resources` shape |
| `tableColumns` | no | `[]` | Up to 10 printed columns: `key`, `name` and `progression`, 1–20 `{ "level", "value" }` rows whose value is a whole number (−100 to 100) or a die such as `1d8` |
| `spellcasting`, `progression` | no | | A third caster's own spellcasting; both or neither, below |

A feature has `id` (distinct within the subclass), `level` (1–20), `name`,
`text`, `excerpt` (the line the sheet shows on the feature; may be empty) and
optional `grants`.

`grants` here is the D&D Engine's whole grants vocabulary, the one the
Compendium's classes, subclasses and features use; its record schema
(`addon-dnd-2024-compendium/data/SCHEMA.md`) explains each field. The add-on
checks grants against the Engine's schema, so a misspelt field or a value of
the wrong type is refused with its place, such as
`features[0].grants.resources[0].fixed must be a whole number`. Only the
Engine checks the meaning: a spell or class id that does not exist, or a toggle
that spends a use nobody declares, shows on the character instead. A grant's
keys and ids (a use `key`, a toggle or choice `id`) are permanent once
characters use the subclass; choice ids must be unique among all choices the
character has. `abilityScoreIncrease`, `weaponMasterySlots`, `spellSlot`,
`spellList` and `prepareSpellListOf` apply only to feats, `acBonus` only to
species and `conditions` only to items; `bonuses` and
`unquantifiable_modifiers` are notes nothing applies.

`spellcasting` makes the subclass a third caster such as the Eldritch Knight:

```json
"spellcasting": { "ability": "INT", "type": "third", "startLevel": 3, "prepares": "list",
  "spellListClassId": "wizard" },
"progression": [{ "level": 3, "cantripsKnown": 2, "preparedSpells": 3, "spellSlots": [2] }]
```

`prepares` is `list` or `spellbook`, `levelReplacements` (optional, 0 or 1)
lets the player replace a spell at each later level, and `ritual` (optional)
allows ritual casting. `progression` has 1–20 rows: the class level,
cantrips (0–20), prepared spells (0–40) and up to nine slot counts for spell
levels 1, 2, 3 and on. The editor starts a new table with a third caster's slots.

In an import, `"grants": {}` removes the subclass's grants, and
`"spellcasting": {}` removes its spellcasting with its `progression`.

### Published subclass

Publishing writes one document per subclass to
`homebrew_published_subclasses`, holding the records the Engine reads:

| Record | `id` | Fields |
| --- | --- | --- |
| `subclass` | `hb.<id>` | `name`, `classId`, `subclassLevel`, `features` (each one's `level`, `id` and `name`), `spells`, `grants` when set, `classResources` and `tableColumns` when not empty, `spellcasting` with `progression`, `excerpt` when set, `text` |
| `feature`, one per feature by level | `hb.<id>.<feature id>` | `name`, `classId`, `subclassId` (`hb.<id>`), `localId`, `level`, `excerpt` when set, `text`, `grants` when set |

Every record also has `edition` `2024` and `book` `homebrew`. Ids hold no dot,
so feature records of two subclasses never collide. Deleting a subclass
withdraws its document at the next publish, as for items.

## Feat

```json
{ "id": "storm-touched", "name": "Storm Touched", "category": "general",
  "prerequisites": { "level": 4, "any": [{ "abilities": { "INT": 13 } }, { "abilities": { "WIS": 13 } }] },
  "excerpt": "Int or Wis +1 (max 20). Thunderwave always prepared, once per Long Rest without a slot.",
  "text": "Lightning answers you.",
  "grants": {
    "abilityScoreIncrease": { "choose": 1, "amount": 1, "from": ["INT", "WIS"] },
    "castingAbility": { "fromAbilityScoreIncrease": true },
    "spells": [{ "level": 1, "ids": ["thunderwave"], "alwaysPrepared": true, "free": "1/long" }] } }
```

[`examples/sample-feats.json`](examples/sample-feats.json) holds one feat of
each category.

| Field | Required | Default | Meaning |
| --- | --- | --- | --- |
| `id` | yes | | Lowercase words joined by hyphens, at most 64 characters; permanent |
| `name` | yes | | One line, at most 120 characters |
| `category` | yes | | `origin` (backgrounds), `general` (ability score levels), `fightingStyle` or `epicBoon`; where the Builder offers it |
| `prerequisites` | no | `{}` | What a character needs, below; `{}` for none |
| `repeatable` | no | `false` | `true` to take it more than once, or `{ "by": "choice", "choice": "<choice id>" }` for once per value of one of its own `enumerated` choices (count 1, a listed `from`) |
| `text` | no | `""` | Markdown, at most 20,000 characters |
| `excerpt` | no | `""` | A one-line summary the sheet shows, at most 300 characters |
| `grants` | no | | The D&D Engine's grants vocabulary, as for [subclass](#subclass) features |

A feat's grants may use the fields that apply only to feats:
`abilityScoreIncrease` (`choose`, `amount`, `from` and an optional `cap`,
such as 30 for an epic boon), `weaponMasterySlots`, `spellSlot`, `spellList`
and `prepareSpellListOf`; `castingAbility` may be
`{ "fromAbilityScoreIncrease": true }`. `acBonus` (species) and `conditions`
(items) do nothing on a feat.

`prerequisites` uses only the predicates the Engine checks; every key must
hold:

| Key | Value |
| --- | --- |
| `level` | Character level 1–20 |
| `abilities` | `{ "STR": 13 }`: each listed score at least that (1–30) |
| `classes` | `{ "wizard": 5 }`: each class at least that level |
| `spellcaster` | `true`: can cast at least one spell |
| `spellcastingFeature` | `true`: has a Spellcasting or Pact Magic feature |
| `armorTraining` | `light`, `medium`, `heavy` or `shield` |
| `weaponTraining` | `simple` or `martial` |
| `feat`, `feature` | A feat or feature id, such as `hb.storm-touched` or `fighter-fighting-style` |
| `featCategory`, `withoutFeatCategory` | Has, or has no, feat of that category |
| `any`, `all` | 1–20 nested prerequisites, at most three deep: one of them, or every one |

A requirement in words, such as a species, is refused: the Engine could not
check it and every character would need the DM to waive it. Put it in `text`
instead. The editor writes the printed patterns (a level, a score in one of
several abilities, spellcasting, armor training, a Fighting Style feature)
and keeps any other prerequisite from a file as it is. Fighting style feats
require `{ "any": [{ "feature": "fighter-fighting-style" }, { "feature":
"paladin-fighting-style" }, { "feature": "ranger-fighting-style" }] }`.

In an import, `"grants": {}` removes the feat's grants.

### Published feat

Publishing writes one document per feat to `homebrew_published_feats`, holding
the `feat` record the Engine reads: `id` `hb.<id>`, `name`, `edition` `2024`,
`book` `homebrew`, `category`, `prerequisites`, `repeatable`, `grants` when
set, `excerpt` when set, and `text` opening with the category and the
prerequisite in words, such as
`*General Feat (Prerequisite: Level 4+, Intelligence or Wisdom 13+)*`.
Deleting a feat withdraws its document at the next publish, as for items.

## Spell

```json
{ "id": "ember-lance", "name": "Ember Lance", "level": 1, "school": "Evocation",
  "classes": ["sorcerer", "wizard"], "castingTime": "Action", "range": "60 feet",
  "components": ["V", "S", "M"], "material": "a shard of obsidian",
  "duration": "Instantaneous",
  "text": "A lance of embers streaks toward a creature within range. ..." }
```

[`examples/sample-spells.json`](examples/sample-spells.json) holds a leveled
spell, a concentration cantrip and a ritual. The fields are the Compendium's
`spell` record (`addon-dnd-2024-compendium/data/SCHEMA.md`):

| Field | Required | Default | Meaning |
| --- | --- | --- | --- |
| `id` | yes | | Lowercase words joined by hyphens, at most 64 characters; permanent |
| `name` | yes | | One line, at most 120 characters |
| `level` | yes | | `0` for a cantrip, up to `9` |
| `school` | yes | | `Abjuration`, `Conjuration`, `Divination`, `Enchantment`, `Evocation`, `Illusion`, `Necromancy` or `Transmutation` |
| `classes` | no | `[]` | Class ids whose spell lists include it, such as `["sorcerer", "wizard"]`; at most 20 |
| `ritual` | no | `false` | `true` when it can also be cast as a ritual |
| `concentration` | no | `false` | `true` when it needs Concentration |
| `castingTime` | yes | | As printed: `Action`, `Bonus Action`, `Reaction, which you take when …`, `1 minute` |
| `range` | yes | | As printed: `Self`, `Touch`, `60 feet` |
| `components` | yes | | One to three of `V`, `S` and `M`, each once |
| `material` | no | `""` | The material, required with `M` and refused without it |
| `duration` | yes | | As printed: `Instantaneous`, `1 hour`; a concentration spell's reads `Concentration, up to 1 minute` |
| `text` | no | `""` | Markdown, at most 20,000 characters: what the spell does, including *Using a Higher-Level Spell Slot* |

`castingTime`, `range`, `material` and `duration` are one line of at most 300
characters. Write a ritual's casting time without "or Ritual"; publishing adds
it. A spell has no grants or effects: what it does on the table stays in its
text, and the Engine uses the level, school, classes, ritual, concentration
and casting time.

A homebrew spell joins a class's spell list through `classes`, so the
Builder offers it to that class and grants that pick from a class list,
school, casting time or rituals include it. Subclass and feat grants and an
item's `spells` name it by id, `hb.ember-lance`.

### Published spell

Publishing writes one document per spell to `homebrew_published_spells`,
holding the `spell` record the Engine reads: `id` `hb.<id>`, `name`, `edition`
`2024`, `book` `homebrew`, the fields above with `classes` sorted and
`components` in `V`, `S`, `M` order, `material` only with `M`, and `text`
opening with the stat block as printed:

```text
*Level 1 Evocation (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, S, M (a shard of obsidian)
**Duration:** Instantaneous
```

Each stat line ends with two spaces, a Markdown line break. A cantrip's first
line reads *Evocation Cantrip (Sorcerer, Wizard)*. Deleting a spell withdraws
its document at the next publish, as for items.
