import type { Translator } from "./catalogs.js";
import {
  chipsField,
  choiceField,
  choiceValue,
  dependentGroup,
  element,
  formIds,
  formText,
  formValues,
  idsField,
  optionalChoiceField,
} from "./fields.js";
import {
  armorTypes,
  maxBonus,
  weaponCategories,
  weaponProperties,
  weaponRanges,
  type BaseItem,
  type Item,
} from "./model.js";
import { pickerOptions, type References } from "./references.js";

type Kind = "" | BaseItem["kind"];
type Mode = "ids" | "filter";

/** English labels of the base filter vocabulary, translated where shown. */
export const gearLabels: Readonly<Record<string, string>> = {
  simple: "Simple",
  martial: "Martial",
  melee: "Melee",
  ranged: "Ranged",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  shield: "Shield",
  ammunition: "Ammunition",
  finesse: "Finesse",
  loading: "Loading",
  reach: "Reach",
  thrown: "Thrown",
  "two-handed": "Two-Handed",
  versatile: "Versatile",
};

/** A declared bonus as a list: one number, or the several the player picks from. */
export const bonusesOf = (bonus: number | readonly number[] | undefined): readonly number[] =>
  bonus === undefined ? [] : typeof bonus === "number" ? [bonus] : bonus;

/** "+1 / +2 / +3": a declared bonus in words. */
export const bonusText = (bonus: number | readonly number[] | undefined): string =>
  bonusesOf(bonus)
    .map((value) => `+${value}`)
    .join(" / ");

/** What the form says the item is: "weapon", "armor" or "" for neither. */
export function gearKind(root: ParentNode): Kind {
  return choiceValue(root, "baseKind") as Kind;
}

/** The +1 to +5 picker of a magic bonus; picking several lets the player choose. */
export function bonusField(
  document: Document,
  t: Translator,
  name: string,
  selected: readonly number[],
): HTMLFieldSetElement {
  return choiceField(
    document,
    t("Bonus"),
    name,
    selected.map(String),
    Array.from({ length: maxBonus }, (_, index) => [String(index + 1), `+${index + 1}`] as const),
    t("Pick several to let the player choose."),
  );
}

/** What a bonusField sent: one number, a list in ascending order, or nothing. */
export function formBonus(data: FormData, name: string): number | number[] | undefined {
  const bonuses = formValues(data, name)
    .map(Number)
    .sort((left, right) => left - right);
  return bonuses.length === 0 ? undefined : bonuses.length === 1 ? bonuses[0] : bonuses;
}

/**
 * What weapon or armor the item is: specific base records or any that match
 * filters, and the bonus. Only the controls for the current choice are shown;
 * reading takes the form's current values.
 */
