import { attunementFields, containerFields, readCarrying } from "./carrying.js";
import { problemText, type Translator } from "./catalogs.js";
import { describeEffect, effectsEditor } from "./effects.js";
import {
  checkField,
  chipsField,
  choiceField,
  dependentGroup,
  element,
  formNumber,
  formSection,
  formText,
  formValues,
  markdown,
  markdownField,
  messageBlock,
  numberField,
  selectField,
  setting,
  splitTags,
  textField,
} from "./fields.js";
import { describeGrants, grantsEditor } from "./grants.js";
import { describeGear, gearFields, readGear } from "./magic-gear.js";
import {
  bodyPlacements,
  flatten,
  freeId,
  itemProblem,
  maxMarkdown,
  maxWeight,
  mechanicsOf,
  moveOverrides,
  noSetDefaults,
  rarities,
  recordProblem,
  type BodyPlacement,
  type Item,
  type ItemSet,
  type Overrides,
  type Rarity,
} from "./model.js";
import type { References } from "./references.js";

/** Common item types; "Other…" takes any one-line type. */
export const itemTypes = [
  "Wondrous Item",
  "Armor",
  "Weapon",
  "Ring",
  "Rod",
  "Staff",
  "Wand",
  "Potion",
  "Scroll",
  "Ammunition",
] as const;
const otherType = "other";

export interface ItemEditorContext {
  readonly document: Document;
  readonly t: Translator;
  readonly references: References | undefined;
  readonly sets: readonly ItemSet[];
  /** Ids in use, for the id a new draft takes from its name. */
  readonly takenIds: () => ReadonlySet<string>;
  /** Marks the draft changed. */
  readonly changed: () => void;
  /** Asks the owner to refresh enhanced controls after controls are added or removed. */
  readonly restructured: () => void;
}

export interface ItemEditor {
  /** The item as the form holds it; validation happens where it is checked. */
  read(): Item;
}

/**
 * The item form in sections: Basics, Description, What it does and Carrying.
 * The set, visibility, tags and id go into `settings`; the published preview
 * follows the form. Fields a choice reveals sit under that choice.
 */
