# D&D Homebrew add-on

A TTRPG Codex add-on (TypeScript UI plus a native Go worker) for DM-authored
item sets, items and subclasses, served to the D&D Engine as
`dnd5e.rules-data`. Its add-on ID, six collection IDs and the record ids
(`hb.<item id>`, `hb.<subclass id>`, `hb.<subclass id>.<feature id>`) are
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
| Subclass editor and the schema-driven grants form | [A form built from the grants schema](docs/DESIGN.md#a-form-built-from-the-grants-schema) |
| Host integration, manifests and lifecycle | The host's [add-on guide](https://github.com/pjunak/ttrpg-codex/blob/main/examples/addons/AUTHORING.md) and [API reference](https://github.com/pjunak/ttrpg-codex/blob/main/examples/addons/API_V3.md) |
| What the Engine accepts | `addon-dnd-engine/internal/provider/client.go` (provider contract), `internal/rules/character_items.go` (effects and the item grants allowlist) and `internal/rules/grants_vocabulary.go` (the full grants vocabulary) |

Tasks for all repositories live in the host's `docs/BACKLOG.md`.

## Ownership and invariants

- `src/model.ts` and `internal/homebrew` hold the same rules in two languages.
  The fixtures in `tests/fixtures/` (effects, flattening, import plans) are
  read by both test suites; change a rule in both and in the fixture.
- Flattening (`flatten` and `flattenSubclass` in `src/model.ts`) is the only
  place set defaults and item overrides combine and a subclass becomes its
  records. The worker serves what was published and never recomputes it.
- Effects mirror the Engine's `validCharacterEffect` and proficiency rule, and
  grants its item grants allowlist (`characterItemGrants`); Homebrew may be
  stricter, never looser. Extending either vocabulary starts in the Engine.
  `contracts/` must accept every draft and record the model accepts
  (`internal/importer/schema_test.go` checks this with the host's validator).
  `contracts/rule-record.schema.json` is an exact copy of the Compendium's,
  which applies the Engine's grants vocabulary to served records; copy it
  again whenever the Compendium's changes, then run `npm run
  sync:grants-schema` for its browser copy `src/grants-schema.ts`.
- Subclass grants are the Engine's full vocabulary, checked against that
  schema in both languages. The editor renders forms from the schema;
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
  `magic-item`, `subclass` and `feature` records; a duplicate id across
  providers disables every sheet.
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
After changing the provider, publishing or the manifest, also run
`host-tests/installed-homebrew.browser.mts` from a host checkout (see its
header); it is the only check that runs the real Engine and sheets.
Ask before pushing, deploying, installing on a site or touching live data.
