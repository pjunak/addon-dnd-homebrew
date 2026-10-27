import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  exportDocument,
  flattenSpecies,
  newSpecies,
  parsePublishedSpecies,
  parseSpecies,
  planImport,
  planPublish,
  speciesProblem,
  type PublishedSpecies,
  type Species,
  type Stored,
} from "#web/model";

interface SpeciesFixture {
  valid: Species[];
  invalid: { name: string; change: Record<string, unknown> }[];
  published: PublishedSpecies;
}
const fixture = JSON.parse(
  await readFile(new URL("./fixtures/species.json", import.meta.url), "utf8"),
) as SpeciesFixture;
const sample = JSON.parse(
  await readFile(new URL("../docs/examples/sample-species.json", import.meta.url), "utf8"),
) as unknown;

void test("species drafts follow the shared fixture the worker checks", () => {
  for (const species of fixture.valid)
    assert.equal(speciesProblem(parseSpecies(species)), undefined, species.id);
  for (const testCase of fixture.invalid)
    assert.throws(() => parseSpecies({ ...fixture.valid[0]!, ...testCase.change }), testCase.name);
  assert.equal(speciesProblem(newSpecies("Starter", "starter", 1)), undefined);
});

void test("a species publishes as the record the worker serves", () => {
  const emberkin = fixture.valid[0]!;
  assert.deepEqual(flattenSpecies(emberkin), fixture.published);
  // The order a form lists sizes and resistances in does not matter.
  assert.deepEqual(
    flattenSpecies({ ...emberkin, sizes: ["Small", "Medium"], resistances: ["fire", "poison"] }),
    fixture.published,
  );
  assert.deepEqual(parsePublishedSpecies(fixture.published), fixture.published);
  const record = fixture.published.record;
  for (const broken of [
    { ...record, kind: "feat" },
    { ...record, size: "Medium" },
    { ...record, sizeOptions: ["Medium"], size: "Medium" },
    { ...record, speeds: { climb: "speed" } },
    { ...record, lineages: [{ id: "a", name: "A", text: "" }] },
  ])
    assert.throws(() => parsePublishedSpecies({ ...fixture.published, record: broken }));
  // A fixed size is the size itself, and the Engine reads it.
  const stoneborn = flattenSpecies(fixture.valid[1]!).record;
  assert.equal(stoneborn["size"], "Large");
  assert.equal("sizeOptions" in stoneborn, false);
  assert.equal("senses" in stoneborn, false);
  assert.equal("lineages" in stoneborn, false);
  assert.equal(
    stoneborn["text"],
    "**Creature Type:** Giant  \n**Size:** Large  \n**Speed:** 35 feet",
  );
  for (const species of fixture.valid) parsePublishedSpecies(flattenSpecies(species));
});

void test("species publish beside items, and a deleted species is withdrawn", () => {
  const species = fixture.valid[1]!;
  const meta = {
    value: { schemaVersion: 1 as const, revision: 1, publishedAt: 5, recordCount: 1 },
    revision: 3,
  };
  const plan = (drafts: Species[], published: Map<string, Stored<PublishedSpecies>>, now: number) =>
    planPublish(
      [],
      [],
      new Map(),
      now === 5 ? undefined : meta,
      now,
      [],
      new Map(),
      [],
      new Map(),
      [],
      new Map(),
      drafts,
      published,
    );
  const first = plan([species], new Map(), 5);
  assert.deepEqual(first.problems, []);
  assert.equal(first.recordCount, 1);
  assert.deepEqual(
    first.mutations.map((mutation) => [mutation.dataId, mutation.key]),
    [
      ["homebrew_published_species", "hb.stoneborn"],
      ["homebrew_meta", "publish"],
    ],
  );
  const published = new Map<string, Stored<PublishedSpecies>>([
    ["hb.stoneborn", { value: flattenSpecies(species), revision: 2 }],
  ]);
  assert.equal(plan([species], published, 6).mutations.length, 0);
  assert.deepEqual(
    plan([], published, 7).changes.map((change) => [change.id, change.operation]),
    [["hb.stoneborn", "withdraw"]],
  );
  const broken = plan([{ ...species, sizes: [] }], new Map(), 8);
  assert.equal(broken.problems[0]?.itemId, "stoneborn");
});

void test("the sample species import, and an export carries species back", () => {
  const imported = (document: unknown, stored: Map<string, Stored<unknown>>, now: number) =>
    planImport(document, new Map(), new Map(), now, new Map(), new Map(), new Map(), stored);
  const plan = imported(sample, new Map(), 9);
  assert.deepEqual(plan.summary, { creates: 2, updates: 0, skips: 0, deletes: 0 });
  const species = plan.mutations.map((mutation) =>
    parseSpecies(mutation.operation === "put" ? mutation.value : undefined),
  );
  // Omitted fields take the defaults of a new species.
  assert.equal(species[0]!.creatureType, "Humanoid");
  assert.equal(species[0]!.speed, 30);
  const stored = new Map(
    species.map((entry) => [entry.id, { value: entry as unknown, revision: 1 }]),
  );
  const again = imported(exportDocument([], [], 10, [], [], [], species), stored, 11);
  assert.deepEqual(again.summary, { creates: 0, updates: 0, skips: 2, deletes: 0 });
  // {} clears a species' grants; replacing with no species removes the drafts.
  const cleared = imported(
    {
      format: "dnd-homebrew",
      schemaVersion: 1,
      sets: [],
      items: [],
      species: [{ id: "mossfolk", grants: {} }],
    },
    stored,
    12,
  );
  assert.equal(
    "grants" in
      parseSpecies(cleared.mutations[0]?.operation === "put" && cleared.mutations[0].value),
    false,
  );
  const replaced = imported(
    { format: "dnd-homebrew", schemaVersion: 1, mode: "replace", sets: [], items: [] },
    stored,
    13,
  );
  assert.equal(replaced.summary.deletes, 2);
});
