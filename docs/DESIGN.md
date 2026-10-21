# Design notes

## Why a rules-data provider

The D&D Engine computes every character and reads its records from all
compatible `dnd5e.rules-data` providers (`addon-dnd-engine/internal/provider`).
Serving homebrew items under that contract puts them in the sheet's equipment
picker and applies their effects with no change to the Engine or Character
Sheets. Package content sets are immutable, so editable items live in add-on
collections and the worker serves them over the worker transport.

The Engine loads a fixed list of record kinds. An item class is therefore not
served on its own; publishing flattens each item with its class into one
`magic-item` record ([format](FORMAT.md#published-record)).

## Drafts and publishing

Any change to served rules data makes every character sheet ask its owner to
adopt the new rules on the next save. Editing drafts never does that; only
**Publish** writes `homebrew_published` and moves the revision in
`homebrew_meta`, in one transaction guarded by the revisions of all four
collections. An unchanged publish writes nothing.

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

## Visibility

Character sheets evaluate with the viewer's authority, so `homebrew_published`
and `homebrew_meta` are public collections. Drafts are DM-only. *Visible to
players* is presentation: it decides what the gallery and wiki search list.
An exact `magic-item:hb.<id>` reference resolves regardless, because the sheet
asking already holds the item. A truly secret item stays unpublished.

Public collections are writable by players through the raw data API, like
every public add-on collection. The worker validates each served record and
skips invalid ones with a diagnostic, and the next publish rewrites them.

## Limits

- Publishing and importing are single transactions of at most 256 changes.
- The effect and grants vocabularies are the Engine's: `validCharacterEffect`
  and the item grants allowlist (`characterItemGrants`), both in the Engine's
  `internal/rules/character_items.go`. Anything else needs Engine support
  first, then its contract README, the Compendium schema and the sheet's
  display. Grants need Engine 5.4.0; an older Engine ignores them.
- Spells are entered by id. A spell picker would need this add-on to consume
  `dnd5e.rules-data` as well as provide it, so for now the Engine checks the
  ids: an unknown spell is unavailable on the sheet, and a leveled spell
  without a use or `atWill` is refused there, not here.
- A class condition only counts levels. What each level does stays text in
  its summary, and conditional rules beyond toggles stay in the description;
  the DM can add a linked adjustment on a character instead (as for the Cursed
  Card *Success*).
- If the worker stops, the Engine cannot read its rules sources and character
  editing pauses; saved sheets stay readable. Disable the add-on to remove it
  from the Engine's sources.
- The Import Center shows a generic message when a preview fails; the Homebrew
  Items page names the exact problem.
