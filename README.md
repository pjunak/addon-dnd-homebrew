# D&D Homebrew

D&D Homebrew lets the DM create and import custom magic items and
**item sets** for TTRPG Codex, then use them on character sheets. A set
holds what its items share: item type, rarity, attunement, body placements, a
shared description, a curse and optionally a condition every item gives. Each
item adds its own description and, where the D&D Engine can apply them,
effects such as +1 Armor Class and properties such as Advantage, limited uses
and spells cast from the item.

Items are the first kind of homebrew; subclasses and others will join this
add-on, published together and imported from the same file format.

English and Czech controls follow the host language.

## How it fits together

```text
Homebrew (DM)              drafts: sets and items, DM-only
        │ Publish
        ▼
homebrew_published         one flattened magic-item record per item, readable by players
        │ dnd5e.rules-data (worker)
        ▼
D&D Engine ── merges with the Compendium ──► Character Sheets
```

- The add-on provides `dnd5e.rules-data` 3.0.0 from its worker. The D&D Engine
  reads every compatible provider, so published items appear in the sheet's
  equipment picker next to Compendium items and their effects apply while they
  are equipped (and attuned, when they require attunement). Neither the Engine
  nor Character Sheets changes.
- The add-on also provides a `magic-item` wiki provider: a sheet's rule details
  for a homebrew item show its text, and `[[Runestone: Ward]]` links in
  campaign articles resolve to the gallery.
- Install it next to the D&D 2024 Compendium, which supplies the ruleset. This
  add-on never publishes a ruleset.

## Use it

1. **Homebrew** (DM sidebar): create a set, add items to it, or import a
   file. Drafts are private to the DM and never touch character sheets.
   **Save and add another** keeps the set for the next item, and
   **Duplicate** starts a new item from an existing one.
2. Add the item's effects and properties where the Engine supports them. An
   item with neither is **Text only** and the sheet shows its description; the
   editor decides this from what the item declares.
3. **Publish** reviews the changes and writes them for character sheets. Every
   character sheet then asks its owner to adopt the new rules on its next save,
   so publish batches of edits rather than every keystroke.
4. **Item Gallery** (DM and players) lists items whose set and item are both
   marked *Visible to players*. A sheet link still opens a held item that is not
   listed.

### What the Engine can apply

| Effect | Key | Example |
| --- | --- | --- |
| Ability score, ability score maximum, saving throw bonus | ability | +1 Intelligence (with *at most 20* for "up to 20") |
| Armor Class, initiative, speed, Hit Point maximum, attunement slots | — | +1 Armor Class, +5 Hit Point maximum |
| Proficiency | skill or saving-throw ability | Insight, Charisma saving throws |
| Sense range, resource uses | name | darkvision at least 60 |

With D&D Engine 5.4.0 or later, an item's **properties** also apply
([format](docs/FORMAT.md#grants)):

| Property | Example |
| --- | --- |
| Advantage or Disadvantage, always or only in a situation | Death Saving Throws; Wisdom saves to resist the Charmed condition |
| Limited uses that come back on a Short or Long Rest | Fortune: 1 use per Long Rest |
| Spells cast with one of those uses, at will, or as a cantrip; or spells the player picks by level, class list, school or ritual | Bless once per Long Rest, without a spell slot |
| Spellcasting ability for those spells | the player picks Intelligence, Wisdom or Charisma |
| Toggles the player switches on the sheet: Advantage, senses, resistances and immunities | In darkness: Darkvision 60 ft, or 30 ft more |
| Resistances and immunities | fire resistance, immunity to the Frightened condition |

Items can also have a **weight** (the sheet adds it to the character's load),
**hold other items** (with a capacity, and weightless contents like a Bag of
Holding) and say **who can attune**: a spellcaster, members of certain classes,
or a requirement in words that the DM confirms on the sheet.

A set may also give a **condition** whose level is the number of its items in
effect; what each level does stays text. Other conditional effects stay in the
description. The [sample file](docs/examples/sample-items.json) shows each
kind: a set of runestones with a condition, and a lantern and a satchel
without a set.

### Change and remove published items

- Editing an item changes its record at the next publish; characters keep the
  item and adopt the new version.
- **Retire** an item to hide it from the gallery while characters that hold it
  keep working.
- Deleting a published item **withdraws** it at the next publish. A character
  that still holds it shows a missing-source problem until it is removed.
- The id of a set or item is permanent: saved characters refer to
  `hb.<item id>`.

## Import and export

Import a `dnd-homebrew` JSON file from **Homebrew → Import file** or
from the DM Tools Import Center. The page checks the file first and names the
exact entry that is wrong; the worker then shows a review of what will change.
**Export** downloads every draft in the same format. See the
[format reference](docs/FORMAT.md), which also explains how to write a large
file (by hand or with an AI assistant) and check it offline with
`go run ./cmd/check-homebrew`.

## Data

Homebrew content is campaign data, not code. Drafts and published records live
in the site's add-on collections, like planning notes and character sheets, so
site backups include them and each campaign has its own. This repository holds
only the [sample file](docs/examples/sample-items.json); keep your own import
files outside it, and use **Export** to take a copy of a campaign's drafts.

The permanent add-on namespace is `dnd-homebrew`.

| Collection | Visibility | Purpose |
| --- | --- | --- |
| `homebrew_sets` | DM | Item set drafts |
| `homebrew_items` | DM | Item drafts |
| `homebrew_published` | public | Flattened records the worker serves |
| `homebrew_meta` | public | The publish revision the Engine sees |

Published records must be player-readable because each player's sheet evaluates
them with that player's authority. *Visible to players* only controls the
gallery and wiki search; keep a secret item unpublished until it is handed out.
The [design notes](docs/DESIGN.md) explain the publish revision, withdrawal and
the limits.

## Develop

```text
npm ci
npx playwright install chromium
npm run check:fast        # source guard, types, Oxlint, Prettier, fast Go checks
npm run check             # build, unit and Chromium rendering tests, Go tests
go run ./cmd/build-package
go tool -modfile=go.tools.mod codex-addon-inspect dist/dnd-homebrew-1.0.0.zip
```

Use Node from `.nvmrc` and Go from `go.mod`. `web/`, `worker/` and `dist/` are
build output.

[`host-tests/installed-homebrew.browser.mts`](host-tests/installed-homebrew.browser.mts)
installs the Compendium, Engine, Character Sheets and this package on a
disposable host, imports and publishes the sample items, checks DM and player
sheets, withdrawal, and the real UI. It uses the host's installed-suite
fixtures; the file header shows how to run it from a host checkout.
