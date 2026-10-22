// Keeps contracts/engine-grants.schema.json an exact copy of the Engine's
// grants vocabulary (contracts/grants.schema.json) at the pinned Engine
// version, so a served record's grants are checked against the rules the
// Engine applies. The Compendium pins the same version for its records.
//   node tools/engine-grants.mts check   fail when the copy differs
//   node tools/engine-grants.mts sync    rewrite the copy
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const engine = "github.com/pjunak/addon-dnd-engine";
const version = "v0.0.0-20261021231403-bb1b8cc3d60f";
const root = fileURLToPath(new URL("../", import.meta.url));
const target = resolve(root, "contracts/engine-grants.schema.json");
const mode = process.argv[2];
if (mode !== "check" && mode !== "sync") {
  console.error("usage: node tools/engine-grants.mts check|sync");
  process.exit(2);
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Moves the Engine's root-relative references under `$defs.grants`. */
function nest(value: Json): Json {
  if (Array.isArray(value)) return value.map(nest);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      key === "$ref" && typeof entry === "string" && entry.startsWith("#/$defs/")
        ? `#/$defs/grants/$defs/${entry.slice("#/$defs/".length)}`
        : nest(entry),
    ]),
  );
}

const download = JSON.parse(
  execFileSync("go", ["mod", "download", "-json", `${engine}@${version}`], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  }),
) as { Dir?: string; Error?: string };
if (!download.Dir) throw new Error(download.Error ?? `could not download ${engine}@${version}`);
const { $schema: _, ...vocabulary } = JSON.parse(
  readFileSync(resolve(download.Dir, "contracts/grants.schema.json"), "utf8"),
) as Record<string, Json>;
const expected = `${JSON.stringify(
  {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $comment: `The Engine's grants vocabulary, copied from ${engine}@${version} contracts/grants.schema.json by tools/engine-grants.mts; do not edit.`,
    $defs: { grants: nest(vocabulary) },
  },
  null,
  2,
)}\n`;
let current: string | undefined;
try {
  current = readFileSync(target, "utf8");
} catch {
  current = undefined;
}
if (current === expected) {
  console.log(`Engine grants match ${engine}@${version}.`);
} else if (mode === "sync") {
  writeFileSync(target, expected);
  console.log(`Copied the grants vocabulary from ${engine}@${version}.`);
} else {
  console.error(
    `contracts/engine-grants.schema.json differs from ${engine}@${version}.\n` +
      "Run npm run sync:engine-grants after changing the Engine version.",
  );
  process.exitCode = 1;
}
