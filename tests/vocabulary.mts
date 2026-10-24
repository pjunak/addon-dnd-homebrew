import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { grantsSchema } from "#web/grants-schema";
import { subclassProblem, type Subclass } from "#web/model";
import { declaredKeys, thirdCasterTable } from "#web/subclass-editor";
import { fieldLabel, fieldOffer, grantGroups, humanize, switchOf } from "#web/vocabulary";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/subclasses.json", import.meta.url), "utf8"),
) as { valid: Subclass[] };

void test("the editor's groups list every grant of the vocabulary once, for each subject", () => {
  for (const subject of ["subclass", "feat"] as const) {
    const grouped = grantGroups(subject).flatMap((group) => group.fields);
    assert.deepEqual([...grouped].sort(), Object.keys(grantsSchema.properties ?? {}).sort());
    assert.equal(new Set(grouped).size, grouped.length, subject);
  }
  // A feat's ability score increase is its own benefit, not set aside.
  assert.equal(grantGroups("feat")[0]?.fields.includes("abilityScoreIncrease"), true);
});

void test("every field has words, named or made from its name", () => {
  assert.equal(fieldLabel("Grants", "hpPerClassLevel"), "HP per class level");
  assert.equal(fieldLabel("SpellGrantDecl", "ids"), "Spells", "a definition's own sense wins");
  assert.equal(fieldLabel("ResourceGrant.recharge", "on"), "Rest", "inline objects share words");
  assert.equal(humanize("spellSaveDC"), "Spell save DC");
});

void test("each activation target says which fields apply to it", () => {
  const targets = fieldOffer("ActivationModifier", "target", {})?.values ?? [];
  assert.ok(targets.length > 10);
  const decider = switchOf("ActivationModifier")!;
  const fields = Object.keys(grantsSchema.$defs?.["ActivationModifier"]?.properties ?? {});
  for (const [target] of targets) {
    const applies = decider.fields(target);
    assert.ok(applies && applies.length > 0, target);
    for (const field of applies) assert.ok(fields.includes(field), `${target}: ${field}`);
    for (const field of Object.keys(decider.start(target)))
      assert.ok(applies.includes(field), `${target} starts with ${field}`);
  }
  assert.deepEqual(
    fieldOffer("ActivationModifier", "value", { target: "resistance" })?.closed,
    true,
    "a resistance names a damage type",
  );
});

void test("a third caster's table follows the multiclass spell slots", () => {
  const table = thirdCasterTable(3);
  assert.equal(table.length, 18);
  assert.deepEqual(table[0], { level: 3, cantripsKnown: 0, preparedSpells: 0, spellSlots: [2] });
  assert.deepEqual(table.find((row) => row.level === 7)?.spellSlots, [4, 2]);
  assert.deepEqual(table.at(-1)?.spellSlots, [4, 3, 3, 1]);
  const scribe = { ...fixture.valid[1]!, progression: table };
  assert.equal(subclassProblem(scribe), undefined);
});

void test("fields that name a key are offered the subclass's own keys", () => {
  const drum = fixture.valid[0]!;
  assert.deepEqual(declaredKeys(drum, "resource"), ["drum-beats"]);
  assert.deepEqual(declaredKeys(drum, "column"), ["drum-die"]);
  assert.deepEqual(declaredKeys(drum, "activation"), ["war-drum"]);
  assert.deepEqual(declaredKeys(drum, "choice"), []);
});
