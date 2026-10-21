import { defineCatalogElement } from "#web/catalog-element";
import { defineGalleryElement } from "#web/gallery-element";
import { HomebrewRepository } from "#web/repository";
import { registerRuntime } from "#web/runtime";
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
const documents = (values: readonly { id: string }[], key = (value: { id: string }) => value.id) =>
  values.map((value): AddonDocument<unknown> => ({ key: key(value), revision: 1, value }));
const stored: Record<string, readonly AddonDocument<unknown>[]> = {
  homebrew_sets: documents(fixture.sets),
  homebrew_items: documents(fixture.cases.map((testCase) => testCase.item)),
  homebrew_published: documents(fixture.cases.slice(0, 3).map((testCase) => testCase.published)),
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
registerRuntime(generation, { ui, repository, importer, signal });
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
  attempt < 60 && !lanternCatalog.querySelector('[name="requirementClasses"]');
  attempt++
)
  await frame();
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
        "Lantern",
        "Ring of Wit",
        "Trinket",
      ]),
    names,
    ["Cursed Cards", "Defense", "Omens", "Destiny", "Lantern", "Ring of Wit", "Trinket"],
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
    status.includes("Unpublished changes: 2."),
    status,
    "…Unpublished changes: 2.",
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
  const sections = [...ringCatalog.querySelectorAll(".hb-grants-section")].map(
    (node) => node.querySelectorAll(".hb-grant-row").length,
  );
  check(
    "editor shows one row per grant: advantage, use, two spells, toggle",
    JSON.stringify(sections) === JSON.stringify([1, 1, 2, 1, 0]),
    sections,
    [1, 1, 2, 1, 0],
  );
  const shown = (name: string): string | undefined => {
    const control = lanternCatalog.querySelector<HTMLInputElement>(`[name="${name}"]`);
    return control?.closest<HTMLElement>("[data-ui-field]")?.hidden ? undefined : control?.value;
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
  const header =
    lanternCatalog.querySelector(".hb-preview codex-addon-markdown")?.textContent ?? "";
  check(
    "the published text names who can attune",
    header.startsWith("*Wondrous Item, Common (Requires Attunement by a Cleric or Wizard)*"),
    header,
    "*Wondrous Item, Common (Requires Attunement by a Cleric or Wizard)*…",
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
