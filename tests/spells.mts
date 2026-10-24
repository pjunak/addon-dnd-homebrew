import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { durationOf, writtenDuration } from "#web/spell-editor";
import {
  exportDocument,
  flattenSpell,
  newSpell,
  parsePublishedSpell,
  parseSpell,
  planImport,
  planPublish,
  spellHeader,
  spellProblem,
  type PublishedSpell,
  type Spell,
  type Stored,
} from "#web/model";

interface SpellFixture {
  valid: Spell[];
  invalid: { name: string; change: Record<string, unknown> }[];
  published: PublishedSpell;
  headers: { spell: Pick<Spell, "level" | "school" | "classes">; header: string }[];
}
const fixture = JSON.parse(
  await readFile(new URL("./fixtures/spells.json", import.meta.url), "utf8"),
) as SpellFixture;
const sample = JSON.parse(
  await readFile(new URL("../docs/examples/sample-spells.json", import.meta.url), "utf8"),
) as unknown;

void test("spell drafts follow the shared fixture the worker checks", () => {
  for (const spell of fixture.valid)
    assert.equal(spellProblem(parseSpell(spell)), undefined, spell.id);
  for (const testCase of fixture.invalid)
    assert.throws(() => parseSpell({ ...fixture.valid[0]!, ...testCase.change }), testCase.name);
});

void test("a spell publishes as the record the worker serves", () => {
  assert.deepEqual(flattenSpell(fixture.valid[0]!), fixture.published);
  // The order a form or file lists classes and components in does not matter.
  assert.deepEqual(
    flattenSpell({
      ...fixture.valid[0]!,
      classes: ["wizard", "sorcerer"],
      components: ["M", "S", "V"],
    }),
    fixture.published,
  );
  assert.deepEqual(parsePublishedSpell(fixture.published), fixture.published);
  for (const record of [
    { ...fixture.published.record, kind: "feat" },
    { ...fixture.published.record, components: ["V", "S"] },
    { ...fixture.published.record, material: "" },
  ])
    assert.throws(() => parsePublishedSpell({ ...fixture.published, record }));
  // Every valid draft publishes a record the parser accepts.
  for (const spell of fixture.valid) parsePublishedSpell(flattenSpell(spell));
});

void test("the stat block reads as the books print it", () => {
  for (const testCase of fixture.headers)
    assert.equal(spellHeader(testCase.spell), testCase.header);
  const [, ward, map, storm] = fixture.valid.map((spell) => flattenSpell(spell).record);
  // Components in printed order, a ritual's casting time and no material without M.
  assert.match(
    ward!.text,
    /\*\*Components:\*\* V, S {2}\n\*\*Duration:\*\* Concentration, up to 1 minute\n\n/u,
  );
  assert.deepEqual(ward!.components, ["V", "S"]);
  assert.equal("material" in ward!, false);
  assert.match(map!.text, /\*\*Casting Time:\*\* 10 minutes or Ritual {2}\n/u);
  // A spell without text of its own publishes the stat block alone.
  assert.ok(storm!.text.startsWith("*Level 3 Abjuration*  \n"), storm!.text);
  assert.ok(storm!.text.endsWith("**Duration:** 1 round"), storm!.text);
});

void test("the editor shows a concentration duration without its printed start", () => {
  const ward = fixture.valid[1]!;
  assert.equal(writtenDuration(ward), "1 minute");
  assert.equal(durationOf(true, "1 minute"), ward.duration);
  // Typing the printed form, or switching concentration off, keeps one prefix.
  assert.equal(durationOf(true, ward.duration), ward.duration);
  assert.equal(durationOf(false, "1 minute"), "1 minute");
  assert.equal(writtenDuration(fixture.valid[0]!), "Instantaneous");
  assert.equal(spellProblem(newSpell("Starter", "starter", 1)), undefined);
});

void test("spells publish beside items, and a deleted spell is withdrawn", () => {
  const spell = fixture.valid[2]!;
  const plan = (spells: Spell[], published: Map<string, Stored<PublishedSpell>>, now: number) =>
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
      spells,
      published,
    );
  const meta = {
    value: { schemaVersion: 1 as const, revision: 1, publishedAt: 5, recordCount: 1 },
    revision: 3,
  };
  const first = plan([spell], new Map(), 5);
  assert.deepEqual(first.problems, []);
  assert.deepEqual(
    first.changes.map((change) => [change.id, change.operation]),
    [["hb.whispered-map", "add"]],
  );
  assert.equal(first.recordCount, 1);
  assert.deepEqual(
    first.mutations.map((mutation) => [mutation.dataId, mutation.key]),
    [
      ["homebrew_published_spells", "hb.whispered-map"],
      ["homebrew_meta", "publish"],
    ],
  );
  const published = new Map<string, Stored<PublishedSpell>>([
    ["hb.whispered-map", { value: flattenSpell(spell), revision: 2 }],
  ]);
  assert.equal(plan([spell], published, 6).mutations.length, 0);
  assert.deepEqual(
    plan([], published, 7).changes.map((change) => [change.id, change.operation]),
    [["hb.whispered-map", "withdraw"]],
  );
  const broken = plan([{ ...spell, school: "Chronomancy" as Spell["school"] }], new Map(), 8);
  assert.equal(broken.problems[0]?.itemId, "whispered-map");
});

void test("the sample spells import, and an export carries spells back", () => {
  const plan = planImport(sample, new Map(), new Map(), 9, new Map(), new Map(), new Map());
  assert.deepEqual(plan.summary, { creates: 3, updates: 0, skips: 0, deletes: 0 });
  const spells = plan.mutations.map((mutation) =>
    parseSpell(mutation.operation === "put" ? mutation.value : undefined),
  );
  assert.ok(spells.every((spell) => spellProblem(spell) === undefined));
  const stored = new Map(
    spells.map((spell) => [spell.id, { value: spell as unknown, revision: 1 }]),
  );
  const again = planImport(
    exportDocument([], [], 10, [], [], spells),
    new Map(),
    new Map(),
    11,
    new Map(),
    new Map(),
    stored,
  );
  assert.deepEqual(again.summary, { creates: 0, updates: 0, skips: 3, deletes: 0 });
  // Replacing with a file that has no spells removes the drafts.
  const replaced = planImport(
    { format: "dnd-homebrew", schemaVersion: 1, mode: "replace", sets: [], items: [] },
    new Map(),
    new Map(),
    12,
    new Map(),
    new Map(),
    stored,
  );
  assert.equal(replaced.summary.deletes, 3);
});
