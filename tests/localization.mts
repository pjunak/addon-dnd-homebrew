import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { bodyPlacements, rarities, skills } from "#web/model";
import { skillName } from "#web/effects";
import { featTemplates } from "#web/feat-editor";
import { itemTemplates } from "#web/templates";
import { homebrewKinds } from "#web/overview";
import { vocabularyWords } from "#web/vocabulary";

const unescape = (text: string): string => JSON.parse(`"${text}"`) as string;
// Czech by English key, across every section of the catalog.
const cs: Readonly<Record<string, string>> = Object.assign(
  {},
  ...Object.values(
    (
      JSON.parse(readFileSync(new URL("../locales/cs.json", import.meta.url), "utf8")) as {
        sections: Record<string, Record<string, string>>;
      }
    ).sections,
  ),
);

void test("every English message shown in the UI has a Czech translation", async () => {
  const directory = new URL("../src/", import.meta.url);
  const missing = new Set<string>();
  const patterns = [
    /\bt\(\s*"((?:[^"\\]|\\.)*)"/gu,
    /\bproblem\(\s*"((?:[^"\\]|\\.)*)"/gu,
    /new HomebrewError\(\s*"((?:[^"\\]|\\.)*)"/gu,
    /\btext:\s*"((?:[^"\\]|\\.)*)"/gu,
    /#failure = "((?:[^"\\]|\\.)*)"/gu,
    /\bfail\(\s*"((?:[^"\\]|\\.)*)"/gu,
    /messageOf\(error, "((?:[^"\\]|\\.)*)"\)/gu,
  ];
  for (const file of await readdir(directory)) {
    if (!file.endsWith(".ts") || file === "catalogs.ts") continue;
    const source = await readFile(new URL(file, directory), "utf8");
    for (const pattern of patterns)
      for (const match of source.matchAll(pattern)) {
        const text = unescape(match[1]!);
        if (text !== "" && !(text in cs)) missing.add(`${file}: ${text}`);
      }
    if (
      [
        "effects.ts",
        "focus.ts",
        "grants.ts",
        "magic-gear.ts",
        "feat-editor.ts",
        "spell-editor.ts",
      ].includes(file)
    )
      for (const block of source.matchAll(/Readonly<Record<\w+, string>> = \{([^}]*)\}/gu))
        for (const match of block[1]!.matchAll(/:\s*"((?:[^"\\]|\\.)*)"/gu))
          if (!(unescape(match[1]!) in cs)) missing.add(`${file}: ${match[1]}`);
  }
  for (const text of [
    ...rarities,
    ...bodyPlacements,
    ...skills.map(skillName),
    ...vocabularyWords(),
    ...itemTemplates.flatMap((template) => [template.label, template.hint]),
    ...featTemplates.flatMap((template) => [template.label, template.hint]),
    ...homebrewKinds.flatMap((kind) => [kind.one, kind.many, kind.newLabel, kind.about]),
  ])
    if (!(text in cs)) missing.add(`vocabulary: ${text}`);
  assert.deepEqual([...missing], []);
});

void test("translations keep every placeholder", () => {
  const names = (text: string): string[] =>
    [...text.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]!).sort();
  for (const [english, czech] of Object.entries(cs))
    assert.deepEqual(names(czech), names(english), english);
});

void test("the English catalog lists every key Czech translates", () => {
  const english = JSON.parse(
    readFileSync(new URL("../locales/en.json", import.meta.url), "utf8"),
  ) as { sections: Record<string, Record<string, string>> };
  const keys = new Set(Object.values(english.sections).flatMap((section) => Object.keys(section)));
  for (const key of Object.keys(cs))
    if (!key.startsWith("manifest.")) assert.ok(keys.has(key), key);
});
