import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  flattenSubclass,
  parsePublishedSubclass,
  parseSubclass,
  planImport,
  planPublish,
  subclassProblem,
  type PublishedSubclass,
  type Stored,
  type Subclass,
} from "#web/model";

interface SubclassFixture {
  valid: Subclass[];
  invalid: { name: string; change: Record<string, unknown> }[];
  published: PublishedSubclass;
}
const fixture = JSON.parse(
  await readFile(new URL("./fixtures/subclasses.json", import.meta.url), "utf8"),
) as SubclassFixture;

void test("subclass drafts follow the shared fixture the worker checks", () => {
  for (const draft of fixture.valid) assert.deepEqual(parseSubclass(draft), draft, draft.id);
  for (const testCase of fixture.invalid)
    assert.throws(() => parseSubclass({ ...fixture.valid[0]!, ...testCase.change }), testCase.name);
});

void test("a problem names the feature and the grant that break", () => {
  const draft = {
    ...fixture.valid[0]!,
    features: [
      {
        id: "war-drum",
        level: 3,
        name: "War Drum",
        text: "",
        excerpt: "",
        grants: { resources: [{ key: "beats", fixed: "2" }] },
      },
    ],
  };
  assert.deepEqual(subclassProblem(draft), {
    text: "{path} must be a whole number.",
    params: { path: "features[0].grants.resources[0].fixed" },
  });
});

void test("publishing flattens a subclass into its subclass and feature records", () => {
  const published = flattenSubclass(fixture.valid[0]!);
  assert.deepEqual(published, fixture.published);
  assert.deepEqual(parsePublishedSubclass(published), published);
  const scribe = flattenSubclass(fixture.valid[1]!);
  assert.deepEqual(scribe.records.length, 1, "a subclass without features has one record");
  assert.equal(scribe.records[0]?.["spellcasting"] !== undefined, true);
  assert.throws(() =>
    parsePublishedSubclass({
      ...published,
      records: [published.records[0], { ...published.records[1], subclassId: "hb.other" }],
    }),
  );
});

void test("one publish writes subclasses and items with one metadata revision", () => {
  const first = planPublish([], [], new Map(), undefined, 10, fixture.valid);
  assert.deepEqual(first.problems, []);
  assert.deepEqual(
    first.mutations.map((mutation) => [mutation.dataId, mutation.key]),
    [
      ["homebrew_published_subclasses", "hb.rune-scribe"],
      ["homebrew_published_subclasses", "hb.storm-drum"],
      ["homebrew_meta", "publish"],
    ],
  );
  assert.equal(first.recordCount, 6, "two subclass records and four features");
  const stored = new Map<string, Stored<PublishedSubclass>>(
    fixture.valid.map((draft) => [
      `hb.${draft.id}`,
      { value: flattenSubclass(draft), revision: 3 },
    ]),
  );
  const meta = {
    value: { schemaVersion: 1 as const, revision: 1, publishedAt: 10, recordCount: 6 },
    revision: 4,
  };
  assert.equal(planPublish([], [], new Map(), meta, 11, fixture.valid, stored).mutations.length, 0);
  const withdrawn = planPublish([], [], new Map(), meta, 12, fixture.valid.slice(0, 1), stored);
  assert.deepEqual(
    withdrawn.changes.map((change) => [change.id, change.operation]),
    [["hb.rune-scribe", "withdraw"]],
  );
  const broken = { ...fixture.valid[0]!, grants: { teleport: 30 } };
  assert.equal(
    planPublish([], [], new Map(), meta, 13, [broken]).problems[0]?.itemId,
    "storm-drum",
  );
});

void test("an import adds subclasses after items and clears spellcasting with its table", () => {
  const entries = fixture.valid.map((draft) => {
    const { schemaVersion: _version, updatedAt: _updated, ...entry } = draft;
    return entry;
  });
  const document = (mode: string, subclasses: unknown[]) => ({
    format: "dnd-homebrew",
    schemaVersion: 1,
    mode,
    sets: [],
    items: [{ id: "lamp", name: "Lamp" }],
    subclasses,
  });
  const created = planImport(document("merge", entries), new Map(), new Map(), 7);
  assert.deepEqual(
    created.changes.map((change) => [change.collection, change.id]),
    [
      ["homebrew_items", "lamp"],
      ["homebrew_subclasses", "rune-scribe"],
      ["homebrew_subclasses", "storm-drum"],
    ],
  );
  const stored = new Map(
    created.mutations
      .filter((mutation) => mutation.dataId === "homebrew_subclasses")
      .map((mutation) => [
        mutation.key,
        { value: mutation.operation === "put" ? mutation.value : undefined, revision: 2 },
      ]),
  );
  const cleared = planImport(
    document("merge", [{ id: "rune-scribe", spellcasting: {} }]),
    new Map(),
    new Map(),
    8,
    stored,
  );
  const scribe = cleared.mutations.find((mutation) => mutation.key === "rune-scribe");
  assert.ok(scribe?.operation === "put");
  assert.equal((scribe.value as Record<string, unknown>)["progression"], undefined);
  assert.throws(
    () =>
      planImport(
        document("merge", [
          {
            id: "bad",
            name: "Bad",
            classId: "fighter",
            subclassLevel: 3,
            grants: { teleport: 30 },
          },
        ]),
        new Map(),
        new Map(),
        9,
      ),
    /subclasses\[0\]/u,
  );
});

void test("the sample subclass imports and publishes as a subclass and four features", async () => {
  const document = JSON.parse(
    await readFile(new URL("../docs/examples/sample-subclass.json", import.meta.url), "utf8"),
  ) as unknown;
  const plan = planImport(document, new Map(), new Map(), 1);
  assert.deepEqual(plan.summary, { creates: 1, updates: 0, skips: 0, deletes: 0 });
  const write = plan.mutations[0];
  assert.ok(write?.operation === "put");
  const published = flattenSubclass(parseSubclass(write.value));
  assert.deepEqual(
    published.records.map((record) => record["id"]),
    [
      "hb.banner-warden",
      "hb.banner-warden.colors-of-the-company",
      "hb.banner-warden.stalwart-bearer",
      "hb.banner-warden.raise-the-banner",
      "hb.banner-warden.unbroken-line",
    ],
  );
  assert.deepEqual(parsePublishedSubclass(published), published);
});
