# D&D Homebrew

D&D Homebrew lets the DM create and import custom magic items, **item
sets**, **subclasses**, **feats**, **spells** and **species** for TTRPG Codex, then use them
on character sheets. A set holds what its items share: item type, rarity, attunement, body placements, a
shared description, a curse and optionally a condition every item gives. Each
item adds its own description and, where the D&D Engine can apply them,
effects such as +1 Armor Class and properties such as Advantage, limited uses
and spells cast from the item.

A subclass has its features by level, and each feature can grant anything a
printed subclass feature can: the editor covers the D&D Engine's whole grants
vocabulary. A feat has a category, a prerequisite and the same grants, such as
an ability score increase or spells. A spell has its level, school, stat block
and text, and joins the spell lists of the classes it names. A species has
its size, speeds, senses, traits and lineages, with the same grants. More kinds of
homebrew will join this add-on, published together and imported from the same
file format.

English and Czech controls follow the host language.

## How it fits together

```text
Homebrew (DM)                    drafts: sets, items, subclasses, feats, spells, species; DM-only
        │ Publish
        ▼
homebrew_published               one flattened magic-item record per item
homebrew_published_subclasses    a subclass record and its feature records
homebrew_published_feats         one feat record per feat
homebrew_published_spells        one spell record per spell
homebrew_published_species       one species record per species
        │                        (all readable by players)
        │ dnd5e.rules-data (worker)
        ▼
D&D Engine ── merges with the Compendium ──► Character Sheets
```

- The add-on provides `dnd5e.rules-data` 3.0.0 from its worker. The D&D Engine
  reads every compatible provider, so published items appear in the sheet's
  equipment picker next to Compendium items and their effects apply while they
  are equipped (and attuned, when they require attunement). Published
  subclasses appear in the Builder next to the class's own, and their features
  apply from their levels. Published feats join the Builder's feat choices of
  their category, published spells the spell lists of their classes, and
  published species the Builder's species.
  Neither the Engine nor Character Sheets changes.
- The add-on also provides a `magic-item` wiki provider: a sheet's rule details
  for a homebrew item show its text, and `[[Runestone: Ward]]` links in
  campaign articles resolve to the gallery.
- Install it next to the D&D 2024 Compendium, which supplies the ruleset. This
  add-on never publishes a ruleset.

## Use it

1. **Homebrew** (DM sidebar): create an item, a set, a subclass, a feat, a
   spell or a species, or import a file. Drafts are private to the DM and never touch character sheets. A
   new item can **start from** a common kind: a +1 weapon, armor or shield, a
   bonus to a statistic, an ability score item, a spell cast from the item, a
   resistance, a container or a potion. The preview beside the form shows the
   item as it will be published. **Save and add another** keeps the set for
   the next item, **Duplicate** starts a new item from an existing one, and
   Ctrl+S saves.
2. Put items that share their type, rarity, attunement, placements,
   description or curse into a **set**. An item in a set shows the set's
   values as *From set* and can change any of them; moving an item into
   another set or out of one keeps what it changed. A set lists its items and
   shows all of them to players, or hides them, at once. Deleting a set
   deletes its items too, or keeps them without a set.
3. Add what the item does on the sheet where the Engine supports it: effects
   such as +1 Armor Class or a proficiency, advantages, limited uses, spells,
   toggles, resistances and a weapon or armor base. An item with none of them
   is **Text only** and the sheet shows its description; the editor decides
   this from what the item declares.
4. **Publish** reviews the changes and writes them for character sheets. Every
   character sheet then asks its owner to adopt the new rules on its next save,
   so publish batches of edits rather than every keystroke.
5. **Item Gallery** (DM and players) lists items whose set and item are both
   marked *Visible to players*. A sheet link still opens a held item that is not
   listed.
6. **New subclass** creates a subclass for a class. Add its features with their
   levels, text and grants, and anything the subclass itself has: subclass
   spells, pools such as superiority dice, table columns such as a die that
   grows, and a third caster's spellcasting.
7. **New feat** creates a feat. It can start as an origin feat, a general feat
   with +1 to an ability score, a fighting style or an epic boon. Choose where
   the Builder offers it (its category), what a character needs to take it,
   whether it can be taken more than once, and what it grants.
8. **New spell** creates a spell: its level, school, the classes whose spell
   lists include it, its casting time, range, components and duration, and
   what it does.
9. **New species** creates a species: its creature type, size (or sizes the
   player picks from), speeds, darkvision and resistances, its printed traits,
   lineages a player picks one of, and what it grants on the sheet.

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

