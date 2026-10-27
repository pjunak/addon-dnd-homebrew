import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

type Manifest = {
  packageFormat: number;
  id: string;
  version: string;
  capabilities: { required: string[] };
  rules: { supports: string[] };
  runtime: { ui: { entry: string }; worker: { type: string; entrypoints: Record<string, string> } };
  contributions: { id: string; surface: string; roles: string[] }[];
  collections: { id: string; visibility: string; schema: string }[];
  services: {
    provides: { contract: string; version: string; transport: string; schema: string }[];
    consumes?: unknown[];
  };
  permissions: unknown[];
};
const read = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8")) as unknown;
const manifest = (await read("addon.json")) as Manifest;

void test("manifest serves rules data from a worker and keeps drafts DM-only", () => {
  assert.equal(manifest.packageFormat, 1);
  assert.equal(manifest.id, "dnd-homebrew");
  assert.equal(manifest.version, "1.7.0");
  assert.equal(manifest.runtime.ui.entry, "web/index.js");
  assert.equal(manifest.runtime.worker.type, "native");
  assert.equal(Object.keys(manifest.runtime.worker.entrypoints).length, 3);
  assert.deepEqual(manifest.rules.supports, ["dnd-2024"]);
  assert.ok(manifest.capabilities.required.includes("services.own"));
  assert.deepEqual(
    manifest.collections.map(({ id, visibility }) => [id, visibility]),
    [
      ["homebrew_sets", "dm"],
      ["homebrew_items", "dm"],
      ["homebrew_published", "public"],
      ["homebrew_meta", "public"],
      ["homebrew_subclasses", "dm"],
      ["homebrew_published_subclasses", "public"],
      ["homebrew_feats", "dm"],
      ["homebrew_published_feats", "public"],
      ["homebrew_spells", "dm"],
      ["homebrew_published_spells", "public"],
      ["homebrew_species", "dm"],
      ["homebrew_published_species", "public"],
    ],
  );
  assert.deepEqual(
    manifest.services.provides.map(({ contract, version, transport }) => [
      contract,
      version,
      transport,
    ]),
    [
      ["dnd5e.rules-data", "3.0.0", "worker"],
      ["codex.import-adapter", "2.0.0", "worker"],
    ],
  );
  // The editor's pickers read the Compendium; the add-on works without it.
  assert.deepEqual(manifest.services.consumes, [
    {
      contract: "dnd5e.rules-data",
      range: "^3.0.0",
      cardinality: "many",
      required: false,
      selection: "all-compatible",
    },
  ]);
  assert.deepEqual(manifest.permissions, []);
  const roles = Object.fromEntries(manifest.contributions.map(({ id, roles }) => [id, roles]));
  assert.deepEqual(roles["homebrew.route"], ["dm"]);
  assert.deepEqual(roles["gallery.route"], ["dm", "player"]);
  assert.deepEqual(roles["homebrew.wiki"], ["dm", "player"]);
});

void test("every collection schema is closed and the service documents match the manifest", async () => {
  for (const collection of manifest.collections) {
    const schema = (await read(collection.schema)) as {
      type: string;
      additionalProperties: boolean;
    };
    assert.equal(schema.type, "object", collection.id);
    assert.equal(schema.additionalProperties, false, collection.id);
  }
  for (const service of manifest.services.provides) {
    const document = (await read(service.schema)) as { contract: string; version: string };
    assert.equal(document.contract, service.contract);
    assert.equal(document.version, service.version);
  }
});

void test("the rules-data service document is the compendium's contract", async () => {
  const document = (await read("contracts/rules-data.service.json")) as {
    methods: Record<string, unknown>;
  };
  assert.deepEqual(Object.keys(document.methods).sort(), ["catalog", "get", "query"]);
});
