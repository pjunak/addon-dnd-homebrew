# D&D Homebrew add-on

A TTRPG Codex add-on (TypeScript UI plus a native Go worker) for DM-authored
item sets, items, subclasses, feats, spells and species, served to the D&D Engine as
`dnd5e.rules-data`. Its add-on ID, twelve collection IDs and the record ids
(`hb.<item id>`, `hb.<subclass id>`, `hb.<subclass id>.<feature id>`,
`hb.<feat id>`, `hb.<spell id>`, `hb.<species id>` and its lineage ids) are
permanent: saved characters refer to them.

This is a personal project: preserve campaign data first, then keep the UI
friendly and the code clear. Old formats and extra hardening are low priority.

## Read by task

| Task | Start here |
| --- | --- |
| What it does, setup and commands | [README.md](README.md) |
| Import format, flattening and effects | [docs/FORMAT.md](docs/FORMAT.md) |
| Writing or checking an import file | [Write many items at once](docs/FORMAT.md#write-many-items-at-once) (`cmd/check-homebrew`) |
| Publish revision, withdrawal, visibility and limits | [docs/DESIGN.md](docs/DESIGN.md) |
| Subclass, feat and species editors and the schema-driven grants form | [A form built from the grants schema](docs/DESIGN.md#a-form-built-from-the-grants-schema) |
| Spells: the record the Engine and sheets read | [Spell](docs/FORMAT.md#spell); the Compendium's `data/SCHEMA.md` (`spell`) and the Engine's `internal/rules/spell_play.go` |
| Species: size, speeds, lineages and what the Engine reads | [Species](docs/FORMAT.md#species); the Compendium's `data/SCHEMA.md` (`species`) and the Engine's `internal/rules/hydrate.go` (`hydrateSpecies`) and `species_size.go` |
| Host integration, manifests and lifecycle | The host's [add-on guide](https://github.com/pjunak/ttrpg-codex/blob/main/examples/addons/AUTHORING.md) and [API reference](https://github.com/pjunak/ttrpg-codex/blob/main/examples/addons/API_V3.md) |
| What the Engine accepts | `addon-dnd-engine/internal/provider/client.go` (provider contract), `internal/rules/character_items.go` (effects and the item grants allowlist), `internal/rules/grants_vocabulary.go` (the full grants vocabulary) and `internal/rules/magic_gear.go` (a magic weapon or armor's `baseItem`) |

Tasks for all repositories live in the host's `docs/BACKLOG.md`.

## Ownership and invariants

- `src/model.ts` and `internal/homebrew` hold the same rules in two languages.
  The fixtures in `tests/fixtures/` (effects, flattening, import plans) are
  read by both test suites; change a rule in both and in the fixture.
- Flattening (`flatten`, `flattenSubclass`, `flattenFeat`, `flattenSpell` and `flattenSpecies`
  in `src/model.ts`) is the only place set defaults and item overrides combine
  and a subclass, feat, spell or species becomes its records. The worker serves what was published and never recomputes it.
- Effects mirror the Engine's `validCharacterEffect` and proficiency rule,
  grants its item grants allowlist (`characterItemGrants`), and `baseItem` its
  magic weapons and armor (`magicBaseItem`); Homebrew may be
  stricter, never looser. Extending either vocabulary starts in the Engine.
  `contracts/` must accept every draft and record the model accepts
  (`internal/importer/schema_test.go` checks this with the host's validator).
  `contracts/engine-grants.schema.json` is the Engine's grants vocabulary at
  the Engine version `tools/engine-grants.mts` pins (the Compendium pins the
  same one); `npm run check` fails when it or its browser copy
  `src/grants-schema.ts` differs, and `npm run sync:engine-grants` then
  `npm run sync:grants-schema` copy them after a version change. Served
  records follow Homebrew's own `published-record.schema.json`,
  `published-subclass.schema.json`, `published-feat.schema.json` and
  `published-spell.schema.json` and `published-species.schema.json`.
- Subclass and feat grants are the Engine's full vocabulary, checked against
  that schema in both languages; feat prerequisites are the Engine's
  predicates (`prerequisiteMatches`), never words. The editor renders forms from the schema;
  `src/vocabulary.ts` only words them, and each of its English words needs a
  Czech translation (`tests/localization.mts`).
- Published records are never deleted, only withdrawn: a browser cannot learn
  a deleted key's tombstone revision and could not publish that id again.
- Every publish writes the records and the `homebrew_meta` revision in one
  guarded transaction. The worker trusts a scan only when that revision did not
  move during it.
- The rules-data methods run with the caller's authority (often a player), so
  they read only public collections. Import methods require the DM.
- The worker never serves a `ruleset` and only serves `hb.`-prefixed
  `magic-item`, `subclass`, `feature`, `feat`, `spell` and `species` records; a duplicate id across
  providers disables every sheet.
- The host fingerprints each collection's schema with every file it
  references; a changed fingerprint on a collection with data makes the DM
  review a data migration on update. Keep `homebrew-common.schema.json` and
  the stored collections' schemas stable, and give a new kind its own file.
- Imports write drafts only. Preview retains the exact guarded mutations behind
  a single-use token; commit submits that plan and nothing else.
- UI code validates every response, uses the host's shared controls and design
  tokens, and never inserts HTML; Markdown goes to `codex-addon-markdown`.

## Working loop

```text
npm run check:fast
npm run check
go run ./cmd/build-package
go tool -modfile=go.tools.mod codex-addon-inspect dist/dnd-homebrew-<version>.zip
```

`npm run sync:codex-sdk` refreshes `src/codex/` after a host version change.
After changing the provider, publishing, the import format or the manifest,
also run the host's installed suite with `CODEX_HOMEBREW_ZIP` set to the new
build (see the host's CONTRIBUTING.md); `installed-homebrew.browser.mts` there
is the only check that runs the real Engine and sheets. Its sample documents
copy `docs/examples/sample-items.json`, `sample-subclass.json`,
`sample-feats.json`, `sample-spells.json` and `sample-species.json`; change them together.
Ask before pushing, deploying, installing on a site or touching live data.