export function itemEditor(
  context: ItemEditorContext,
  form: HTMLFormElement,
  main: HTMLElement,
  settings: HTMLElement,
  initial: Item,
  saved: boolean,
): ItemEditor {
  const { document, t, references } = context;
  const setOf = (id: string): ItemSet | undefined =>
    context.sets.find((itemSet) => itemSet.id === id);
  let currentSet = setOf(initial.setId);

  const changedRows = (): void => {
    context.changed();
    update();
  };
  const effects = effectsEditor(
    document,
    initial.characterEffects,
    t,
    changedRows,
    () => context.restructured(),
    references?.classes,
  );
  const grants = grantsEditor(
    document,
    initial.grants,
    t,
    changedRows,
    () => context.restructured(),
    () => formText(new FormData(form), "name").trim(),
    references,
  );
  const who = attunementFields(document, t, initial, references);
  who.show(true);
  const whoGroup = dependentGroup(document, t("Because it requires attunement"), who.root);
  const kind = element(document, "div", "hb-basics"),
    carry = element(document, "div", "hb-basics");
  const carrySummary = element(document, "span", "hb-section-summary");

  const read = (): Item => {
    const data = new FormData(form);
    const name = formText(data, "name").trim();
    const effectRows = effects.read(),
      granted = grants.read(),
      gear = readGear(data);
    const overrides = readOverrides(data, currentSet);
    const attuned = overrides.attunement ?? currentSet?.attunement ?? noSetDefaults.attunement;
    // A requirement applies only while the item requires attunement.
    const { attunementPrerequisites, ...carrying } = readCarrying(data, initial);
    return {
      id: saved ? initial.id : formText(data, "id").trim() || freeId(name, context.takenIds()),
      schemaVersion: 1,
      setId: formText(data, "setId"),
      name,
      text: formText(data, "text"),
      overrides,
      tags: splitTags(formText(data, "tags")),
      characterMechanics: mechanicsOf(effectRows, granted, gear.baseItem),
      characterEffects: effectRows,
      playerVisible: data.get("playerVisible") !== null,
      retired: data.get("retired") !== null,
      updatedAt: Date.now(),
      ...(granted ? { grants: granted } : {}),
      ...(attuned && attunementPrerequisites ? { attunementPrerequisites } : {}),
      ...carrying,
      ...gear,
    };
  };

  /** Type, rarity and attunement in Basics; weight and placements in Carrying. */
  const renderBasics = (overrides: Overrides): void => {
    const fromSet = (text: string): string => t("From set ({value})", { value: text });
    const inherited = currentSet;
    const own = overrides.itemType ?? "";
    const typeChoice = own === "" ? (inherited ? "" : noSetDefaults.itemType) : own;
    const known = (itemTypes as readonly string[]).includes(typeChoice) || typeChoice === "";
    const typeSelect = selectField(
      document,
      t("Item type"),
      "overrideItemTypeChoice",
      known ? typeChoice : otherType,
      [
        ...(inherited ? [["", fromSet(t(inherited.itemType))] as const] : []),
        ...itemTypes.map((type) => [type, t(type)] as const),
        [otherType, t("Other…")],
      ],
    );
    const typeText = textField(document, t("Item type"), "overrideItemType", known ? "" : own, {
      maxLength: 120,
      placeholder: t("Sentient Sword"),
      hint: t("Any one-line type, shown under the item's name."),
    });
    const typeOther = dependentGroup(document, t("Because you chose Other…"), typeText);
    const showType = (): void => {
      typeOther.hidden = typeSelect.querySelector("select")!.value !== otherType;
    };
    typeSelect.querySelector("select")!.addEventListener("change", () => {
      showType();
      context.restructured();
    });
    showType();
    const row = element(document, "div", "hb-row");
    row.append(
      typeSelect,
      selectField(
        document,
        t("Rarity"),
        "overrideRarity",
        overrides.rarity ?? (inherited ? "" : noSetDefaults.rarity),
        [
          ...(inherited ? [["", fromSet(t(inherited.rarity))] as const] : []),
          ...rarities.map((rarity) => [rarity, t(rarity)] as const),
        ],
      ),
    );
    const attunement = choiceField(
      document,
      t("Requires attunement"),
      "overrideAttunement",
      inherited
        ? overrides.attunement === undefined
          ? ""
          : overrides.attunement
            ? "yes"
            : "no"
        : overrides.attunement === true
          ? "yes"
          : "no",
      [
        ...(inherited ? [["", fromSet(t(inherited.attunement ? "Yes" : "No"))] as const] : []),
        ["no", t("No")],
        ["yes", t("Yes")],
      ],
    );
    kind.replaceChildren(row, typeOther, attunement, whoGroup);
    const showWho = (chosen: boolean | undefined): void => {
      whoGroup.hidden = !(chosen ?? currentSet?.attunement ?? noSetDefaults.attunement);
    };
    attunement.addEventListener("change", () => {
      showWho(readOverrides(new FormData(form), currentSet).attunement);
      context.restructured();
    });

    const placementOptions = bodyPlacements.map((placement) => [placement, t(placement)] as const);
    const weight = numberField(document, t("Weight (lb)"), "overrideWeight", overrides.weightLb, {
      min: 0,
      max: maxWeight,
      step: "any",
      placeholder:
        inherited?.weightLb === undefined ? t("Unknown") : fromSet(String(inherited.weightLb)),
    });
    const placements = element(document, "div", "hb-placements");
    const chips = chipsField(
      document,
      t("Body placements"),
      "overridePlacements",
      overrides.bodyPlacements ?? inherited?.bodyPlacements ?? [],
      placementOptions,
      inherited ? undefined : t("Where the item is worn, for equipment slots."),
    );
    if (inherited) {
      const list = inherited.bodyPlacements.map((placement) => t(placement)).join(", ");
      const inherit = checkField(
        document,
        t("Use the set's placements ({list})", { list: list || t("none") }),
        "inheritPlacements",
        overrides.bodyPlacements === undefined,
      );
      const box = inherit.querySelector("input")!;
      const own = dependentGroup(document, t("Because the item has its own placements"), chips);
      const show = (): void => {
        own.hidden = box.checked;
      };
      box.addEventListener("change", () => {
        show();
        context.restructured();
      });
      placements.append(inherit, own);
      show();
    } else placements.append(chips);
    const physical = element(document, "div", "hb-row");
    physical.append(weight, placements);
    carry.replaceChildren(physical);
    // The controls may not be in the form yet, so this reads the values given.
    showWho(overrides.attunement);
  };
  renderBasics(initial.overrides);

  const setField = setting(
    selectField(
      document,
      t("Set"),
      "setId",
      initial.setId,
      [["", t("No set")], ...context.sets.map((itemSet) => [itemSet.id, itemSet.name] as const)],
      t("A set gives its items shared values, which each item can change."),
    ),
  );
  setField.querySelector("select")!.addEventListener("change", (event) => {
    const previous = currentSet;
    const overrides = readOverrides(new FormData(form), previous);
    currentSet = setOf((event.target as HTMLSelectElement).value);
    renderBasics(moveOverrides(overrides, previous, currentSet));
    context.restructured();
  });

  const doesNote = element(
    document,
    "p",
    "hb-hint",
    t(
      "Applies while the item is equipped, and attuned when it requires attunement. An item without any of these is text only: players see its description.",
    ),
  );
  // Lists show only once they hold a row; one row of buttons adds to each.
  const effectGroup = element(document, "div", "hb-grants-section");
  effectGroup.append(
    element(document, "h4", "hb-grants-heading", t("Bonuses and proficiencies")),
    effects.root,
  );
  const adders = element(document, "div", "hb-adders");
  adders.dataset["uiActions"] = "";
  adders.append(
    element(document, "span", "hb-adders-label", t("Add:")),
    effects.button,
    ...grants.adders,
  );
  const passive = element(document, "div", "hb-passive");
  passive.append(
    element(document, "h4", "hb-grants-heading", t("Resistances and immunities")),
    grants.passive,
  );

  // Carrying is folded to one line until it is opened.
  const carrying = element(document, "details", "hb-section hb-collapsible");
  carrying.dataset["hbSection"] = t("Carrying");
  carrying.open =
    initial.container !== undefined ||
    initial.overrides.weightLb !== undefined ||
    initial.overrides.bodyPlacements !== undefined;
  const carryHead = element(document, "summary");
  carryHead.append(element(document, "h3", "hb-section-head", t("Carrying")), carrySummary);
  carrying.append(carryHead, carry, containerFields(document, t, initial));

  const id = setting(
    textField(document, t("Id"), "id", initial.id, {
      maxLength: 64,
      readOnly: saved,
      placeholder: "ring-of-embers",
      hint: saved
        ? t("Used in saved characters; it cannot change after the first save.")
        : t(
            "Leave it empty to make one from the name. Saved characters use it, so it cannot change after the first save.",
          ),
    }),
  );
  settings.append(
    setField,
    checkField(
      document,
      t("Visible to players"),
      "playerVisible",
      initial.playerVisible,
      t("Lists the item in the player gallery when its set is visible too."),
    ),
  );
  if (saved)
    settings.append(
      checkField(
        document,
        t("Retired"),
        "retired",
        initial.retired,
        t("Retired items stay usable by characters but leave the player gallery."),
      ),
    );
  settings.append(
    textField(document, t("Tags"), "tags", initial.tags.join(", "), {
      hint: t("Lowercase words joined by hyphens, separated by commas."),
    }),
    id,
  );

  const description = markdownField(
    document,
    t("Description"),
    "text",
    initial.text,
    maxMarkdown,
    t("The effect as players read it. Select words to link them to a rule, or type [[ to search."),
  );
  // The section's heading already says it; the writer keeps its accessible name.
  description.querySelector(".hb-writer-label")?.classList.add("hb-visually-hidden");
  main.append(
    formSection(
      document,
      t("Basics"),
      textField(document, t("Name"), "name", initial.name, { maxLength: 120 }),
      kind,
    ),
    formSection(document, t("Description"), description),
    formSection(
      document,
      t("What it does"),
      doesNote,
      gearFields(document, t, initial, references),
      effectGroup,
      grants.root,
      passive,
      adders,
    ),
    carrying,
  );

  // The id placeholder follows the name: it shows the id saving will use.
  const nameInput = form.querySelector<HTMLInputElement>('input[name="name"]')!,
    idInput = id.querySelector("input")!;
  if (!saved)
    nameInput.addEventListener("input", () => {
      const text = nameInput.value.trim();
      idInput.placeholder = text ? freeId(text, context.takenIds()) : "ring-of-embers";
    });

  const preview = element(document, "aside", "hb-preview");
  preview.setAttribute("aria-live", "polite");
  form.append(preview);
  const update = (): void => {
    const item = read();
    const published = flatten(currentSet, { ...item, name: item.name || t("New item") });
    const failure =
      itemProblem({ ...item, id: item.id || "item", name: item.name || "item" }) ??
      recordProblem(published.record);
    preview.replaceChildren(
      element(document, "h3", "", t("As published")),
      element(document, "p", "hb-preview-name", published.record.name),
    );
    if (failure) preview.append(messageBlock(document, problemText(t, failure), "alert"));
    const lines = [
      ...describeGear(published.record.baseItem, t, references),
      ...published.record.characterEffects.map((effect) => describeEffect(effect, t)),
      ...describeGrants(published.record.grants, t),
    ];
    if (lines.length > 0) {
      const list = element(document, "ul", "hb-effect-summary");
      for (const line of lines) list.append(element(document, "li", "", line));
      preview.append(list);
    }
    preview.append(markdown(document, published.record.text));
    carrySummary.textContent = carryingSummary(item, currentSet, t);
  };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
  return { read };
}

