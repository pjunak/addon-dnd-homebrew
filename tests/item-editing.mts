import test from "node:test";
import assert from "node:assert/strict";
import {
  draftDeletes,
  draftPuts,
  flatten,
  itemProblem,
  mechanicsOf,
  moveOverrides,
  newItem,
  newSet,
  type Item,
  type ItemSet,
} from "#web/model";
import { translator } from "#web/catalogs";
import { describeGrants } from "#web/grants";
import { fromTemplate, itemTemplates } from "#web/templates";

const english = (text: string): string => text;
const cards: ItemSet = {
  ...newSet("Cursed Cards", "cursed-cards", 1),
  itemType: "Wondrous Item",
  rarity: "Rare",
  attunement: true,
  bodyPlacements: ["other"],
  weightLb: 0.5,
};
const rings: ItemSet = {
  ...newSet("Rings", "rings", 1),
  itemType: "Ring",
  rarity: "Rare",
  bodyPlacements: [],
};

void test("an item leaving its set keeps the values it took from the set", () => {
  const overrides = moveOverrides({}, cards, undefined);
  // Wondrous Item is also the no-set default, so it needs no override.
  assert.deepEqual(overrides, {
    rarity: "Rare",
    attunement: true,
    bodyPlacements: ["other"],
    weightLb: 0.5,
  });
  const item = { ...newItem("Fate", "fate", "cursed-cards", 1), overrides: {} };
  const before = flatten(cards, item).record,
    after = flatten(undefined, { ...item, setId: "", overrides }).record;
  for (const field of ["itemType", "rarity", "attunement", "bodyPlacements", "weightLb"] as const)
    assert.deepEqual(after[field], before[field], field);
});

void test("an item joining a set follows it except where it says otherwise", () => {
  // A loose item's defaults give way to the set; what the DM chose stays.
  assert.deepEqual(moveOverrides({ rarity: "Legendary" }, undefined, cards), {
    rarity: "Legendary",
  });
  assert.deepEqual(
    moveOverrides({ itemType: "Wondrous Item", rarity: "Rare" }, undefined, cards),
    {},
  );
  // A value equal to the new set's is left to the set.
  assert.deepEqual(moveOverrides({ itemType: "Ring", attunement: true }, cards, rings), {
    attunement: true,
  });
  // Leaving for no set drops what equals the no-set defaults.
  assert.deepEqual(moveOverrides({}, rings, undefined), { itemType: "Ring", rarity: "Rare" });
});

void test("automation follows effects, grants and a bonus", () => {
  assert.equal(mechanicsOf([], undefined, undefined), "narrative");
  assert.equal(mechanicsOf([], undefined, { kind: "weapon" }), "narrative");
  assert.equal(mechanicsOf([], undefined, { kind: "weapon", bonus: 1 }), "complete");
  assert.equal(mechanicsOf([], { resistances: ["fire"] }, undefined), "complete");
  assert.equal(
    mechanicsOf([{ target: "armorClass", mode: "add", value: 1 }], undefined, undefined),
    "complete",
  );
});

void test("every template makes an item the model accepts once it has a name", () => {
  const draft = newItem("Starter", "starter", "", 1);
  for (const template of itemTemplates) {
    const item = fromTemplate(template, draft, undefined, english);
    // The spell template leaves the spell to the DM.
    const named: Item =
      template.id === "spell" && item.grants?.spells
        ? {
            ...item,
            grants: {
              ...item.grants,
              resources: (item.grants.resources ?? []).map((use) => ({ ...use, name: "Starter" })),
              spells: [{ ids: ["bless"], resource: "uses" }],
            },
          }
        : item;
    assert.equal(itemProblem(named), undefined, template.id);
    assert.equal(item.name, "Starter");
    assert.equal(item.text, template.item.text ?? "", template.id);
  }
});

void test("a template keeps the name, set and a written description, and leaves set values to the set", () => {
  const ring = itemTemplates.find((template) => template.id === "bonus")!;
  const draft: Item = {
    ...newItem("Band of Warding", "", "rings", 1),
    text: "A plain silver band.",
    characterEffects: [{ target: "speed", mode: "add", value: 10 }],
    container: { weightless: true },
  };
  const item = fromTemplate(ring, draft, rings, english);
  assert.equal(item.name, "Band of Warding");
  assert.equal(item.setId, "rings");
  assert.equal(item.text, "A plain silver band.");
  // The set already is a Rare Ring; only attunement differs.
  assert.deepEqual(item.overrides, { attunement: true });
  assert.deepEqual(item.characterEffects, [{ target: "armorClass", mode: "add", value: 1 }]);
  assert.equal(item.container, undefined);
  assert.equal(item.characterMechanics, "complete");
});

void test("bulk changes write only what changed, guarded by each draft's revision", () => {
  const items = [
    { value: { ...newItem("A", "a", "rings", 1), playerVisible: true }, revision: 3 },
    { value: newItem("B", "b", "rings", 1), revision: 5 },
  ];
  const puts = draftPuts("homebrew_items", items, (item) => ({ ...item, playerVisible: true }), 9);
  assert.deepEqual(
    puts.map((mutation) => [mutation.key, mutation.expectedRevision]),
    [["b", 5]],
  );
  const put = puts[0]!;
  assert.ok(put.operation === "put");
  assert.deepEqual(put.value, { ...items[1]!.value, playerVisible: true, updatedAt: 9 });
  assert.deepEqual(draftDeletes("homebrew_items", items), [
    {
      operation: "delete",
      kind: "collection",
      dataId: "homebrew_items",
      key: "a",
      expectedRevision: 3,
    },
    {
      operation: "delete",
      kind: "collection",
      dataId: "homebrew_items",
      key: "b",
      expectedRevision: 5,
    },
  ]);
});

void test("an item casts this campaign's spells by hb. id and names them in words", () => {
  const grants = {
    castingAbility: { fixed: "INT" as const },
    resources: [{ key: "uses", name: "Ember Wand", fixed: 3, recharge: "long" as const }],
    spells: [{ ids: ["hb.ember-lance", "fire-bolt"], resource: "uses" }],
  };
  const item: Item = {
    ...newItem("Ember Wand", "ember-wand", "", 1),
    characterMechanics: "complete",
    grants,
  };
  assert.equal(itemProblem(item), undefined);
  assert.equal(
    describeGrants(grants, translator("en"))[1],
    "Cast Ember Lance, Fire Bolt with a use of Ember Wand",
  );
  const foreign = { ...grants, spells: [{ ids: ["xx.ember-lance"], resource: "uses" }] };
  assert.notEqual(itemProblem({ ...item, grants: foreign }), undefined);
});