With D&D Engine 6.1.0 or later, an item can be a **magic weapon or armor**
([format](docs/FORMAT.md#weapon-or-armor)): a base weapon or armor from the
Compendium, such as a longsword or a shield, with a bonus to attack and damage
rolls or to Armor Class. Leave the base or the bonus open (any martial weapon,
+1 to +3) and the player picks it on the sheet.

Items can also have a **weight** (the sheet adds it to the character's load),
**hold other items** (with a capacity, and weightless contents like a Bag of
Holding) and say **who can attune**: a spellcaster, members of certain classes,
or a requirement in words that the DM confirms on the sheet.

A set may also give a **condition** whose level is the number of its items in
effect; what each level does stays text. Other conditional effects stay in the
description. The [sample file](docs/examples/sample-items.json) shows each
kind: a set of runestones with a condition, and a lantern and a satchel
without a set.

### Subclasses

Subclass features use the D&D Engine's full grants vocabulary, the same one
the Compendium's own subclasses use: proficiencies and Expertise, choices the
player makes in the Builder, limited uses, toggles such as Rage with their
changes, spells and spell lists, attacks and attack changes, Armor Class
formulas, bonuses to rolls, speeds, senses, Hit Points, resistances and more.
The editor builds its form from the Engine's schema, so a field the Engine adds
is editable after the next schema sync, and it explains each field and offers
its allowed values. A few fields apply only to feats, species or items; the
editor lists them separately. The [sample subclass](docs/examples/sample-subclass.json)
shows a fighter subclass with a skill, extra Hit Points, a pool of uses, a
toggle that spends them and a feature at level 7.

### Feats

A feat's **category** decides where the Builder offers it: origin feats with a
background, general feats at the levels that grant an ability score
improvement, fighting styles with a Fighting Style feature, and epic boons at
level 19. Its **prerequisite** is checked by the Engine on the character: a
level, a score in one of several abilities, spellcasting, armor training or a
Fighting Style feature, as printed feats require; a file can also name classes,
other feats or combinations ([format](docs/FORMAT.md#feat)). A requirement in
words, such as a species, belongs in the text. **Grants** use the same form as
subclass features, with the feat's own benefits first: an ability score
increase (with a higher maximum for epic boons), weapon mastery and spell
lists. The published text opens with the category and prerequisite as the
books print them, such as *General Feat (Prerequisite: Level 4+, Strength or
Dexterity 13+)*. The [sample feats](docs/examples/sample-feats.json) show one
of each category.

### Spells

A spell is the Compendium's spell record: its level (0 for a cantrip), school,
casting time, range, components with their material, duration, whether it
needs **Concentration** and whether it can be cast as a **ritual**. Its
**spell lists** are the classes that can learn or prepare it: a wizard's
Builder offers a homebrew spell that lists `wizard` beside the Compendium's,
and grants that let a player pick from a class's list, a school or rituals
include it. A subclass or feat can also grant it by its id, `hb.<spell id>`,
and an item can cast it. Spells carry no
grants: what one does on the table stays in its text. The published text opens
with the stat block as the books print it, such as *Level 1 Evocation
(Sorcerer, Wizard)* followed by its casting time, range, components and
duration. The [sample spells](docs/examples/sample-spells.json) show a leveled
spell, a concentration cantrip and a ritual.

### Species

A species has a creature type, a size (or several the player picks from in
the Builder), a walking speed, special speeds in feet or equal to the walking
speed, darkvision and damage resistances, each a field of its own. Its traits
are printed with their names, as the books do; what a trait does on the sheet
goes in the species' **grants**, the same vocabulary as a feat's, such as a
skill proficiency, a tool choice, a use with a toggle or an AC bonus. A
**lineage**, such as High Elf or Drow, is a variant the player picks one of;
its grants add to the species', and it cannot offer choices or an AC bonus,
which the Engine reads only from the species. The published text opens with
the creature type, size and speed lines, then the description, traits and
lineages. The [sample species](docs/examples/sample-species.json) show a
species with a size choice, lineages and a tool choice, and one with a use and
a toggle.

### Change and remove published items

- Editing an item changes its record at the next publish; characters keep the
  item and adopt the new version.
- **Retire** an item to hide it from the gallery while characters that hold it
  keep working.
- Deleting a published item **withdraws** it at the next publish. A character
  that still holds it shows a missing-source problem until it is removed.
- The id of a set or item is permanent: saved characters refer to
  `hb.<item id>`. The same holds for a subclass (`hb.<subclass id>`), its
  features (`hb.<subclass id>.<feature id>`), a feat (`hb.<feat id>`), a
  spell (`hb.<spell id>`), a species (`hb.<species id>`) and its lineages.
  Deleting a published subclass, feat, spell or species withdraws it like an
  item.

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
only the sample files ([items](docs/examples/sample-items.json),
[subclass](docs/examples/sample-subclass.json),
[feats](docs/examples/sample-feats.json),
[spells](docs/examples/sample-spells.json),
[species](docs/examples/sample-species.json)); keep your own import files
outside it, and use **Export** to take a copy of a campaign's drafts.

The permanent add-on namespace is `dnd-homebrew`.

| Collection | Visibility | Purpose |
| --- | --- | --- |
| `homebrew_sets` | DM | Item set drafts |
| `homebrew_items` | DM | Item drafts |
| `homebrew_published` | public | Flattened records the worker serves |
| `homebrew_meta` | public | The publish revision the Engine sees |
| `homebrew_subclasses` | DM | Subclass drafts with their features |
| `homebrew_published_subclasses` | public | Each subclass's record and feature records the worker serves |
| `homebrew_feats` | DM | Feat drafts |
| `homebrew_published_feats` | public | Each feat's record the worker serves |
| `homebrew_spells` | DM | Spell drafts |
| `homebrew_published_spells` | public | Each spell's record the worker serves |
| `homebrew_species` | DM | Species drafts with their lineages |
| `homebrew_published_species` | public | Each species' record the worker serves |

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
go tool -modfile=go.tools.mod codex-addon-inspect dist/dnd-homebrew-1.7.0.zip
```

Use Node from `.nvmrc` and Go from `go.mod`. `web/`, `worker/` and `dist/` are
build output.

The host's installed add-on suite (`installed-homebrew.browser.mts` in
`ttrpg-codex`) installs the Compendium, Engine, Character Sheets and this
package on a disposable host, imports and publishes sample items and a
subclass, checks DM and player sheets, a character with the subclass,
withdrawal, and the real UI. It runs nightly and before every deployment
against the latest releases; to run it against a local build, set
`CODEX_HOMEBREW_ZIP` as the host's
[CONTRIBUTING.md](https://github.com/pjunak/ttrpg-codex/blob/main/CONTRIBUTING.md#installed-add-on-smoke-test)
describes.