/** "5 lb · Neck · holds 500 lb": the Carrying section while it is folded. */
function carryingSummary(item: Item, itemSet: ItemSet | undefined, t: Translator): string {
  const weight = item.overrides.weightLb ?? itemSet?.weightLb;
  const placements = item.overrides.bodyPlacements ?? itemSet?.bodyPlacements ?? [];
  const parts = [
    weight === undefined ? t("Weight unknown") : t("{weight} lb", { weight }),
    ...placements.map((placement) => t(placement)),
    ...(item.container
      ? [
          item.container.capacityLb === undefined
            ? t("Holds items")
            : t("Holds {weight} lb", { weight: item.container.capacityLb }),
        ]
      : []),
  ];
  return parts.join(" · ");
}

/** The values the item sets itself; empty fields and the no-set defaults are left out. */
function readOverrides(data: FormData, itemSet: ItemSet | undefined): Overrides {
  const typeChoice = formText(data, "overrideItemTypeChoice"),
    itemType =
      typeChoice === otherType ? formText(data, "overrideItemType").trim() : typeChoice.trim(),
    rarity = formText(data, "overrideRarity"),
    attunement = formText(data, "overrideAttunement"),
    weight = formNumber(data, "overrideWeight"),
    placements = formValues(data, "overridePlacements") as BodyPlacement[];
  const ownType = itemType !== "" && (itemSet !== undefined || itemType !== noSetDefaults.itemType);
  const ownRarity = rarity !== "" && (itemSet !== undefined || rarity !== noSetDefaults.rarity);
  const ownPlacements =
    itemSet !== undefined ? data.get("inheritPlacements") === null : placements.length > 0;
  return {
    ...(ownType ? { itemType } : {}),
    ...(ownRarity ? { rarity: rarity as Rarity } : {}),
    // Without a set, "No" is the default and is not stored.
    ...(attunement === "yes"
      ? { attunement: true }
      : attunement === "no" && itemSet !== undefined
        ? { attunement: false }
        : {}),
    ...(ownPlacements ? { bodyPlacements: placements } : {}),
    ...(weight === undefined ? {} : { weightLb: weight }),
  };
}
