import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  featFromTemplate,
  featTemplates,
  prerequisiteOf,
  simplePrerequisite,
} from "#web/feat-editor";
import {
  exportDocument,
  featProblem,
  flattenFeat,
  newFeat,
  parseFeat,
  parsePublishedFeat,
  planImport,
  planPublish,
  prerequisiteWords,
  type Feat,
  type Prerequisite,
  type PublishedFeat,
  type Stored,
} from "#web/model";

interface FeatFixture {
  valid: Feat[];
  invalid: { name: string; change: Record<string, unknown> }[];
  published: PublishedFeat;
  words: { prerequisites: Prerequisite; words: string }[];
}
const fixture = JSON.parse(
  await readFile(new URL("./fixtures/feats.json", import.meta.url), "utf8"),
) as FeatFixture;
const sample = JSON.parse(
  await readFile(new URL("../docs/examples/sample-feats.json", import.meta.url), "utf8"),
) as unknown;

void test("feat drafts follow the shared fixture the worker checks", () => {
  for (const feat of fixture.valid) assert.equal(featProblem(parseFeat(feat)), undefined, feat.id);
  for (const testCase of fixture.invalid)
    assert.throws(() => parseFeat({ ...fixture.valid[0]!, ...testCase.change }), testCase.name);
});

void test("a feat publishes as the record the worker serves", () => {
  assert.deepEqual(flattenFeat(fixture.valid[0]!), fixture.published);
  assert.deepEqual(parsePublishedFeat(fixture.published), fixture.published);
  assert.throws(() =>
    parsePublishedFeat({
      ...fixture.published,
      record: { ...fixture.published.record, kind: "subclass" },
    }),
  );
});

void test("a prerequisite reads as the books print it", () => {
  for (const testCase of fixture.words)
    assert.equal(prerequisiteWords(testCase.prerequisites), testCase.words);
});

void test("the prerequisite form shows printed prerequisites and writes them back", () => {
  const shown: [Prerequisite, Prerequisite][] = [
    [{}, {}],
    [{ level: 19 }, { level: 19 }],
    [
      { level: 4, abilities: { CHA: 13 } },
      { level: 4, abilities: { CHA: 13 } },
    ],
    // A level repeated in each branch becomes the feat's own.
    [
      {
        any: [
          { level: 4, abilities: { STR: 13 } },
          { level: 4, abilities: { DEX: 13 } },
        ],
      },
      { level: 4, any: [{ abilities: { STR: 13 } }, { abilities: { DEX: 13 } }] },
    ],
    [
      { level: 4, spellcastingFeature: true },
      { level: 4, spellcastingFeature: true },
    ],
    [
      { level: 4, armorTraining: "medium" },
      { level: 4, armorTraining: "medium" },
    ],
    [fixture.valid[2]!.prerequisites, fixture.valid[2]!.prerequisites],
  ];
  for (const [stored, written] of shown) {
    const form = simplePrerequisite(stored);
    assert.ok(form, JSON.stringify(stored));
    assert.deepEqual(prerequisiteOf(form), written);
    assert.equal(prerequisiteWords(written), prerequisiteWords(stored));
  }
  // Abilities and a fighting style together need both groups.
  const both = prerequisiteOf({
    abilities: ["STR", "DEX"],
    score: 13,
    casting: "",
    armorTraining: "",
    weaponTraining: "",
    fightingStyle: true,
  });
  assert.deepEqual(simplePrerequisite(both)?.abilities, ["STR", "DEX"]);
  assert.equal(simplePrerequisite(both)?.fightingStyle, true);
  // A prerequisite the form cannot show is left alone.
  assert.equal(simplePrerequisite(fixture.valid[3]!.prerequisites), undefined);
  assert.equal(simplePrerequisite({ classes: { wizard: 5 } }), undefined);
});

void test("every feat template makes a feat the model accepts", () => {
  const draft = { ...newFeat("Starter", "starter", 1), text: "My words." };
  for (const template of featTemplates) {
    const feat = featFromTemplate(template, draft);
    assert.equal(featProblem(feat), undefined, template.id);
    assert.equal(feat.name, "Starter");
    assert.equal(feat.text, "My words.");
    assert.equal(feat.category, template.feat.category);
  }
  assert.equal(featProblem(newFeat("Starter", "starter", 1)), undefined);
});

void test("feats publish beside items, and a deleted feat is withdrawn", () => {
  const feat = fixture.valid[1]!;
  const first = planPublish([], [], new Map(), undefined, 5, [], new Map(), [feat], new Map());
  assert.deepEqual(first.problems, []);
  assert.deepEqual(
    first.changes.map((change) => [change.id, change.operation]),
    [["hb.lantern-bearer", "add"]],
  );
  assert.equal(first.recordCount, 1);
  const published = new Map<string, Stored<PublishedFeat>>([
    ["hb.lantern-bearer", { value: flattenFeat(feat), revision: 2 }],
  ]);
  const meta = {
    value: { schemaVersion: 1 as const, revision: 1, publishedAt: 5, recordCount: 1 },
    revision: 3,
  };
  const unchanged = planPublish([], [], new Map(), meta, 6, [], new Map(), [feat], published);
  assert.equal(unchanged.mutations.length, 0);
  const removed = planPublish([], [], new Map(), meta, 7, [], new Map(), [], published);
  assert.deepEqual(
    removed.changes.map((change) => [change.id, change.operation]),
    [["hb.lantern-bearer", "withdraw"]],
  );
  const broken = planPublish([], [], new Map(), meta, 8, [], new Map(), [
    { ...feat, prerequisites: { text: "a Dwarf" } },
  ]);
  assert.equal(broken.problems[0]?.itemId, "lantern-bearer");
});

void test("the sample feats import, and an export carries feats back", () => {
  const plan = planImport(sample, new Map(), new Map(), 9, new Map(), new Map());
  assert.deepEqual(plan.summary, { creates: 4, updates: 0, skips: 0, deletes: 0 });
  const feats = plan.mutations.map((mutation) =>
    parseFeat(mutation.operation === "put" ? mutation.value : undefined),
  );
  assert.ok(feats.every((feat) => featProblem(feat) === undefined));
  const stored = new Map(feats.map((feat) => [feat.id, { value: feat as unknown, revision: 1 }]));
  const again = planImport(
    exportDocument([], [], 10, [], feats),
    new Map(),
    new Map(),
    11,
    new Map(),
    stored,
  );
  assert.deepEqual(again.summary, { creates: 0, updates: 0, skips: 4, deletes: 0 });
});
