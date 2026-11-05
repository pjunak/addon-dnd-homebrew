import type { Translator } from "./catalogs.js";
import {
  choiceField,
  choiceValue,
  dependentGroup,
  element,
  formIds,
  formText,
  formValues,
  idsField,
} from "./fields.js";
import { bonusField, bonusesOf, bonusText, formBonus } from "./magic-gear.js";
import { focusTargets, titleOf, type Item, type SpellcastingFocus } from "./model.js";
import { pickerOptions, type References } from "./references.js";

type FocusTarget = (typeof focusTargets)[number];
const targetLabels: Readonly<Record<FocusTarget, string>> = {
  spellAttack: "Spell attack rolls",
  spellSaveDC: "Spell save DC",
};

export interface FocusFields {
  readonly root: HTMLElement;
  /** Shows the controls that apply to the item as the form now holds it. */
  sync(): void;
}

/**
 * Whether the item is a spellcasting focus; then what its bonus raises, for
 * which classes, and its own bonus unless it is a weapon or armor, whose bonus
 * it shares. `gearKind` is what the item now is: "weapon", "armor" or "".
 */
export function focusFields(
  document: Document,
  t: Translator,
  item: Item,
  references: References | undefined,
  gearKind: () => string,
  restructured: () => void,
): FocusFields {
  const focus = item.spellcastingFocus;
  const root = element(document, "div", "hb-focus");
  const switchField = choiceField(
    document,
    t("Spellcasting focus"),
    "focus",
    focus ? "yes" : "no",
    [
      ["no", t("No")],
      ["yes", t("Yes")],
    ],
    t("Its magic bonus also raises spell attack rolls, spell save DCs or both."),
  );
  const applies = choiceField(
    document,
    t("The bonus adds to"),
    "focusAppliesTo",
    focus?.appliesTo ?? focusTargets,
    focusTargets.map((target) => [target, t(targetLabels[target])] as const),
  );
  const classes = idsField(
    document,
    t("Classes"),
    "focusClasses",
    focus?.classes ?? [],
    references && pickerOptions(references.classes),
    { placeholder: "warlock", hint: t("Class ids, separated by commas.") },
  );
  const shared = element(document, "p", "hb-hint");
  // A new focus starts from the item's weapon or armor bonus, else +1.
  const own = bonusField(
    document,
    t,
    "focusBonus",
    bonusesOf(focus?.bonus ?? item.baseItem?.bonus ?? 1),
  );
  const group = dependentGroup(
    document,
    t("Because it is a spellcasting focus"),
    applies,
    classes,
    element(document, "p", "hb-hint", t("Leave the classes empty for every class.")),
    shared,
    own,
  );
  root.append(switchField, group);
  const sync = (): void => {
    const kind = gearKind();
    group.hidden = choiceValue(switchField, "focus") !== "yes";
    own.hidden = kind !== "";
    shared.hidden = kind === "";
    shared.textContent =
      kind === "armor"
        ? t("Uses the armor's bonus above, so the player picks once.")
        : t("Uses the weapon's bonus above, so the player picks once.");
  };
  switchField.addEventListener("change", () => {
    sync();
    restructured();
  });
  sync();
  return { root, sync };
}

/**
 * The focus as entered. `shared` says the item is a weapon or armor, whose
 * bonus the focus uses; validation happens where the item is checked.
 */
export function readFocus(
  data: FormData,
  shared: boolean,
): { spellcastingFocus?: SpellcastingFocus } {
  if (formText(data, "focus") !== "yes") return {};
  const picked = formValues(data, "focusAppliesTo"),
    classes = formIds(data, "focusClasses"),
    bonus = shared ? undefined : formBonus(data, "focusBonus");
  return {
    spellcastingFocus: {
      appliesTo: focusTargets.filter((target) => picked.includes(target)),
      ...(classes.length > 0 ? { classes } : {}),
      ...(bonus === undefined ? {} : { bonus }),
    },
  };
}

/** The preview line: "Spellcasting focus: +1 / +2 to spell attack rolls". */
export function describeFocus(
  focus: SpellcastingFocus | undefined,
  t: Translator,
  references?: References,
): string[] {
  const attack = focus?.appliesTo.includes("spellAttack"),
    dc = focus?.appliesTo.includes("spellSaveDC");
  if (!focus || (!attack && !dc)) return [];
  const params = {
    bonus: focus.bonus === undefined ? t("the same bonus") : bonusText(focus.bonus),
    what:
      attack && dc
        ? t("spell attack rolls and spell save DCs")
        : attack
          ? t("spell attack rolls")
          : t("spell save DCs"),
  };
  if (!focus.classes?.length) return [t("Spellcasting focus: {bonus} to {what}", params)];
  const classes = focus.classes
    .map((id) => references?.classes.find((entry) => entry.id === id)?.name ?? titleOf(id))
    .join(", ");
  return [t("Spellcasting focus for {classes} spells: {bonus} to {what}", { ...params, classes })];
}
