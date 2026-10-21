import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canonical,
  effectProblem,
  exportDocument,
  flatten,
  freeId,
  grantsProblem,
  HomebrewError,
  itemProblem,
  mechanicsProblem,
  parseClass,
  parseItem,
  parsePublished,
  planImport,
  planPublish,
  slug,
  type Effect,
  type Item,
  type ItemClass,
  type Published,
  type Stored,
} from "#web/model";

const fixture = async <T,>(name: string): Promise<T> =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as T;

interface EffectFixture {
  valid: Effect[];
  invalid: Effect[];
  invalidSets: Effect[][];
  validSets: Effect[][];
  grants: { valid: GrantsCase[]; invalid: GrantsCase[] };
}
interface GrantsCase {
  name: string;
  grants: unknown;
}
interface PublishFixture {
  classes: ItemClass[];
  cases: { name: string; item: Item; published: Published }[];
}
interface ImportFixture {
  now: number;
  stored: { classes: unknown[]; items: unknown[] };
  cases: {
    name: string;
    document: unknown;
    summary?: { creates: number; updates: number; skips: number; deletes: number };
    changes?: [string, string, string][];
    values?: Record<string, Record<string, unknown>>;
    errorIncludes?: string;
  }[];
}

void test("effects follow the shared Engine vocabulary fixture", async () => {
  const effects = await fixture<EffectFixture>("effects.json");
  for (const effect of effects.valid)
    assert.equal(effectProblem(effect), undefined, JSON.stringify(effect));
  for (const effect of effects.invalid) assert.ok(effectProblem(effect), JSON.stringify(effect));
  for (const set of effects.invalidSets)
    assert.ok(mechanicsProblem("complete", set), JSON.stringify(set));
  for (const set of effects.validSets)
    assert.equal(mechanicsProblem("complete", set), undefined, JSON.stringify(set));
  assert.ok(mechanicsProblem("narrative", [effects.valid[0]!]));
  assert.ok(mechanicsProblem("complete", []));
  assert.equal(mechanicsProblem("narrative", []), undefined);
});

void test("grants follow the shared Engine allowlist fixture", async () => {
  const { grants } = await fixture<EffectFixture>("effects.json");
  assert.ok(grants.valid.length > 0 && grants.invalid.length > 0);
  for (const testCase of grants.valid)
    assert.equal(grantsProblem(testCase.grants), undefined, testCase.name);
  for (const testCase of grants.invalid) assert.ok(grantsProblem(testCase.grants), testCase.name);
  const deathSaves = { advantages: [{ on: "deathSave" }] };
  assert.equal(mechanicsProblem("complete", [], deathSaves), undefined, "grants alone automate");
  assert.ok(mechanicsProblem("narrative", [], deathSaves), "a text-only item declares neither");
  assert.ok(mechanicsProblem("complete", [], {}), "empty grants are refused");
});

void test("flattening matches the published fixture the worker serves", async () => {
  const publish = await fixture<PublishFixture>("publish.json");
  const classes = new Map(publish.classes.map((entry) => [entry.id, parseClass(entry)]));
  for (const testCase of publish.cases) {
    const item = parseItem(testCase.item);
    assert.deepEqual(flatten(classes.get(item.classId), item), testCase.published, testCase.name);
    assert.deepEqual(parsePublished(testCase.published), testCase.published);
  }
});

void test("imports plan exactly like the worker importer", async () => {
  const imports = await fixture<ImportFixture>("imports.json");
  const stored = (values: unknown[]): Map<string, Stored<unknown>> =>
    new Map(values.map((value) => [(value as { id: string }).id, { value, revision: 4 }]));
  for (const testCase of imports.cases) {
    const run = () =>
      planImport(
        testCase.document,
        stored(imports.stored.classes),
        stored(imports.stored.items),
        imports.now,
      );
    if (testCase.errorIncludes) {
      assert.throws(
        run,
        (error: unknown) =>
          error instanceof HomebrewError && error.message.includes(testCase.errorIncludes!),
        testCase.name,
      );
      continue;
    }
    const plan = run();
    assert.deepEqual(plan.summary, testCase.summary, testCase.name);
    assert.deepEqual(
      plan.changes.map((change) => [change.collection, change.id, change.operation]),
      testCase.changes,
      testCase.name,
    );
    for (const [path, expected] of Object.entries(testCase.values ?? {})) {
      const [collection, key] = path.split("/");
      const mutation = plan.mutations.find(
        (entry) => entry.dataId === collection && entry.key === key,
      );
      assert.ok(mutation && mutation.operation === "put", `${testCase.name}: ${path}`);
      const value = mutation.value as Record<string, unknown>;
      for (const [field, want] of Object.entries(expected))
        assert.deepEqual(value[field], want, `${testCase.name}: ${path}.${field}`);
    }
  }
});

void test("a class condition reaches every item, even a text-only one", async () => {
  const publish = await fixture<PublishFixture>("publish.json");
  const [cards, omens] = publish.classes.map((entry) => parseClass(entry));
  const courage = parseItem({ ...publish.cases[2]!.item, id: "courage", classId: cards!.id });
  assert.equal(courage.characterMechanics, "narrative");
  const published = flatten(cards, courage);
  assert.equal(published.record.characterMechanics, "complete");
  assert.deepEqual(published.record.grants, { conditions: [cards!.condition] });
  assert.deepEqual(parsePublished(published), published);
  const plain = flatten(omens, { ...courage, classId: omens!.id }).record;
  assert.equal(plain.characterMechanics, "narrative");
  assert.equal(plain.grants, undefined);
  const drafted = {
    ...courage,
    characterMechanics: "complete" as const,
    grants: { conditions: [] },
  };
  assert.ok(itemProblem(drafted), "a draft takes its conditions from the class");
});

