import { attunementFields, containerFields, readCarrying } from "./carrying.js";
import { problemText, type Translator } from "./catalogs.js";
import { describeEffect, effectsEditor } from "./effects.js";
import {
  actionButton,
  checkField,
  chipsField,
  element,
  formNumber,
  formText,
  formValues,
  markdown,
  messageBlock,
  numberField,
  selectField,
  splitTags,
  textArea,
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
import { fromTemplate, itemTemplates } from "./templates.js";

/** Common item types, offered as suggestions; any one-line type is allowed. */
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
  /** Opens a new draft again with `item`, as a template does; only for new drafts. */
  readonly restart?: (item: Item) => void;
}

export interface ItemEditor {
  /** The item as the form holds it; validation happens where it is checked. */
  read(): Item;
}

/**
 * The item form: name and set, what the item is (its own values or its
 * set's), its description, what it does on the sheet, how it is carried and
 * who sees it. Fields go into `main`; the published preview follows the form.
 */
export function itemEditor(
  context: ItemEditorContext,
  form: HTMLFormElement,
  main: HTMLElement,
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
  const effects = effectsEditor(document, initial.characterEffects, t, changedRows, () =>
    context.restructured(),
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
  const top = element(document, "div", "hb-basics"),
    carry = element(document, "div", "hb-basics");

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

  /** Type, rarity and attunement on top; weight and placements with carrying. */
  const renderBasics = (overrides: Overrides): void => {
    const fromSet = (text: string): string => t("From set ({value})", { value: text });
    const inherited = currentSet;
    const kind = element(document, "div", "hb-row");
    kind.append(
      textField(document, t("Item type"), "overrideItemType", overrides.itemType ?? "", {
        maxLength: 120,
        placeholder: inherited ? fromSet(inherited.itemType) : noSetDefaults.itemType,
        suggestions: itemTypes,
      }),
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
    const attunement = inherited
      ? selectField(
          document,
          t("Requires attunement"),
          "overrideAttunement",
          overrides.attunement === undefined ? "" : overrides.attunement ? "yes" : "no",
          [
            ["", fromSet(t(inherited.attunement ? "Yes" : "No"))],
            ["yes", t("Yes")],
            ["no", t("No")],
          ],
        )
      : checkField(
          document,
          t("Requires attunement"),
          "overrideAttunement",
          overrides.attunement === true,
        );
    const attune = element(document, "div", "hb-row");
    attune.append(attunement, who.root);
    top.replaceChildren(kind, attune);
    const showWho = (chosen: boolean | undefined): void =>
      who.show(chosen ?? currentSet?.attunement ?? noSetDefaults.attunement);
    attunement
      .querySelector("input, select")!
      .addEventListener("change", () =>
        showWho(readOverrides(new FormData(form), currentSet).attunement),
      );

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
      inherited ? undefined : t("Where the item is worn, for the sheet's equipment slots."),
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
      const show = (): void => {
        chips.hidden = box.checked;
      };
      box.addEventListener("change", () => {
        show();
        context.restructured();
      });
      placements.append(inherit, chips);
      show();
    } else placements.append(chips);
    const physical = element(document, "div", "hb-row");
    physical.append(weight, placements);
    carry.replaceChildren(physical);
    // The controls may not be in the form yet, so this reads the values given.
    showWho(overrides.attunement);
  };
  renderBasics(initial.overrides);

  if (!saved && context.restart) {
    const bar = element(document, "div", "hb-templates");
    bar.append(element(document, "span", "hb-templates-label", t("Start from")));
    const templateTexts = new Set(
      itemTemplates.flatMap((template) => (template.item.text ? [t(template.item.text)] : [])),
    );
    for (const template of itemTemplates) {
      const button = actionButton(
        document,
        t(template.label),
        () => {
          const draft = read();
          // A description the DM wrote stays; one a template wrote is replaced.
          const own = templateTexts.has(draft.text) ? { ...draft, text: "" } : draft;
          context.restart?.(fromTemplate(template, own, currentSet, t));
        },
        "quiet",
      );
      button.title = t(template.hint);
      bar.append(button);
    }
    main.append(bar);
  }

  const setField = selectField(document, t("Set"), "setId", initial.setId, [
    ["", t("No set")],
    ...context.sets.map((itemSet) => [itemSet.id, itemSet.name] as const),
  ]);
  setField.querySelector("select")!.addEventListener("change", (event) => {
    const previous = currentSet;
    const overrides = readOverrides(new FormData(form), previous);
    currentSet = setOf((event.target as HTMLSelectElement).value);
    renderBasics(moveOverrides(overrides, previous, currentSet));
    context.restructured();
  });
  const identity = element(document, "div", "hb-row hb-identity");
  identity.append(
    textField(document, t("Name"), "name", initial.name, { maxLength: 120 }),
    setField,
  );

  const mechanics = element(document, "fieldset", "hb-effects-fieldset");
  mechanics.append(
    element(document, "legend", "", t("What it does on the sheet")),
    element(
      document,
      "p",
      "hb-hint",
      t(
        "Applies while the item is equipped, and attuned when it requires attunement. An item without any of these is text only: the sheet shows its description.",
      ),
    ),
    gearFields(document, t, initial, references),
  );
  // Lists show only once they hold a row; one row of buttons adds to each.
  const effectGroup = element(document, "div", "hb-grants-section");
  effectGroup.append(
    element(document, "h4", "hb-grants-heading", t("Bonuses and proficiencies")),
    effects.root,
  );
  const adders = element(document, "div", "hb-adders");
  adders.dataset["uiActions"] = "";
  adders.append(effects.button, ...grants.adders);
  const passive = element(document, "div", "hb-passive");
  passive.append(
    element(document, "h4", "hb-grants-heading", t("Resistances and immunities")),
    grants.passive,
  );
  mechanics.append(effectGroup, grants.root, adders, passive);

  const carrying = element(document, "fieldset", "hb-effects-fieldset");
  carrying.append(
    element(document, "legend", "", t("Carrying")),
    carry,
    containerFields(document, t, initial),
  );

  const more = element(document, "details", "hb-defaults");
  more.open = !saved && initial.id !== "";
  const id = textField(document, t("Id"), "id", initial.id, {
    maxLength: 64,
    readOnly: saved,
    placeholder: "ring-of-embers",
    hint: saved
      ? t("Used in saved characters; it cannot change after the first save.")
      : t(
          "Leave it empty to make one from the name. Saved characters use it, so it cannot change after the first save.",
        ),
  });
  more.append(
    element(document, "summary", "", t("Id and tags")),
    id,
    textField(document, t("Tags"), "tags", initial.tags.join(", "), {
      hint: t("Lowercase words joined by hyphens, separated by commas."),
    }),
  );

  main.append(
    identity,
    top,
    textArea(
      document,
      t("Description"),
      "text",
      initial.text,
      5,
      maxMarkdown,
      t("The effect as players read it on their character sheet."),
    ),
    mechanics,
    carrying,
    checkField(
      document,
      t("Visible to players"),
      "playerVisible",
      initial.playerVisible,
      t("Lists the item in the player gallery when its set is visible too."),
    ),
  );
  if (saved)
    main.append(
      checkField(
        document,
        t("Retired"),
        "retired",
        initial.retired,
        t("Retired items stay usable on character sheets but leave the player gallery."),
      ),
    );
  main.append(more);

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
  };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
  return { read };
}

/** The values the item sets itself; empty fields and the no-set defaults are left out. */
function readOverrides(data: FormData, itemSet: ItemSet | undefined): Overrides {
  const itemType = formText(data, "overrideItemType").trim(),
    rarity = formText(data, "overrideRarity"),
    attunement = formText(data, "overrideAttunement"),
    weight = formNumber(data, "overrideWeight"),
    placements = formValues(data, "overridePlacements") as BodyPlacement[];
  const ownRarity = rarity !== "" && (itemSet !== undefined || rarity !== noSetDefaults.rarity);
  const ownPlacements =
    itemSet !== undefined ? data.get("inheritPlacements") === null : placements.length > 0;
  return {
    ...(itemType ? { itemType } : {}),
    ...(ownRarity ? { rarity: rarity as Rarity } : {}),
    // A checkbox sends "on" while checked; the set's select sends "yes" or "no".
    ...(attunement === "yes" || attunement === "on"
      ? { attunement: true }
      : attunement === "no"
        ? { attunement: false }
        : {}),
    ...(ownPlacements ? { bodyPlacements: placements } : {}),
    ...(weight === undefined ? {} : { weightLb: weight }),
  };
}
