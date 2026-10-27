import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { HomebrewRepository } from "#web/repository";

const publish = JSON.parse(
  await readFile(new URL("./fixtures/publish.json", import.meta.url), "utf8"),
) as {
  sets: { id: string }[];
  cases: { item: { id: string }; published: { id: string } }[];
};
const subclasses = JSON.parse(
  await readFile(new URL("./fixtures/subclasses.json", import.meta.url), "utf8"),
) as { valid: { id: string }[]; published: unknown };

function fakeContext(stored: Record<string, { key: string; revision: number; value: unknown }[]>) {
  const queries: { id: string; options: Record<string, unknown> }[] = [];
  const transactions: { mutations: unknown[]; options: Record<string, unknown> }[] = [];
  const context = {
    signal: new AbortController().signal,
    data: {
      collection: (id: string) => ({
        get: async () => assert.fail("unused"),
        query: async (options: Record<string, unknown> = {}) => {
          queries.push({ id, options });
          return {
            documents: stored[id] ?? [],
            ...(options["includeDataRevision"] ? { dataRevision: 9 } : {}),
          };
        },
      }),
      transact: async (
        mutations: readonly { dataId: string; key: string }[],
        options: Record<string, unknown> = {},
      ) => {
        transactions.push({ mutations: [...mutations], options });
        return {
          results: mutations.map((mutation) => ({
            ...mutation,
            kind: "collection" as const,
            beforeRevision: 0,
            afterRevision: 3,
            deleted: false,
          })),
        };
      },
    },
  };
  return { context, queries, transactions };
}

void test("drafts are read with set revisions and broken documents are reported, not dropped", async () => {
  const { context, queries } = fakeContext({
    homebrew_sets: publish.sets.map((value) => ({ key: value.id, revision: 2, value })),
    homebrew_items: [
      ...publish.cases.map(({ item }) => ({ key: item.id, revision: 4, value: item })),
      { key: "broken", revision: 1, value: { id: "broken", name: "Broken" } },
    ],
    homebrew_subclasses: subclasses.valid.map((value) => ({ key: value.id, revision: 3, value })),
  });
  const drafts = await new HomebrewRepository(context).drafts(new AbortController().signal);
  assert.equal(drafts.sets.length, 2);
  assert.equal(drafts.items.length, 6);
  assert.deepEqual(
    drafts.subclasses.map((entry) => entry.value.id),
    subclasses.valid.map((value) => value.id),
  );
  assert.deepEqual(
    drafts.unreadable.map((entry) => [entry.collection, entry.key]),
    [["homebrew_items", "broken"]],
  );
  assert.deepEqual(drafts.dataRevisions, [
    { kind: "collection", dataId: "homebrew_sets", revision: 9 },
    { kind: "collection", dataId: "homebrew_items", revision: 9 },
    { kind: "collection", dataId: "homebrew_subclasses", revision: 9 },
    { kind: "collection", dataId: "homebrew_feats", revision: 9 },
    { kind: "collection", dataId: "homebrew_spells", revision: 9 },
    { kind: "collection", dataId: "homebrew_species", revision: 9 },
    { kind: "collection", dataId: "homebrew_backgrounds", revision: 9 },
  ]);
  assert.ok(queries.every((query) => query.options["includeDataRevision"] === true));
});

void test("players read published records without set revisions", async () => {
  const { context, queries } = fakeContext({
    homebrew_published: publish.cases.map(({ published }) => ({
      key: published.id,
      revision: 1,
      value: published,
    })),
    homebrew_published_subclasses: [
      { key: "hb.storm-drum", revision: 1, value: subclasses.published },
    ],
    homebrew_meta: [
      {
        key: "publish",
        revision: 5,
        value: { schemaVersion: 1, revision: 2, publishedAt: 3, recordCount: 4 },
      },
    ],
  });
  const state = await new HomebrewRepository(context).published(new AbortController().signal);
  assert.equal(state.records.size, 6);
  assert.deepEqual([...state.subclasses.keys()], ["hb.storm-drum"]);
  assert.equal(state.meta?.revision, 5);
  assert.equal(state.dataRevisions, undefined);
  assert.ok(queries.every((query) => query.options["includeDataRevision"] === undefined));
});

void test("saves return the new revision and commits carry their guards", async () => {
  const { context, transactions } = fakeContext({});
  const repository = new HomebrewRepository(context);
  const signal = new AbortController().signal;
  const item = publish.cases[0]!.item as never;
  assert.equal(await repository.save("homebrew_items", item, 0, signal), 3);
  const guards = [{ kind: "collection" as const, dataId: "homebrew_items", revision: 9 }];
  await repository.commit(
    [
      {
        operation: "delete",
        kind: "collection",
        dataId: "homebrew_items",
        key: "x",
        expectedRevision: 1,
      },
    ],
    guards,
    signal,
  );
  await repository.commit([], guards, signal);
  assert.equal(transactions.length, 2);
  assert.deepEqual(transactions[1]!.options["expectedDataSets"], guards);
});
