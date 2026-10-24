import type { Translator } from "./catalogs.js";
import { chipsField, element, formText, formValues, idsField, selectField } from "./fields.js";
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

const bonusesOf = (base: BaseItem | undefined): readonly number[] =>
  base?.bonus === undefined ? [] : typeof base.bonus === "number" ? [base.bonus] : base.bonus;

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
  const kindField = selectField(
    document,
    t("The item is"),
    "baseKind",
    kind,
    [
      ["", t("Not a weapon or armor")],
      ["weapon", t("A weapon")],
      ["armor", t("Armor or a shield")],
    ],
    t(
      "A magic weapon or armor is a base weapon or armor from the rules data, such as a longsword. Its bonus adds to attack and damage rolls, or to Armor Class. Several bases or bonuses let the player pick on the sheet.",
    ),
  );
  const modeField = selectField(document, t("Base"), "baseMode", mode, [
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
  const bonus = chipsField(
    document,
    t("Bonus"),
    "baseBonus",
    bonusesOf(base).map(String),
    Array.from({ length: maxBonus }, (_, index) => [String(index + 1), `+${index + 1}`] as const),
  );
  const choice = element(document, "div", "hb-row"),
    filters = element(document, "div", "hb-row");
  choice.append(modeField, bonus);
  filters.append(categories, ranges, properties);
  const show = (): void => {
    const chosen = kindField.querySelector("select")!.value as Kind,
      filter = modeField.querySelector("select")!.value === "filter";
    modeField.hidden = bonus.hidden = chosen === "";
    weapons.hidden = chosen !== "weapon" || filter;
    armor.hidden = chosen !== "armor" || filter;
    categories.hidden =
      ranges.hidden =
      properties.hidden =
      weaponExcept.hidden =
        chosen !== "weapon" || !filter;
    types.hidden = armorExcept.hidden = chosen !== "armor" || !filter;
    choice.hidden = chosen === "";
    filters.hidden = chosen !== "weapon" || !filter;
  };
  // The form's own change listener marks the draft dirty and redraws the preview.
  kindField.querySelector("select")!.addEventListener("change", show);
  modeField.querySelector("select")!.addEventListener("change", show);
  root.append(kindField, choice, weapons, armor, filters, types, weaponExcept, armorExcept);
  show();
  return root;
}

/** The ids a picker sends, one value each, or a typed comma-separated list. */
function formIds(data: FormData, name: string): string[] {
  return [
    ...new Set(
      formValues(data, name)
        .flatMap((entry) => entry.split(","))
        .map((id) => id.trim().toLowerCase())
        .filter((id) => id !== ""),
    ),
  ];
}

/** The base item as entered; validation happens where the item is checked. */
export function readGear(data: FormData): { baseItem?: BaseItem } {
  const kind = formText(data, "baseKind");
  if (kind !== "weapon" && kind !== "armor") return {};
  const weapon = kind === "weapon",
    filter = formText(data, "baseMode") === "filter",
    present = (values: string[]): string[] | undefined => (values.length ? values : undefined),
    bonuses = formValues(data, "baseBonus")
      .map(Number)
      .sort((left, right) => left - right);
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
  if (bonuses.length) fields["bonus"] = bonuses.length === 1 ? bonuses[0] : bonuses;
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
  const bonus = bonusesOf(base)
    .map((value) => `+${value}`)
    .join(" / ");
  const params = { base: which, bonus };
  if (!bonus) return [weapon ? t("Weapon ({base})", params) : t("Armor ({base})", params)];
  return [
    weapon
      ? t("Weapon ({base}), {bonus} to attack and damage rolls", params)
      : t("Armor ({base}), {bonus} to Armor Class", params),
  ];
}
