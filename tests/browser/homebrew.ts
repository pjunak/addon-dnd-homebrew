import { defineCatalogElement } from "#web/catalog-element";
import { defineGalleryElement } from "#web/gallery-element";
import { grantsSchema } from "#web/grants-schema";
import { canonical, flattenFeat, flattenSubclass, type Feat, type Subclass } from "#web/model";
import { deref, typesOf, type SchemaNode } from "#web/schema";
import { grantsNode, schemaEditor, type FormContext } from "#web/schema-form";
import { mechanicsEditor } from "#web/subclass-editor";
import { ReferenceLoader } from "#web/references";
import { HomebrewRepository } from "#web/repository";
import { registerRuntime } from "#web/runtime";
import { itemTemplates } from "#web/templates";
import type {
  AddonContext,
  AddonDocument,
  ContributionContext,
  ServiceHandle,
} from "../../src/sdk.js";
import type { RenderingCheck } from "./rendering-contract.js";

interface FixtureElement extends HTMLElement {
  codexContribution: ContributionContext;
}
interface PublishFixture {
  sets: { id: string }[];
  cases: { item: { id: string }; published: { id: string } }[];
}

customElements.define(
  "codex-addon-markdown",
  class extends HTMLElement {
    set source(value: string) {
      this.textContent = value;
    }
  },
);

const fixture = (await (await fetch("../fixtures/publish.json")).json()) as PublishFixture;
const subclasses = (
  (await (await fetch("../fixtures/subclasses.json")).json()) as { valid: Subclass[] }
).valid;
const feats = ((await (await fetch("../fixtures/feats.json")).json()) as { valid: Feat[] }).valid;
const documents = (values: readonly { id: string }[], key = (value: { id: string }) => value.id) =>
  values.map((value): AddonDocument<unknown> => ({ key: key(value), revision: 1, value }));
const stored: Record<string, readonly AddonDocument<unknown>[]> = {
  homebrew_sets: documents(fixture.sets),
  homebrew_items: documents(fixture.cases.map((testCase) => testCase.item)),
  homebrew_published: documents(fixture.cases.slice(0, 3).map((testCase) => testCase.published)),
  homebrew_subclasses: documents(subclasses),
  homebrew_published_subclasses: documents(subclasses.map(flattenSubclass)),
  homebrew_feats: documents(feats),
  homebrew_published_feats: documents(feats.slice(0, 1).map(flattenFeat)),
  homebrew_meta: [
    {
      key: "publish",
      revision: 2,
      value: { schemaVersion: 1, revision: 1, publishedAt: 1, recordCount: 3 },
    },
  ],
};
const signal = new AbortController().signal;
const repository = new HomebrewRepository({
  signal,
  data: {
    collection(id) {
      return {
        async get() {
          throw new Error("unused");
        },
        async query() {
          return { documents: stored[id] ?? [], dataRevision: 1 };
        },
      };
    },
    async transact() {
      throw new Error("The rendering fixture does not allow mutations");
    },
  },
});
const importer: ServiceHandle = {
  contract: "codex.import-adapter",
  range: "2.0.0",
  cardinality: "one",
  available: false,
  providers: [],
  async call<T>(): Promise<T> {
    throw new Error("No worker in the rendering fixture");
  },
};
const declaration = {
  id: "homebrew.route",
  surface: "route",
  label: "Homebrew",
  roles: ["dm"],
  order: 0,
  requires: [],
  config: {},
} as const;
const ui: AddonContext["ui"] = {
  enhance() {
    return { refresh() {}, dispose() {} };
  },
  async showRuleDetails() {},
  declarations: () => [],
  bind() {
    return { descriptor: declaration, dispose() {} };
  },
};
const generation = "c".repeat(64);
// A Compendium answering the pickers' catalog and queries.
const rules: ServiceHandle = {
  contract: "dnd5e.rules-data",
  range: "^3.0.0",
  cardinality: "many",
  available: true,
  providers: [
    { addonId: "compendium", contractVersion: "3.0.0", generation: "g", bindingRevision: 1 },
  ],
  async call<T>(method: string, params: unknown): Promise<T> {
    if (method === "catalog")
      return { sets: [{ id: "rules", kinds: { spell: 2, class: 3, weapon: 1, armor: 1 } }] } as T;
    const record = (kind: string, id: string, name: string, level?: number) => ({
      kind,
      id,
      value: { id, kind, name, ...(level === undefined ? {} : { level, school: "Divination" }) },
    });
    const kind = (params as { kind: string }).kind;
    return {
      records:
        kind === "spell"
          ? [
              record("spell", "detect-magic", "Detect Magic", 1),
              record("spell", "bless", "Bless", 1),
            ]
          : kind === "weapon"
            ? [record("weapon", "longsword", "Longsword")]
            : kind === "armor"
              ? [record("armor", "shield", "Shield")]
              : [
                  record("class", "cleric", "Cleric"),
                  record("class", "sorcerer", "Sorcerer"),
                  record("class", "wizard", "Wizard"),
                ],
    } as T;
  },
};
const references = new ReferenceLoader(async () => rules, signal);
registerRuntime(generation, { ui, repository, importer, references, signal });
const catalogTag = defineCatalogElement(generation),
  galleryTag = defineGalleryElement(generation);