export function gearFields(
  document: Document,
  t: Translator,
  item: Item,
  references?: References,
): HTMLElement {
  const root = element(document, "div", "hb-gear");
  const base = item.baseItem,
    kind: Kind = base?.kind ?? "",
    mode: Mode = base && base.ids === undefined ? "filter" : "ids";
  const chips = (values: readonly string[]): (readonly [string, string])[] =>
    values.map((value) => [value, t(gearLabels[value] ?? value)] as const);
  const kindField = optionalChoiceField(
    document,
    t("The item is"),
    "baseKind",
    kind,
    [
      ["weapon", t("A weapon")],
      ["armor", t("Armor or a shield")],
    ],
    t(
      "Leave both off for anything else. A magic weapon or armor is a base weapon or armor from the rules data, such as a longsword. Its bonus adds to attack and damage rolls, or to Armor Class. Several bases or bonuses let the player choose.",
    ),
  );
  const modeField = choiceField(document, t("Base"), "baseMode", mode, [
    ["ids", t("These records")],
    ["filter", t("Any that match")],
  ]);
  const weapon = kind === "weapon",
    ids = base?.ids ?? [],
    except = base?.except ?? [];
  const weapons = idsField(
    document,
    t("Base weapons"),
    "baseWeapons",
    weapon ? ids : [],
    references && pickerOptions(references.weapons),
    { placeholder: "longsword", hint: t("Weapon ids, separated by commas.") },
  );
  const armor = idsField(
    document,
    t("Base armor"),
    "baseArmor",
    weapon ? [] : ids,
    references && pickerOptions(references.armor),
    { placeholder: "chain-mail, shield", hint: t("Armor ids, separated by commas.") },
  );
  const categories = chipsField(
    document,
    t("Categories"),
    "baseCategories",
    base?.categories ?? [],
    chips(weaponCategories),
  );
  const ranges = chipsField(
    document,
    t("Ranges"),
    "baseRanges",
    base?.ranges ?? [],
    chips(weaponRanges),
  );
  const saved = base?.properties ?? [];
  const properties = chipsField(
    document,
    t("Weapon properties"),
    "baseProperties",
    saved,
    chips([...new Set([...weaponProperties, ...saved])]),
  );
  const types = chipsField(
    document,
    t("Armor types"),
    "baseArmorTypes",
    base?.armorTypes ?? [],
    chips(armorTypes),
  );
  const weaponExcept = idsField(
    document,
    t("Except"),
    "baseWeaponExcept",
    weapon ? except : [],
    references && pickerOptions(references.weapons),
    { placeholder: "net", hint: t("Ids left out, separated by commas.") },
  );
  const armorExcept = idsField(
    document,
    t("Except"),
    "baseArmorExcept",
    weapon ? [] : except,
    references && pickerOptions(references.armor),
    { placeholder: "hide-armor", hint: t("Ids left out, separated by commas.") },
  );
  const bonus = bonusField(document, t, "baseBonus", bonusesOf(base?.bonus));
  const choice = element(document, "div", "hb-row"),
    filters = element(document, "div", "hb-row");
  choice.append(modeField, bonus);
  filters.append(categories, ranges, properties);
  const which = dependentGroup(
    document,
    "",
    choice,
    weapons,
    armor,
    filters,
    types,
    weaponExcept,
    armorExcept,
  );
  const why = which.querySelector(".hb-depends-why")!;
  const show = (): void => {
    const chosen = gearKind(kindField),
      filter = choiceValue(modeField, "baseMode") === "filter";
    which.hidden = chosen === "";
    why.textContent = `↳ ${chosen === "weapon" ? t("Because it is a weapon") : t("Because it is armor or a shield")}`;
    weapons.hidden = chosen !== "weapon" || filter;
    armor.hidden = chosen !== "armor" || filter;
    categories.hidden =
      ranges.hidden =
      properties.hidden =
      weaponExcept.hidden =
        chosen !== "weapon" || !filter;
    types.hidden = armorExcept.hidden = chosen !== "armor" || !filter;
    filters.hidden = chosen !== "weapon" || !filter;
  };
  // The form's own change listener marks the draft dirty and redraws the preview.
  kindField.addEventListener("change", show);
  modeField.addEventListener("change", show);
  root.append(kindField, which);
  show();
  return root;
}

/** The base item as entered; validation happens where the item is checked. */
export function readGear(data: FormData): { baseItem?: BaseItem } {
  const kind = formText(data, "baseKind");
  if (kind !== "weapon" && kind !== "armor") return {};
  const weapon = kind === "weapon",
    filter = formText(data, "baseMode") === "filter",
    present = (values: string[]): string[] | undefined => (values.length ? values : undefined);
  const fields: Record<string, unknown> = { kind };
  if (!filter) fields["ids"] = formIds(data, weapon ? "baseWeapons" : "baseArmor");
  else if (weapon) {
    fields["categories"] = present(formValues(data, "baseCategories"));
    fields["ranges"] = present(formValues(data, "baseRanges"));
    fields["properties"] = present(formValues(data, "baseProperties"));
    fields["except"] = present(formIds(data, "baseWeaponExcept"));
  } else {
    fields["armorTypes"] = present(formValues(data, "baseArmorTypes"));
    fields["except"] = present(formIds(data, "baseArmorExcept"));
  }
  fields["bonus"] = formBonus(data, "baseBonus");
  const baseItem = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as unknown as BaseItem;
  return { baseItem };
}

/** The preview line: "Weapon (longsword), +1 to attack and damage rolls". */
export function describeGear(
  base: BaseItem | undefined,
  t: Translator,
  references?: References,
): string[] {
  if (!base) return [];
  const weapon = base.kind === "weapon",
    known = weapon ? references?.weapons : references?.armor,
    names = (ids: readonly string[]): string =>
      ids.map((id) => known?.find((option) => option.id === id)?.name ?? id).join(", ");
  const filters = [
    ...(base.categories ?? []),
    ...(base.ranges ?? []),
    ...(base.properties ?? []),
    ...(base.armorTypes ?? []),
  ].map((value) => t(gearLabels[value] ?? value));
  let which = base.ids ? names(base.ids) : filters.length ? filters.join(", ") : t("any");
  if (base.except)
    which = t("{list}, except {except}", { list: which, except: names(base.except) });
  const bonus = bonusText(base.bonus);
  const params = { base: which, bonus };
  if (!bonus) return [weapon ? t("Weapon ({base})", params) : t("Armor ({base})", params)];
  return [
    weapon
      ? t("Weapon ({base}), {bonus} to attack and damage rolls", params)
      : t("Armor ({base}), {bonus} to Armor Class", params),
  ];
}
