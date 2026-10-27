import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { featChoicesOf, featChoicesText } from "#web/background-editor";
import {
  backgroundProblem,
  exportDocument,
  flattenBackground,
  newBackground,
  parseBackground,
  parsePublishedBackground,
  planImport,
  planPublish,
  toolWords,
  type Background,
  type PublishedBackground,
  type Stored,
} from "#web/model";

interface BackgroundFixture {
  valid: Background[];
  invalid: { name: string; change: Record<string, unknown> }[];
  published: PublishedBackground;
}
const fixture = JSON.parse(
  await readFile(new URL("./fixtures/backgrounds.json", import.meta.url), "utf8"),
) as BackgroundFixture;
const sample = JSON.parse(
  await readFile(new URL("../docs/examples/sample-backgrounds.json", import.meta.url), "utf8"),
) as unknown;

void test("background drafts follow the shared fixture the worker checks", () => {
  for (const background of fixture.valid)
    assert.equal(backgroundProblem(parseBackground(background)), undefined, background.id);
  for (const testCase of fixture.invalid)
    assert.throws(
      () => parseBackground({ ...fixture.valid[0]!, ...testCase.change }),
      testCase.name,
    );
  assert.equal(backgroundProblem(newBackground("Starter", "starter", 1)), undefined);
});

void test("a background publishes as the record the worker serves", () => {
  const lamplighter = fixture.valid[0]!;
  assert.deepEqual(flattenBackground(lamplighter), fixture.published);
  // The order a form lists abilities and skills in does not matter.
  assert.deepEqual(
    flattenBackground({
      ...lamplighter,
      abilityScores: ["INT", "WIS", "DEX"],
      skillProficiencies: ["perception", "investigation"],
    }),
    fixture.published,
  );
  assert.deepEqual(parsePublishedBackground(fixture.published), fixture.published);
  const record = fixture.published.record;
  for (const broken of [
    { ...record, kind: "feat" },
    { ...record, toolProficiencyChoice: { count: 1, from: ["a", "b"] } },
    { ...record, originFeat: undefined },
    { ...record, grants: { acBonus: 1 } },
  ])
    assert.throws(() =>
      parsePublishedBackground({
        ...fixture.published,
        record: JSON.parse(JSON.stringify(broken)) as PublishedBackground["record"],
      }),
    );
  // Several tools become the player's pick; none leaves both fields out.
  const scholar = flattenBackground(fixture.valid[1]!).record;
  assert.deepEqual(scholar["toolProficiencyChoice"], {
    count: 1,
    from: ["calligraphers-supplies", "cartographers-tools", "painters-supplies"],
  });
  assert.equal("toolProficiency" in scholar, false);
  assert.match(
    String(scholar["text"]),
    /\*\*Tool Proficiency:\*\* Choose one of Calligrapher's Supplies, Cartographer's Tools, or Painter's Supplies$/u,
  );
  const wanderer = flattenBackground(fixture.valid[2]!).record;
  assert.equal("originFeat" in wanderer, false);
  assert.equal(wanderer["text"], "**Ability Scores:** Strength, Dexterity, Constitution");
  for (const background of fixture.valid) parsePublishedBackground(flattenBackground(background));
});

void test("tools and preset feat choices read as typed and as printed", () => {
  assert.equal(toolWords("smiths-tools"), "Smith's Tools");
  assert.equal(toolWords("thieves-tools"), "Thieves' Tools");
  assert.equal(toolWords("herbalism-kit"), "Herbalism Kit");
  assert.equal(toolWords("cooks-utensils"), "Cook's Utensils");
  assert.deepEqual(featChoicesOf("spell-list: wizard, other : value"), {
    "spell-list": "wizard",
    other: "value",
  });
  assert.equal(featChoicesOf("  "), undefined);
  assert.equal(featChoicesText({ "spell-list": "wizard" }), "spell-list: wizard");
});

void test("backgrounds publish beside items, and a deleted background is withdrawn", () => {
  const background = fixture.valid[2]!;
  const meta = {
    value: { schemaVersion: 1 as const, revision: 1, publishedAt: 5, recordCount: 1 },
    revision: 3,
  };
  const plan = (
    drafts: Background[],
    published: Map<string, Stored<PublishedBackground>>,
    now: number,
  ) =>
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
      [],
      new Map(),
      drafts,
      published,
    );
  const first = plan([background], new Map(), 5);
  assert.deepEqual(first.problems, []);
  assert.deepEqual(
    first.mutations.map((mutation) => [mutation.dataId, mutation.key]),
    [
      ["homebrew_published_backgrounds", "hb.wanderer"],
      ["homebrew_meta", "publish"],
    ],
  );
  const published = new Map<string, Stored<PublishedBackground>>([
    ["hb.wanderer", { value: flattenBackground(background), revision: 2 }],
  ]);
  assert.equal(plan([background], published, 6).mutations.length, 0);
  assert.deepEqual(
    plan([], published, 7).changes.map((change) => [change.id, change.operation]),
    [["hb.wanderer", "withdraw"]],
  );
  const broken = plan([{ ...background, abilityScores: ["STR"] }], new Map(), 8);
  assert.equal(broken.problems[0]?.itemId, "wanderer");
});

void test("the sample backgrounds import, and an export carries backgrounds back", () => {
  const imported = (document: unknown, stored: Map<string, Stored<unknown>>, now: number) =>
    planImport(
      document,
      new Map(),
      new Map(),
      now,
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      stored,
    );
  const plan = imported(sample, new Map(), 9);
  assert.deepEqual(plan.summary, { creates: 2, updates: 0, skips: 0, deletes: 0 });
  const backgrounds = plan.mutations.map((mutation) =>
    parseBackground(mutation.operation === "put" ? mutation.value : undefined),
  );
  // Omitted fields take the defaults of a new background.
  assert.equal(backgrounds[0]!.toolPicks, 1);
  const stored = new Map(
    backgrounds.map((entry) => [entry.id, { value: entry as unknown, revision: 1 }]),
  );
  const again = imported(exportDocument([], [], 10, [], [], [], [], backgrounds), stored, 11);
  assert.deepEqual(again.summary, { creates: 0, updates: 0, skips: 2, deletes: 0 });
  // {} clears preset feat choices; replacing with no backgrounds removes the drafts.
  const cleared = imported(
    {
      format: "dnd-homebrew",
      schemaVersion: 1,
      sets: [],
      items: [],
      backgrounds: [{ id: "lamplighter", originFeatChoices: {} }],
    },
    stored,
    12,
  );
  const mutation = cleared.mutations[0];
  assert.equal(
    "originFeatChoices" in parseBackground(mutation?.operation === "put" && mutation.value),
    false,
  );
  const replaced = imported(
    { format: "dnd-homebrew", schemaVersion: 1, mode: "replace", sets: [], items: [] },
    stored,
    13,
  );
  assert.equal(replaced.summary.deletes, 2);
});
