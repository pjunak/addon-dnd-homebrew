import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { provideReferences } from "#web/wiki-provider";
import type { Published } from "#web/model";
import type { PublishedState } from "#web/repository";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/publish.json", import.meta.url), "utf8"),
) as { cases: { published: Published }[] };
const records = fixture.cases.map((testCase) => testCase.published);
const withdrawn: Published = { ...records[3]!, withdrawn: true };
const state: PublishedState = {
  records: new Map(
    [...records.slice(0, 3), withdrawn].map((value) => [value.id, { value, revision: 1 }]),
  ),
  subclasses: new Map(),
  feats: new Map(),
  spells: new Map(),
  species: new Map(),
  backgrounds: new Map(),
  meta: undefined,
  unreadable: [],
};
const cache = { get: async () => state };
const signal = new AbortController().signal;
type Response = {
  matches: {
    index: number;
    label: string;
    description: string;
    target: { route: string; query: string[][] };
  }[];
};
const resolve = async (...references: [string, string][]): Promise<Response> =>
  (await provideReferences(
    cache,
    {
      contractVersion: "wiki-links.v1",
      operation: "resolve",
      references: references.map(([label, hint]) => ({ label, hint })),
    },
    signal,
  )) as Response;

void test("exact homebrew ids resolve for the sheet that holds them, revealed or not", async () => {
  const { matches } = await resolve(
    ["Ring of Wit", "magic-item:hb.ring-of-wit"],
    ["Shield", "spell:hb.ring-of-wit"],
    ["Ring of Protection", "magic-item:ring-of-protection"],
    ["Trinket", "magic-item:hb.trinket"],
  );
  assert.deepEqual(
    matches.map((match) => [match.index, match.label]),
    [[0, "Ring of Wit"]],
  );
  assert.deepEqual(matches[0]!.target, {
    route: "gallery.route",
    query: [["id", "hb.ring-of-wit"]],
  });
  assert.ok(
    matches[0]!.description.startsWith("Ring, Uncommon (Requires Attunement) Your Intelligence"),
  );
  assert.ok(matches[0]!.description.length <= 500);
});

void test("labels and search see only revealed items", async () => {
  const { matches } = await resolve(
    ["Cursed Card: Defense", ""],
    ["Ring of Wit", "magic-item"],
    ["Destiny", ""],
  );
  assert.deepEqual(
    matches.map((match) => match.label),
    ["Cursed Card: Defense"],
  );
  const search = (await provideReferences(
    cache,
    { contractVersion: "wiki-links.v1", operation: "search", query: "card", limit: 5 },
    signal,
  )) as Response;
  assert.deepEqual(
    search.matches.map((match) => [match.label, match.description]),
    [["Cursed Card: Defense", "Cursed Cards · Rare"]],
  );
});

void test("malformed wiki requests are refused", async () => {
  for (const request of [
    {},
    { contractVersion: "wiki-links.v1", operation: "search", query: "x", limit: 21 },
    {
      contractVersion: "wiki-links.v1",
      operation: "resolve",
      references: [{ label: 1, hint: "" }],
    },
    { contractVersion: "wiki-links.v1", operation: "rename" },
  ])
    await assert.rejects(provideReferences(cache, request, signal));
});
