import test from "node:test";
import assert from "node:assert/strict";
import { ReferenceLoader } from "#web/references";
import type { ServiceHandle } from "../src/sdk.js";

const spell = (id: string, name: string, level: number) => ({
  kind: "spell",
  id,
  value: { id, kind: "spell", name, level, school: "Evocation", classes: ["wizard"] },
});
/** A Compendium-like provider: one set, spells split over two pages. */
function handle(calls: string[], providers = ["compendium", "broken"]): ServiceHandle {
  return {
    contract: "dnd5e.rules-data",
    range: "^3.0.0",
    cardinality: "many",
    available: providers.length > 0,
    providers: providers.map((addonId) => ({
      addonId,
      contractVersion: "3.0.0",
      generation: "g",
      bindingRevision: 1,
    })),
    async call<T>(method: string, params: unknown, options?: { providerAddonId?: string }) {
      const request = params as { kind?: string; cursor?: string };
      calls.push(
        `${options?.providerAddonId}:${method}:${request.kind ?? ""}:${request.cursor ?? ""}`,
      );
      if (options?.providerAddonId === "broken") throw new Error("unavailable");
      if (method === "catalog")
        return {
          sets: [{ id: "rules", kinds: { spell: 3, class: 1, weapon: 1, armor: 2, monster: 9 } }],
        } as T;
      if (request.kind === "class")
        return {
          records: [{ kind: "class", id: "wizard", value: { id: "wizard", name: "Wizard" } }],
        } as T;
      if (request.kind === "weapon")
        return {
          records: [
            {
              kind: "weapon",
              id: "longsword",
              value: {
                id: "longsword",
                name: "Longsword",
                category: "martial",
                range: "melee",
                damage: "1d8",
                damageType: "slashing",
              },
            },
          ],
        } as T;
      if (request.kind === "armor")
        return {
          records: [
            {
              kind: "armor",
              id: "shield",
              value: { id: "shield", name: "Shield", armorType: "shield", acBonus: 2 },
            },
            {
              kind: "armor",
              id: "chain-mail",
              value: { id: "chain-mail", name: "Chain Mail", armorType: "heavy", baseAC: 16 },
            },
          ],
        } as T;
      return (
        request.cursor === undefined
          ? {
              records: [spell("fireball", "Fireball", 3), spell("bad", "Bad", 1.5)],
              nextCursor: "p2",
            }
          : {
              records: [
                spell("fire-bolt", "Fire Bolt", 0),
                { kind: "spell", id: "x", value: null },
              ],
            }
      ) as T;
    },
  };
}

void test("spells, classes, weapons and armor come from the other providers, sorted, malformed ones skipped", async () => {
  const calls: string[] = [];
  const loader = new ReferenceLoader(async () => handle(calls), new AbortController().signal);
  const references = await loader.load();
  assert.deepEqual(
    references.spells.map((option) => [option.id, option.detail]),
    [
      ["fire-bolt", "Cantrip · Evocation · wizard"],
      ["fireball", "Level 3 · Evocation · wizard"],
    ],
  );
  assert.deepEqual(references.classes, [{ id: "wizard", name: "Wizard", detail: "" }]);
  assert.deepEqual(references.weapons, [
    { id: "longsword", name: "Longsword", detail: "martial · melee · 1d8 slashing" },
  ]);
  assert.deepEqual(
    references.armor.map((option) => [option.id, option.detail]),
    [
      ["chain-mail", "heavy · AC 16"],
      ["shield", "shield · AC +2"],
    ],
  );
  assert.ok(!calls.some((call) => call.includes(":monster:")), "only the kinds the pickers need");
  assert.equal(await loader.load(), references, "loaded once per page");
});

void test("without an answering provider the load fails and is tried again later", async () => {
  let connects = 0;
  const loader = new ReferenceLoader(async () => {
    connects++;
    return handle([], []);
  }, new AbortController().signal);
  await assert.rejects(loader.load());
  await assert.rejects(loader.load());
  assert.equal(connects, 2);
});