const context = (query: [string, string][]): ContributionContext => ({
  addon: { id: "dnd-homebrew", generation },
  contribution: declaration,
  signal,
  edits: { set() {} },
  host: { contractVersion: "addon-route-context.v1", locale: "en", query },
});
const mount = (tag: string, query: [string, string][] = []): FixtureElement => {
  const node = document.createElement(tag) as FixtureElement;
  node.codexContribution = context(query);
  document.querySelector("#fixture")!.append(node);
  return node;
};
const catalog = mount(catalogTag),
  ringCatalog = mount(catalogTag),
  lanternCatalog = mount(catalogTag),
  subclassCatalog = mount(catalogTag),
  featCatalog = mount(catalogTag),
  importedFeatCatalog = mount(catalogTag),
  edgeCatalog = mount(catalogTag),
  newCatalog = mount(catalogTag),
  gallery = mount(galleryTag),
  linked = mount(galleryTag, [["id", "hb.ring-of-wit"]]);

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));
for (
  let attempt = 0;
  attempt < 60 && catalog.querySelectorAll(".hb-tree-item").length < 6;
  attempt++
)
  await frame();
const defense = [...catalog.querySelectorAll<HTMLButtonElement>(".hb-tree-item")].find((button) =>
  button.textContent?.startsWith("Defense"),
);
defense?.click();
for (let attempt = 0; attempt < 60 && !catalog.querySelector(".hb-effect-row"); attempt++)
  await frame();
for (
  let attempt = 0;
  attempt < 60 && ringCatalog.querySelectorAll(".hb-tree-item").length < 6;
  attempt++
)
  await frame();
[...ringCatalog.querySelectorAll<HTMLButtonElement>(".hb-tree-item")]
  .find((button) => button.textContent?.startsWith("Ring of Wit"))
  ?.click();
for (let attempt = 0; attempt < 60 && !ringCatalog.querySelector(".hb-grant-row"); attempt++)
  await frame();
for (
  let attempt = 0;
  attempt < 60 && lanternCatalog.querySelectorAll(".hb-tree-item").length < 6;
  attempt++
)
  await frame();
[...lanternCatalog.querySelectorAll<HTMLButtonElement>(".hb-tree-item")]
  .find((button) => button.textContent?.startsWith("Lantern"))
  ?.click();
for (
  let attempt = 0;
  attempt < 60 && !lanternCatalog.querySelector('select[name="requirementClasses"]');
  attempt++
)
  await frame();
for (
  let attempt = 0;
  attempt < 60 && edgeCatalog.querySelectorAll(".hb-tree-item").length < 6;
  attempt++
)
  await frame();
[...edgeCatalog.querySelectorAll<HTMLButtonElement>(".hb-tree-item")]
  .find((button) => button.textContent?.startsWith("Edge"))
  ?.click();
for (
  let attempt = 0;
  attempt < 60 && edgeCatalog.querySelector(".hb-preview-name")?.textContent !== "Edge";
  attempt++
)
  await frame();
for (
  let attempt = 0;
  attempt < 60 && subclassCatalog.querySelectorAll(".hb-tree-item").length < 6;
  attempt++
)
  await frame();