void test("the sample file imports 1 class and 12 items, 11 automated", async () => {
  const document = JSON.parse(
    await readFile(new URL("../docs/examples/sample-items.json", import.meta.url), "utf8"),
  ) as unknown;
  const plan = planImport(document, new Map(), new Map(), 1);
  assert.equal(plan.summary.creates, 13);
  const items = plan.mutations
    .filter((mutation) => mutation.dataId === "homebrew_items" && mutation.operation === "put")
    .map((mutation) => (mutation.operation === "put" ? parseItem(mutation.value) : undefined));
  assert.equal(items.length, 12);
  assert.equal(items.filter((item) => item?.characterMechanics === "complete").length, 11);
  assert.equal(items.filter((item) => item?.grants !== undefined).length, 7);
  const classWrite = plan.mutations.find((mutation) => mutation.dataId === "homebrew_classes");
  assert.ok(classWrite?.operation === "put");
  const itemClass = parseClass(classWrite.value);
  assert.equal(itemClass.condition?.id, "rune-bound");
  const records = items.map(
    (item) => parsePublished(flatten(item!.classId ? itemClass : undefined, item!)).record,
  );
  assert.ok(records.every((record) => record.characterMechanics === "complete"));
  const record = (id: string) => records.find((entry) => entry.id === `hb.${id}`)!;
  assert.deepEqual(record("fortune").grants?.resources, [
    { key: "uses", name: "Fortune", fixed: 1, recharge: "long" },
  ]);
  assert.deepEqual(record("blessing").grants?.spells, [{ ids: ["bless"], resource: "uses" }]);
  assert.deepEqual(record("echo").grants, { conditions: [itemClass.condition] });
  assert.equal(record("lantern-of-embers").grants?.conditions, undefined);
  assert.equal(record("lantern-of-embers").rarity, "Rare");
  const lore = flatten(
    itemClass,
    items.find((item) => item?.id === "lore")!,
  );
  assert.equal(lore.record.name, "Runestone: Lore");
  assert.equal(lore.playerVisible, false);
});

void test("publishing writes only changes and always moves the metadata revision", async () => {
  const publish = await fixture<PublishFixture>("publish.json");
  const classes = publish.classes;
  const items = publish.cases.map((testCase) => testCase.item);
  const first = planPublish(classes, items, new Map(), undefined, 50);
  assert.deepEqual(first.problems, []);
  assert.equal(first.recordCount, 4);
  assert.equal(first.mutations.length, 5);
  const meta = first.mutations.at(-1)!;
  assert.equal(meta.dataId, "homebrew_meta");
  assert.equal(meta.expectedRevision, 0);
  assert.deepEqual(meta.operation === "put" && meta.value, {
    schemaVersion: 1,
    revision: 1,
    publishedAt: 50,
    recordCount: 4,
  });

  const stored = new Map<string, Stored<Published>>(
    publish.cases.map((testCase) => [
      testCase.published.id,
      { value: testCase.published, revision: 2 },
    ]),
  );
  const metaStored = {
    value: { schemaVersion: 1 as const, revision: 1, publishedAt: 50, recordCount: 4 },
    revision: 7,
  };
  assert.equal(
    planPublish(classes, items, stored, metaStored, 60).mutations.length,
    0,
    "nothing to publish",
  );

  const edited = items.map((item) =>
    item.id === "defense" ? { ...item, text: "Changed." } : item,
  );
  const removed = edited.filter((item) => item.id !== "trinket");
  const second = planPublish(classes, removed, stored, metaStored, 70);
  assert.deepEqual(
    second.changes.map((change) => [change.id, change.operation]),
    [
      ["hb.defense", "update"],
      ["hb.trinket", "withdraw"],
    ],
  );
  const withdrawn = second.mutations.find((mutation) => mutation.key === "hb.trinket")!;
  assert.equal(withdrawn.operation, "put", "a removed record is withdrawn, never deleted");
  assert.equal(withdrawn.expectedRevision, 2);
  assert.equal((withdrawn as { value: Published }).value.withdrawn, true);
  const nextMeta = second.mutations.at(-1)!;
  assert.equal(nextMeta.expectedRevision, 7);
  assert.equal((nextMeta as { value: { revision: number } }).value.revision, 2);

  const orphan = planPublish([], [items[0]!], new Map(), undefined, 1);
  assert.equal(orphan.problems.length, 1);
  assert.equal(orphan.mutations.length, 0);
});

void test("ids come from names and avoid listed drafts", () => {
  assert.equal(slug("Eternal Charisma"), "eternal-charisma");
  assert.equal(slug("Žluťoučký kůň!"), "zlutoucky-kun");
  assert.equal(slug("!!!"), "item");
  assert.equal(freeId("Luna", new Set(["luna", "luna-2"])), "luna-3");
  assert.equal(canonical({ b: 1, a: [{ d: 1, c: 2 }] }), '{"a":[{"c":2,"d":1}],"b":1}');
});

void test("an export imports back unchanged", async () => {
  const publish = await fixture<PublishFixture>("publish.json");
  const items = publish.cases.map((testCase) => testCase.item);
  const document = JSON.parse(JSON.stringify(exportDocument(publish.classes, items, 9))) as unknown;
  const fresh = planImport(document, new Map(), new Map(), 10);
  assert.deepEqual(fresh.summary, { creates: 6, updates: 0, skips: 0, deletes: 0 });
  const stored = <T extends { id: string }>(values: readonly T[]) =>
    new Map(values.map((value) => [value.id, { value: value as unknown, revision: 1 }]));
  const again = planImport(document, stored(publish.classes), stored(items), 10);
  assert.deepEqual(again.summary, { creates: 0, updates: 0, skips: 6, deletes: 0 });
});
