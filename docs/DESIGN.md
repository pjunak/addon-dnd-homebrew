# Design notes

## Why a rules-data provider

The D&D Engine computes every character and reads its records from all
compatible `dnd5e.rules-data` providers (`addon-dnd-engine/internal/provider`).
Serving homebrew items under that contract puts them in the sheet's equipment
picker and applies their effects with no change to the Engine or Character
Sheets. Package content sets are immutable, so editable items live in add-on
collections and the worker serves them over the worker transport.

The Engine loads a fixed list of record kinds. An item set is therefore not
served on its own; publishing flattens each item with its set into one
`magic-item` record ([format](FORMAT.md#published-record)). A subclass is
one draft, as the DM edits it, and publishes as the Engine's `subclass`
record plus one `feature` record per feature, kept together in one document
so a subclass is withdrawn or replaced as a whole
([format](FORMAT.md#published-subclass)). A feat publishes as one `feat`
record ([format](FORMAT.md#published-feat)) and a spell as one `spell` record
in the Compendium's shape ([format](FORMAT.md#published-spell)); a spell's
`classes` put it on those classes' spell lists, so the Engine offers it with
no change. A species publishes as one `species` record with its lineages inside
it ([format](FORMAT.md#published-species)), which the Builder lists beside the
Compendium's.

## Drafts and publishing

Any change to served rules data makes every character sheet ask its owner to
adopt the new rules on the next save. Editing drafts never does that; only
**Publish** writes `homebrew_published`, `homebrew_published_subclasses`,
`homebrew_published_feats`, `homebrew_published_spells` and
`homebrew_published_species` and moves the revision in `homebrew_meta`, in one
transaction guarded by the revisions of all twelve collections. An unchanged publish writes nothing.

The worker's catalog revision is `<meta document revision>-<hash of the served
records>`. The Engine calls `catalog` on every evaluation, so the warm path is
one `get` of the meta document; the records are rescanned only when that
document changed, and a scan is accepted only if the document did not change
while it ran.

## Withdrawing, not deleting

A deleted add-on document leaves a tombstone, and recreating its key must quote
the tombstone revision. Workers can read it; browsers cannot. Publishing runs
in the browser, so a removed item's record is kept and marked `withdrawn`; the
worker stops serving it and a later publish of the same id overwrites it. The
importer runs in the worker and recreates deleted drafts with their tombstone
revisions. Creating a draft in the editor under a deleted id fails with a clear
message instead.

A character that holds a withdrawn item gets the Engine's missing-source
blocker. **Retire** keeps an item served while removing it from the gallery.

## A form built from the grants schema

Subclass features need the Engine's whole grants vocabulary: 49 grant fields
and 31 nested definitions. Hand-written controls for each would fall behind
the Engine, so the editor (`src/schema-form.ts`) renders any value from the
vocabulary's JSON Schema (`src/grants-schema.ts`, a copy of
`contracts/engine-grants.schema.json`, itself the Engine's): an object shows
its required fields and the optional ones it holds, and **Add field** offers
the rest; lists, maps, alternatives and flat rows (as tables) have their own
controls. Words come from `src/vocabulary.ts`: labels, hints, allowed values,
the order of fields, starting entries and, for an activation change, which
fields its target uses. A field without words still renders under its own
name, so a new Engine field is editable once `npm run sync:engine-grants` and
`npm run sync:grants-schema` run; giving it words and a Czech translation
is the follow-up. Feats and species use the same form (`src/feat-editor.ts`,
`src/species-editor.ts`); the grants' `subject` decides how fields are
grouped, so a feat lists its own benefits (an ability score increase, spell
lists, weapon mastery) first where a subclass sets them aside, a species lists
its AC bonus with combat, and a lineage never offers the choices and AC bonus
its schema refuses. Item grants keep their own smaller editor
(`src/grants.ts`), because items accept only an allowlist.

The same schema checks the values in the browser (`src/schema.ts`) and in the
worker (`internal/homebrew/schema.go`, against the contracts with the same
validator library as the host). Both name the failing place by path, and the
form names its controls by the same path, so saving moves to the problem.

## Visibility

Character sheets evaluate with the viewer's authority, so `homebrew_published`,
`homebrew_published_subclasses`, `homebrew_published_feats`,
`homebrew_published_spells`, `homebrew_published_species` and
`homebrew_meta` are public collections.
Drafts are DM-only. *Visible to players* is presentation: it decides what the
gallery and wiki search list. An exact `magic-item:hb.<id>` reference resolves regardless, because the sheet
asking already holds the item. A truly secret item stays unpublished.

Public collections are writable by players through the raw data API, like
every public add-on collection. The worker validates each served record and
skips invalid ones with a diagnostic, and the next publish rewrites them.

## Schemas of stored collections

The host fingerprints each collection's schema together with every file it
references. When an update changes the fingerprint of a collection that holds
data, the DM must review a data migration (**Heal and update**) before the new
version runs. `homebrew-common.schema.json` is referenced by the item, set,
publish and subclass collections, so a change there touches all of them; a new
kind of homebrew keeps its own definitions in its own schema file
(`homebrew-feat.schema.json` holds the prerequisite vocabulary,
`homebrew-spell.schema.json` the spell's fields, `homebrew-species.schema.json`
the species' sizes, speeds, traits and lineages), which leaves the existing
collections untouched.

## Limits

- Publishing and importing are single transactions of at most 256 changes.
- The effect and grants vocabularies are the Engine's: `validCharacterEffect`
  and the item grants allowlist (`characterItemGrants`), both in the Engine's
  `internal/rules/character_items.go`, and the full grants vocabulary
  (`internal/rules/grants_vocabulary.go`) for subclasses. Anything else needs
  Engine support first, then its contract README, the Compendium schema and the
  sheet's display. Grants need Engine 5.4.0; an older Engine ignores them. A
  weapon or armor base (`baseItem`) follows the Engine's magic weapons and
  armor contract (`internal/rules/magic_gear.go`), with at most 20 ids and
  bonuses up to +5, and needs Engine 6.1.0.
- Subclass grants are checked for shape, not meaning: an unknown spell or class
  id, a toggle spending a use nobody declares, or a choice id another source
  also uses shows on the character, not in the editor. Some vocabulary fields
  apply only to feats, species or items; the editor lists them under *Not
  applied on subclasses*.
- The editor picks spells, classes, weapons and armor from the other `dnd5e.rules-data`
  providers (the Compendium), which the browser reads once per page through
  an optional consumer that excludes this add-on's own records. Without a
  Compendium they are typed as ids. Either way the Engine checks them: an
  unknown spell is unavailable on the sheet, and a leveled spell without a use
  or `atWill` is refused there, not here. Items, subclass and feat grants
  also offer this campaign's spell drafts as `hb.<id>`.
- A set condition only counts levels. What each level does stays text in
  its summary, and conditional rules beyond toggles stay in the description;
  the DM can add a linked adjustment on a character instead.
- A feat's prerequisite uses only the predicates the Engine evaluates; a
  requirement in words would need a DM's waiver on every character, so it
  stays in the text. Any and all nest at most three deep.
- A spell carries no grants or effects. The Engine reads its level, school,
  classes, ritual, concentration and casting time; damage, saves and areas
  stay in its text, as for the Compendium's spells. Its stat block is written
  into the published text, so changing a casting time or range republishes the
  spell.
- A species' size, speeds, darkvision and resistances are fields of their own,
  as in the Compendium, so the printed block and the sheet show them; anything
  else a species does is grants. The Engine reads a lineage's grants beside
  the species' but its choices and AC bonus only from the species, so the
  schema refuses both on a lineage, and the Engine's size choice reserves the
  choice id `size`. Sizes, speeds and resistances publish in a fixed order, so
  the form's order never changes the record.
- The wiki provider resolves items only; a homebrew subclass, feat, spell or
  species has no page of its own outside the sheets.
- If the worker stops, the Engine cannot read its rules sources and character
  editing pauses; saved sheets stay readable. Disable the add-on to remove it
  from the Engine's sources.
- The Import Center shows a generic message when a preview fails; the Homebrew
  Items page and `cmd/check-homebrew` name the exact problem.