[...subclassCatalog.querySelectorAll<HTMLButtonElement>(".hb-tree-item")]
  .find((button) => button.textContent?.startsWith("Path of the Storm Drum"))
  ?.click();
for (let attempt = 0; attempt < 60 && !subclassCatalog.querySelector(".hb-feature"); attempt++)
  await frame();
const openFeat = async (root: HTMLElement, name: string): Promise<void> => {
  for (
    let attempt = 0;
    attempt < 60 && root.querySelectorAll(".hb-tree-item").length < 6;
    attempt++
  )
    await frame();
  [...root.querySelectorAll<HTMLButtonElement>(".hb-tree-item")]
    .find((button) => button.textContent?.startsWith(name))
    ?.click();
  for (
    let attempt = 0;
    attempt < 60 && root.querySelector(".hb-preview-name")?.textContent !== name;
    attempt++
  )
    await frame();
};
await openFeat(featCatalog, "Storm Touched");
await openFeat(importedFeatCatalog, "Elemental Scholar");
for (
  let attempt = 0;
  attempt < 60 && newCatalog.querySelectorAll(".hb-tree-item").length < 6;
  attempt++
)
  await frame();
const startPanel = [
  newCatalog.querySelectorAll(".hb-start button").length,
  newCatalog.querySelectorAll(".hb-kinds dt").length,
];
// A new item started from the magic weapon template.
[...newCatalog.querySelectorAll<HTMLButtonElement>(".hb-header button")]
  .find((button) => button.textContent === "New item")
  ?.click();
for (let attempt = 0; attempt < 60 && !newCatalog.querySelector(".hb-templates"); attempt++)
  await frame();
const templateButtons = [...newCatalog.querySelectorAll<HTMLButtonElement>(".hb-templates button")];
templateButtons.find((button) => button.textContent === "Magic weapon")?.click();
for (
  let attempt = 0;
  attempt < 60 &&
  newCatalog.querySelector<HTMLSelectElement>('select[name="baseKind"]')?.value !== "weapon";
  attempt++
)
  await frame();

/** A value for every field the vocabulary allows, nested a few levels deep. */
function sample(node: SchemaNode, depth: number, index = 0): unknown {
  const schema = deref(node);
  if (schema.const !== undefined) return schema.const;
  // The last alternative is the richest: an object or a list.
  if (schema.oneOf) return sample(schema.oneOf[schema.oneOf.length - 1]!, depth, index);
  const types = typesOf(schema);
  if (types.length > 1) return 3;
  switch (types[0] ?? "string") {
    case "object": {
      if (!schema.properties) {
        const values = schema.additionalProperties;
        return { [`k${index}`]: typeof values === "object" ? sample(values, depth + 1) : 1 };
      }
      const required = schema.required ?? [];
      return Object.fromEntries(
        Object.entries(schema.properties)
          .filter(([field]) => depth < 6 || required.includes(field))
          .map(([field, child], position) => [field, sample(child, depth + 1, position)]),
      );
    }
    case "array": {
      const item = deref(schema.items ?? {});
      const kind = item.oneOf ? undefined : typesOf(item)[0];
      if (kind === "string") return ["v1", "v2"];
      if (kind === "integer" || kind === "number") return [1, 2];
      return [sample(schema.items ?? {}, depth + 1)];
    }
    case "boolean":
      return true;
    case "integer":
      return 2;
    case "number":
      return 1.5;
    default:
      return `s${index}`;
  }
}
const formContext: FormContext = {
  document,
  t: (english) => english,
  references: undefined,
  keys: () => [],
  changed() {},
  restructured() {},
  subject: "subclass",
};
const sandbox = document.createElement("form");
sandbox.hidden = true;
document.body.append(sandbox);
const everything = sample(grantsNode, 0);
const everythingEditor = schemaEditor(formContext, grantsNode, everything, {
  path: "grants",
  label: "Grants",
});
const emptyEditor = schemaEditor(formContext, grantsNode, undefined, {
  path: "empty",
  label: "Grants",
});
const mechanics = subclasses.map((subclass) =>
  mechanicsEditor(
    {
      document,
      t: (english) => english,
      references: undefined,
      subclassLevel: () => subclass.subclassLevel,
      changed() {},
      restructured() {},
    },
    subclass,
    new Set(subclass.features.map((feature) => feature.id)),
  ),
);
sandbox.append(everythingEditor.root, emptyEditor.root, ...mechanics.map((editor) => editor.root));

