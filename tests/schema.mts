import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { grantsSchema } from "#web/grants-schema";
import { deref, emptyValue, schemaProblem, type SchemaNode } from "#web/schema";

interface VocabularyFixture {
  valid: { name: string; grants: unknown }[];
  invalid: { name: string; grants: unknown }[];
}
const fixture = JSON.parse(
  await readFile(new URL("./fixtures/vocabulary.json", import.meta.url), "utf8"),
) as VocabularyFixture;

void test("the browser validator agrees with the host's on the whole grants vocabulary", () => {
  assert.ok(fixture.valid.length >= Object.keys(grantsSchema.properties ?? {}).length);
  for (const testCase of fixture.valid)
    assert.equal(schemaProblem(grantsSchema, testCase.grants, "grants"), undefined, testCase.name);
  for (const testCase of fixture.invalid)
    assert.ok(schemaProblem(grantsSchema, testCase.grants, "grants"), testCase.name);
});

void test("a problem names the place it breaks", () => {
  assert.deepEqual(
    schemaProblem(grantsSchema, { resources: [{ key: "dice", fixed: "2" }] }, "grants"),
    { text: "{path} must be a whole number.", params: { path: "grants.resources[0].fixed" } },
  );
  assert.deepEqual(schemaProblem(grantsSchema, { resources: [{}] }, "grants"), {
    text: "{path} needs {field}.",
    params: { path: "grants.resources[0]", field: "key" },
  });
});

void test("a new entry starts with its required fields and is valid where nothing is left to fill", () => {
  for (const [field, property] of Object.entries(grantsSchema.properties ?? {})) {
    const node: SchemaNode = deref(property);
    const value = emptyValue(node);
    if (node.type === "array" || node.type === "object")
      assert.equal(schemaProblem(property, value, field), undefined, field);
  }
});
