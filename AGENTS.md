# D&D Homebrew add-on

A TTRPG Codex add-on (TypeScript UI plus a native Go worker) for DM-authored
item sets and items, served to the D&D Engine as `dnd5e.rules-data`. Its
add-on ID, four collection IDs and the `hb.<item id>` record ids are permanent:
saved characters refer to them.

This is a personal project: preserve campaign data first, then keep the UI
friendly and the code clear. Old formats and extra hardening are low priority.

## Read by task

| Task | Start here |
| --- | --- |
| What it does, setup and commands | [README.md](README.md) |
| Import format, flattening and effects | [docs/FORMAT.md](docs/FORMAT.md) |
| Writing or checking an import file | [Write many items at once](docs/FORMAT.md#write-many-items-at-once) (`cmd/check-homebrew`) |
| Publish revision, withdrawal, visibility and limits | [docs/DESIGN.md](docs/DESIGN.md) |
| Host integration, manifests and lifecycle | The host's [add-on guide](https://github.com/pjunak/ttrpg-codex/blob/main/examples/addons/AUTHORING.md) and [API reference](https://github.com/pjunak/ttrpg-codex/blob/main/examples/addons/API_V3.md) |
| What the Engine accepts | `addon-dnd-engine/internal/provider/client.go` (provider contract) and `internal/rules/character_items.go` (effects and the item grants allowlist) |

Tasks for all repositories live in the host's `docs/BACKLOG.md`.

## Ownership and invariants

- `src/model.ts` and `internal/homebrew` hold the same rules in two languages.
  The fixtures in `tests/fixtures/` (effects, flattening, import plans) are
  read by both test suites; change a rule in both and in the fixture.
- Flattening (`flatten` in `src/model.ts`) is the only place set defaults and
  item overrides combine. The worker serves what was published and never
  recomputes it.
- Effects mirror the Engine's `validCharacterEffect` and proficiency rule, and
  grants its item grants allowlist (`characterItemGrants`); Homebrew may be
  stricter, never looser. Extending either vocabulary starts in the Engine.
  `contracts/` must accept every draft and record the model accepts
  (`internal/importer/schema_test.go` checks this with the host's validator).
  `contracts/rule-record.schema.json` is an exact copy of the Compendium's,
  which applies the Engine's grants vocabulary to served records; copy it
  again whenever the Compendium's changes.
- Published records are never deleted, only withdrawn: a browser cannot learn
  a deleted key's tombstone revision and could not publish that id again.
- Every publish writes the records and the `homebrew_meta` revision in one
  guarded transaction. The worker trusts a scan only when that revision did not
  move during it.
- The rules-data methods run with the caller's authority (often a player), so
  they read only public collections. Import methods require the DM.
- The worker never serves a `ruleset` and only serves `hb.`-prefixed
  `magic-item` records; a duplicate id across providers disables every sheet.
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