const lines = (root: Element, selector: string): string[] =>
  [...root.querySelectorAll(`${selector} li`)].map((node) => node.textContent ?? "");
const fateTouched = "Condition Fate-Touched: one level for each item in effect that gives it";
const ringLines = [
  "Advantage on Intelligence checks (to recall lore)",
  "Ring of Wit: 1 use per Long Rest",
  "Cast Detect Magic with a use of Ring of Wit",
  "Choose a cantrip",
  "Spellcasting ability: the player's choice of Intelligence, Wisdom, Charisma",
  "Toggle Keen mind (In dim light): Darkvision +30 ft; Darkvision at least 60 ft",
  "Resistance: Psychic",
];

globalThis.runRenderingContract = () => {
  const checks: RenderingCheck[] = [];
  const check = (name: string, pass: boolean, actual: unknown, expected: unknown): void => {
    checks.push({ name, pass, actual, expected });
  };
  const layout = catalog.querySelector<HTMLElement>(".hb-layout")!;
  const columns = getComputedStyle(layout).gridTemplateColumns.split(" ").length;
  check("catalog places the item tree beside the editor", columns === 2, columns, 2);
  const names = [...catalog.querySelectorAll(".hb-tree-name")].map((node) => node.textContent);
  check(
    "tree lists sets and their items by name",
    JSON.stringify(names) ===
      JSON.stringify([
        "Cursed Cards",
        "Defense",
        "Omens",
        "Destiny",
        "Edge",
        "Lantern",
        "Ring of Wit",
        "Trinket",
        "Path of the Storm Drum",
        "Rune Scribe",
        "Elemental Scholar",
        "Lantern Bearer",
        "Storm Archer",
        "Storm Touched",
      ]),
    names,
    [
      "Cursed Cards",
      "Defense",
      "Omens",
      "Destiny",
      "Edge",
      "Lantern",
      "Ring of Wit",
      "Trinket",
      "Path of the Storm Drum",
      "Rune Scribe",
      "Elemental Scholar",
      "Lantern Bearer",
      "Storm Archer",
      "Storm Touched",
    ],
  );
  const trinket = [...catalog.querySelectorAll(".hb-tree-item")].find((node) =>
    node.textContent?.startsWith("Trinket"),
  );
  check(
    "an item never published says so",
    Boolean(trinket?.textContent?.includes("Unpublished")),
    trinket?.textContent,
    "…Unpublished",
  );
  const status = catalog.querySelector(".hb-status")?.textContent ?? "";
  check(
    "status counts pending changes",
    status.includes("Unpublished changes: 6."),
    status,
    "…Unpublished changes: 6.",
  );
  const preview = catalog.querySelector(".hb-preview-name")?.textContent;
  check(
    "editor previews the published name",
    preview === "Cursed Card: Defense",
    preview,
    "Cursed Card: Defense",
  );
  const rows = catalog.querySelectorAll(".hb-effects .hb-effect-row").length;
  check("editor shows the item's effect rows", rows === 1, rows, 1);
  const summary = lines(catalog, ".hb-effect-summary");
  check(
    "effects and the set condition read as plain words",
    JSON.stringify(summary) === JSON.stringify(["Armor Class +1", fateTouched]),
    summary,
    ["Armor Class +1", fateTouched],
  );
  const sections = [...ringCatalog.querySelectorAll(".hb-grants > .hb-grants-section")].map(
    (node) => node.querySelectorAll(".hb-grant-row").length,
  );
  check(
    "editor shows one row per grant: advantage, use, two spells, toggle",
    JSON.stringify(sections) === JSON.stringify([1, 1, 2, 1]),
    sections,
    [1, 1, 2, 1],
  );
  const shown = (name: string): string | undefined => {
    const control = lanternCatalog.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[name="${name}"]`,
    );
    if (!control || control.closest<HTMLElement>("[hidden]")) return undefined;
    return control instanceof HTMLSelectElement && control.multiple
      ? [...control.selectedOptions].map((entry) => entry.value).join(", ")
      : control.value;
  };
  const carrying = [
    shown("requirement"),
    shown("requirementClasses"),
    shown("requirementText"),
    shown("containerCapacity"),
    shown("overrideWeight"),
  ];
  const expectedCarrying = ["classes", "cleric, wizard", undefined, "1", "2"];
  check(
    "the editor shows who can attune, the container and the weight",
    JSON.stringify(carrying) === JSON.stringify(expectedCarrying),
    carrying,
    expectedCarrying,
  );
  const gearShown = (name: string): string | undefined => {
    const control = edgeCatalog.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[name="${name}"]`,
    );
    if (!control || control.closest<HTMLElement>("[hidden]")) return undefined;
    return control instanceof HTMLSelectElement && control.multiple
      ? [...control.selectedOptions].map((entry) => entry.value).join(", ")
      : control.value;
  };
  const gear = [
    "baseKind",
    "baseMode",
    "baseWeapons",
    "baseCategories",
    "baseArmorTypes",
    "baseBonus",
  ].map(gearShown);
  const expectedGear = ["weapon", "filter", undefined, "martial", undefined, "1, 2"];
  check(
    "the editor shows a weapon base by filter and its bonuses",
    JSON.stringify(gear) === JSON.stringify(expectedGear),
    gear,
    expectedGear,
  );
  const gearLine = lines(edgeCatalog, ".hb-effect-summary")[0];
  check(
    "the preview names the base and the bonuses",
    gearLine === "Weapon (Martial, Melee), +1 / +2 to attack and damage rolls",
    gearLine,
    "Weapon (Martial, Melee), +1 / +2 to attack and damage rolls",
  );
  const header =
    lanternCatalog.querySelector(".hb-preview codex-addon-markdown")?.textContent ?? "";
  check(
    "the published text names who can attune",
    header.startsWith("*Wondrous Item, Common (Requires Attunement by a Cleric or Wizard)*"),
    header,
    "*Wondrous Item, Common (Requires Attunement by a Cleric or Wizard)*…",
  );
  const picked = [
    ...ringCatalog.querySelectorAll<HTMLSelectElement>('select[name="spell-ids"]'),
  ].map((select) => [...select.selectedOptions].map((entry) => entry.textContent));
  check(
    "named spells are picked from the rules data by name",
    JSON.stringify(picked) === JSON.stringify([["Detect Magic"]]),
    picked,
    [["Detect Magic"]],
  );
  const itemForm = catalog.querySelector<HTMLElement>(".hb-editor form")!;
  const formColumns = getComputedStyle(itemForm).gridTemplateColumns.split(" ").length;
  check("a wide editor shows the preview beside the fields", formColumns === 2, formColumns, 2);
  const inherited = [
    catalog.querySelector<HTMLSelectElement>('select[name="overrideRarity"]')?.selectedOptions[0]
      ?.textContent,
    catalog.querySelector<HTMLSelectElement>('select[name="overrideAttunement"]')?.value,
    catalog.querySelector<HTMLInputElement>('input[name="inheritPlacements"]')?.checked,
  ];
  check(
    "an item in a set shows the set's values as its defaults",
    JSON.stringify(inherited) === JSON.stringify(["From set (Rare)", "", true]),
    inherited,
    ["From set (Rare)", "", true],
  );
  const own = [
    ringCatalog.querySelector<HTMLSelectElement>('select[name="overrideRarity"]')?.value,
    ringCatalog.querySelector<HTMLInputElement>('input[name="overrideAttunement"]')?.checked,
    ringCatalog.querySelector('[name="inheritPlacements"]') === null,
  ];
  check(
    "an item without a set shows its own values",
    JSON.stringify(own) === JSON.stringify(["Uncommon", true, true]),
    own,
    ["Uncommon", true, true],
  );
  const whoHidden = [catalog, lanternCatalog].map(
    (root) => root.querySelector('select[name="requirement"]')?.closest("[hidden]") !== null,
  );
  check(
    "who can attune shows only for an item that requires attunement",
    JSON.stringify(whoHidden) === JSON.stringify([true, false]),
    whoHidden,
    [true, false],
  );
  check(
    "the empty editor explains each kind and leaves the buttons to the header",
    JSON.stringify(startPanel) === JSON.stringify([0, 4]),
    startPanel,
    [0, 4],
  );
  check(
    "a new item offers every template",
    templateButtons.length === itemTemplates.length,
    templateButtons.length,
    itemTemplates.length,
  );
  const started = [
    newCatalog.querySelector<HTMLInputElement>('input[name="overrideItemType"]')?.value,
    newCatalog.querySelector<HTMLSelectElement>('select[name="overrideRarity"]')?.value,
    lines(newCatalog, ".hb-effect-summary")[0],
  ];
  const expectedStart = ["Weapon", "Uncommon", "Weapon (any), +1 to attack and damage rolls"];
  check(
    "a template fills the item and its preview",
    JSON.stringify(started) === JSON.stringify(expectedStart),
    started,
    expectedStart,
  );
  const changes = ringCatalog.querySelectorAll(".hb-toggle-row .hb-toggle-change").length;
  check("the toggle lists each of its changes", changes === 2, changes, 2);
  const switches = document.querySelectorAll('[name="characterMechanics"]').length;
  check("automation follows the effects, with no switch", switches === 0, switches, 0);
  const casting = ringCatalog.querySelector<HTMLSelectElement>('select[name="casting-ability"]');
  check(
    "the spellcasting ability defaults to the player's pick",
    casting?.value === "choose" && !casting.closest<HTMLElement>(".hb-grants-casting")?.hidden,
    casting?.value,
    "choose",
  );
  const ringSummary = lines(ringCatalog, ".hb-effect-summary").slice(2);
  check(
    "the editor reads back every grant unchanged",
    JSON.stringify(ringSummary) === JSON.stringify(ringLines),
    ringSummary,
    ringLines,
  );
  const defenseCard = lines(gallery, ".hb-card-effects");
  check(
    "a gallery card lists the set condition",
    JSON.stringify(defenseCard) === JSON.stringify(["Armor Class +1", fateTouched]),
    defenseCard,
    ["Armor Class +1", fateTouched],
  );
  const ringCard = lines(linked, ".hb-card.focused .hb-card-effects").slice(2);
  check(
    "a gallery card lists an item's grants in plain words",
    JSON.stringify(ringCard) === JSON.stringify(ringLines),
    ringCard,
    ringLines,
  );
  const cards = [...gallery.querySelectorAll(".hb-card h2")].map((node) => node.textContent);
  check(
    "gallery lists only revealed, published items",
    JSON.stringify(cards) === JSON.stringify(["Cursed Card: Defense"]),
    cards,
    ["Cursed Card: Defense"],
  );
  const focused = linked.querySelector(".hb-card.focused h2")?.textContent;
  check(
    "a sheet link opens a held but unrevealed item",
    focused === "Ring of Wit",
    focused,
    "Ring of Wit",
  );
  const roundTrip = canonical(everythingEditor.read()) === canonical(everything);
  check(
    "the grants form reads back every field of the vocabulary unchanged",
    roundTrip,
    roundTrip ? "unchanged" : everythingEditor.read(),
    everything,
  );
  const offered = emptyEditor.root.querySelectorAll(
    'select[name="empty#add"] option[value]:not([value=""])',
  ).length;
  const grantCount = Object.keys(grantsSchema.properties ?? {}).length;
  check("an empty grants form offers every grant", offered === grantCount, offered, grantCount);
  const mechanicsBack = mechanics.map((editor, index) => {
    const subclass = subclasses[index]!;
    const expected = {
      spells: subclass.spells,
      classResources: subclass.classResources,
      tableColumns: subclass.tableColumns,
      features: subclass.features,
      ...(subclass.grants ? { grants: subclass.grants } : {}),
      ...(subclass.spellcasting
        ? { spellcasting: subclass.spellcasting, progression: subclass.progression }
        : {}),
    };
    return canonical(editor.read()) === canonical(expected) ? "unchanged" : editor.read();
  });
  check(
    "the subclass editor reads back each fixture subclass unchanged",
    mechanicsBack.every((entry) => entry === "unchanged"),
    mechanicsBack,
    ["unchanged", "unchanged"],
  );
  const featForm = [
    featCatalog.querySelector<HTMLInputElement>('input[name="prereqLevel"]')?.value,
    [
      ...(featCatalog.querySelector<HTMLSelectElement>('select[name="prereqAbilities"]')
        ?.selectedOptions ?? []),
    ].map((entry) => entry.value),
    featCatalog.querySelector<HTMLSelectElement>('select[name="category"]')?.value,
  ];
  check(
    "a feat shows its category and its printed prerequisite in the form",
    JSON.stringify(featForm) === JSON.stringify(["4", ["INT", "WIS"], "general"]),
    featForm,
    ["4", ["INT", "WIS"], "general"],
  );
  const featHeader = featCatalog
    .querySelector(".hb-preview codex-addon-markdown")
    ?.textContent?.split("\n")[0];
  check(
    "a feat previews the header the sheet shows",
    featHeader === "*General Feat (Prerequisite: Level 4+, Intelligence or Wisdom 13+)*",
    featHeader,
    "*General Feat (Prerequisite: Level 4+, Intelligence or Wisdom 13+)*",
  );
  const firstGroup = featCatalog
    .querySelector<HTMLSelectElement>('select[name="grants#add"]')
    ?.querySelector("optgroup")?.label;
  check(
    "a feat's grants offer feat benefits first",
    firstGroup === "Feat benefits",
    firstGroup,
    "Feat benefits",
  );
  const kept =
    importedFeatCatalog.querySelector(".hb-effects-fieldset .hb-hint")?.textContent ?? "";
  check(
    "a prerequisite the form cannot show is kept and described",
    kept.startsWith("From a file, kept as it is: Level 8+") &&
      !importedFeatCatalog.querySelector('input[name="prereqLevel"]'),
    kept,
    "From a file, kept as it is: Level 8+…",
  );
  const featProblems = [featCatalog, importedFeatCatalog].map(
    (root) => root.querySelectorAll(".hb-preview .hb-message").length,
  );
  check(
    "valid feats preview without a problem",
    JSON.stringify(featProblems) === JSON.stringify([0, 0]),
    featProblems,
    [0, 0],
  );
  const features = subclassCatalog.querySelectorAll(".hb-feature").length;
  check("the subclass editor shows one panel per feature", features === 4, features, 4);
  const target = subclassCatalog.querySelector<HTMLSelectElement>(
    'select[name="features[0].grants.activations[0].modifiers[0].target"]',
  )?.value;
  check("a toggle's change shows its target", target === "speed", target, "speed");
  const classId = subclassCatalog.querySelector<HTMLSelectElement>('select[name="classId"]')?.value;
  check(
    "a class missing from the rules data stays chosen",
    classId === "barbarian",
    classId,
    "barbarian",
  );
  const subclassProblems = subclassCatalog.querySelectorAll(".hb-preview .hb-message").length;
  check("a valid subclass previews without a problem", subclassProblems === 0, subclassProblems, 0);
  const featureLines = lines(subclassCatalog, ".hb-preview .hb-effect-summary");
  const expectedFeatures = [
    "Level 3: War Drum (Toggles)",
    "Level 6: Thunder Ward (Resistances)",
    "Level 10: Rolling Thunder",
    "Level 14: Storm Voice (Skill proficiencies, Advantages)",
  ];
  check(
    "the preview lists the features by level with what they grant",
    JSON.stringify(featureLines) === JSON.stringify(expectedFeatures),
    featureLines,
    expectedFeatures,
  );
  const overflowing = [...document.querySelectorAll<HTMLElement>(".hb-card, .hb-tree, .hb-form")]
    .filter((node) => node.scrollWidth > node.clientWidth + 1)
    .map((node) => node.className);
  check("no panel overflows horizontally", overflowing.length === 0, overflowing, []);
  const page = document.documentElement;
  check(
    "the page does not scroll sideways",
    page.scrollWidth <= page.clientWidth,
    page.scrollWidth,
    `<= ${page.clientWidth}`,
  );
  return { name: "Homebrew items", checks };
};
