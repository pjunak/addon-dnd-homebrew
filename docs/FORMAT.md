# Homebrew items format

One JSON document holds item classes and items. Import it from **Homebrew Items
→ Import file** or from the DM Tools Import Center; **Export** writes the same
shape. Files are limited to 2 MiB and 256 changes per import.

```json
{
  "format": "dnd-homebrew-items",
  "schemaVersion": 1,
  "mode": "merge",
  "classes": [
    { "id": "cursed-cards", "name": "Cursed Cards", "namePrefix": "Cursed Card",
      "itemType": "Wondrous Item", "rarity": "Rare", "bodyPlacements": ["other"],
      "playerVisible": true }
  ],
  "items": [
    { "id": "defense", "classId": "cursed-cards", "name": "Defense",
      "text": "+1 permanent bonus to Armor Class.",
      "characterEffects": [{ "target": "armorClass", "mode": "add", "value": 1 }] },
    { "id": "destiny", "classId": "cursed-cards", "name": "Destiny",
      "text": "Once per Long Rest, reroll a D20 Test. You must use the new roll.",
      "grants": { "resources": [{ "key": "uses", "name": "Destiny", "fixed": 1, "recharge": "long" }] } }
  ]
}
```

[`examples/cursed-cards.json`](examples/cursed-cards.json) is a complete file.

## Document

| Field | Required | Meaning |
| --- | --- | --- |
| `format` | yes | `"dnd-homebrew-items"` |
| `schemaVersion` | yes | `1` |
| `mode` | no | `"merge"` (default) adds and updates; `"replace"` also deletes drafts missing from the file |
| `generatedAt` | no | Informational timestamp written by Export |
| `classes`, `items` | yes | Lists, possibly empty |

Unknown fields anywhere are refused. In `merge` mode an entry updates the draft
with the same `id`; a field the entry leaves out keeps its stored value, so
re-importing a card pack does not reset visibility the DM changed. A new draft
takes the defaults below. Entries that match what is stored are skipped.

## Class

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
| `playerVisible` | `false` | The class may appear in the player gallery |
| `condition` | none | A condition every item of the class gives; see [Class condition](#class-condition) |

## Item

| Field | Default | Rule |
| --- | --- | --- |
| `id` | required | As for classes; the published record is `hb.<id>` |
| `name` | required | One line, at most 120 characters |
| `classId` | `""` | An existing or imported class, or `""` |
| `text` | `""` | Markdown; the effect as the player reads it |
| `characterEffects` | `[]` | See [Effects](#effects) |
| `grants` | none | See [Grants](#grants) |
| `characterMechanics` | from effects and grants | `"complete"` with effects or grants, `"narrative"` with neither |
| `overrides` | `{}` | Any of `itemType`, `rarity`, `attunement`, `bodyPlacements`, replacing the class value |
| `tags` | `[]` | As for classes |
| `playerVisible` | `false` | Listed in the gallery when its class is visible too |
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

In an import, `"grants": {}` removes the stored grants.

## Class condition

```json
"condition": { "id": "fate-touched", "name": "Fate-Touched", "summary": "" }
```

Every item of the class gives this condition. On a character sheet its level
is the number of the class's items in effect; it has no automated effect, so
`summary` (at most 2000 characters) says what each level does. `id` is
lowercase words joined by hyphens and may not be a standard condition such as
`charmed`. In an import, `"condition": {}` removes it.

## Published record

Publishing combines a class and an item into one Engine `magic-item` record:

| Record field | Source |
| --- | --- |
| `id` | `hb.<item id>` |
| `name` | `<namePrefix>: <name>`, or the name alone |
| `itemType`, `rarity`, `attunement`, `bodyPlacements` | the item override, else the class, else `Wondrous Item`, `Common`, `false`, none |
| `tags` | `homebrew`, the class id, class tags, item tags |
| `text` | `*<type>, <rarity>[ (Requires Attunement)]*`, the item text, the class description, `**Curse.** <curse>` |
| `characterEffects` | the item |
| `grants` | the item's grants, plus the class condition as `conditions: [{ id, name, summary }]`; absent when neither exists |
| `characterMechanics` | `complete` when the record has effects or grants, else `narrative`. A text-only item in a class with a condition is `complete` and carries only the condition. |
| `edition`, `book` | `2024`, `homebrew` |

An item is in the gallery when the item and its class are both visible to
players and it is not retired.
