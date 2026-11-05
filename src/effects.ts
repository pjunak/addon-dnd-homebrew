import type { Translator } from "./catalogs.js";
import { actionButton, element, numberField, selectField, textField } from "./fields.js";
import {
  abilities,
  abilityTargets,
  classTargets,
  effectTargets,
  keyedTargets,
  modes,
  skillName,
  skills,
  titleOf,
  type Effect,
  type EffectMode,
  type EffectTarget,
} from "./model.js";
import type { RuleOption } from "./references.js";

/**
 * Editor-only: one row for a focus-like bonus, stored as a spell attack and a
 * spell save DC effect so published records stay in the Engine's vocabulary.
 */
const bothTarget = "spellcasting";
type RowTarget = EffectTarget | typeof bothTarget;
interface RowState {
  readonly target: RowTarget;
  readonly key?: string;
  readonly mode: EffectMode;
  readonly value: number;
}

const targetLabels: Readonly<Record<RowTarget, string>> = {
  abilityScore: "Ability score",
  abilityCap: "Ability score maximum",
  savingThrow: "Saving throw bonus",
  armorClass: "Armor Class",
  initiative: "Initiative",
  speed: "Speed (ft)",
  maxHp: "Hit Point maximum",
  attunementLimit: "Attunement slots",
  proficiency: "Proficiency",
  sense: "Sense range (ft)",
  resourceMax: "Resource uses",
  [bothTarget]: "Spell attack bonus and save DC",
  spellAttack: "Spell attack bonus",
  spellSaveDC: "Spell save DC",
};
/** The combined spellcasting row is offered before its two single halves. */
const rowTargets: readonly RowTarget[] = effectTargets.flatMap((target) =>
  target === "spellAttack" ? [bothTarget, target] : [target],
);
const modeLabels: Readonly<Record<EffectMode, string>> = {
  add: "Add",
  set: "Set to",
  minimum: "At least",
  maximum: "At most",
};
export const abilityNames: Readonly<Record<string, string>> = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};
export { skillName };
const isAbilityTarget = (target: string): boolean =>
  (abilityTargets as readonly string[]).includes(target);
const isKeyedTarget = (target: string): boolean =>
  (keyedTargets as readonly string[]).includes(target);
const isClassTarget = (target: string): boolean =>
  (classTargets as readonly string[]).includes(target);

/** One effect in plain words, for lists, previews and the gallery. */
function describeEffect(effect: Effect, t: Translator): string {
  const key = effect.key ?? "";
  if (effect.target === "proficiency") {
    const name = abilityNames[key]
      ? t("{ability} saving throws", { ability: t(abilityNames[key]) })
      : t(skillName(key));
    return t("Proficiency: {name}", { name });
  }
  let label: string;
  if (effect.target === "abilityScore")
    label = t("{ability} score", { ability: t(abilityNames[key] ?? key) });
  else if (effect.target === "abilityCap")
    label = t("{ability} maximum", { ability: t(abilityNames[key] ?? key) });
  else if (effect.target === "savingThrow")
    label = t("{ability} saving throws", { ability: t(abilityNames[key] ?? key) });
  else if (effect.target === "sense") label = key.charAt(0).toUpperCase() + key.slice(1);
  else if (effect.target === "resourceMax") label = t("Uses of {name}", { name: key });
  else if (effect.target === "spellAttack" && key)
    label = t("{class} spell attack bonus", { class: titleOf(key) });
  else if (effect.target === "spellSaveDC" && key)
    label = t("{class} spell save DC", { class: titleOf(key) });
  else label = t(targetLabels[effect.target]);
  const value = effect.value;
  switch (effect.mode) {
    case "add":
      return t("{label} {value}", { label, value: value >= 0 ? `+${value}` : `−${-value}` });
    case "set":
      return t("{label} = {value}", { label, value });
    case "minimum":
      return t("{label} at least {value}", { label, value });
    case "maximum":
      return t("{label} at most {value}", { label, value });
  }
}

/**
 * The editor's rows: a spell attack and a save DC bonus with one class, mode
 * "add" and one value pair up into a single combined row.
 */
function pairRows(effects: readonly Effect[]): RowState[] {
  const rows: RowState[] = [];
  const used = new Set<number>();
  effects.forEach((effect, index) => {
    if (used.has(index)) return;
    if (isClassTarget(effect.target) && effect.mode === "add") {
      const other = effect.target === "spellAttack" ? "spellSaveDC" : "spellAttack";
      const partner = effects.findIndex(
        (candidate, at) =>
          at > index &&
          !used.has(at) &&
          candidate.target === other &&
          candidate.mode === "add" &&
          (candidate.key ?? "") === (effect.key ?? "") &&
          candidate.value === effect.value,
      );
      if (partner !== -1) {
        used.add(partner);
        rows.push({
          target: bothTarget,
          ...(effect.key ? { key: effect.key } : {}),
          mode: "add",
          value: effect.value,
        });
        return;
      }
    }
    rows.push(effect);
  });
  return rows;
}

/** Every effect in plain words; a spell attack and save DC pair reads as one line. */
export function describeEffects(effects: readonly Effect[], t: Translator): string[] {
  return pairRows(effects).map((row) => {
    if (row.target !== bothTarget) return describeEffect(row as Effect, t);
    const label = row.key
      ? t("{class} spell attack bonus and save DC", { class: titleOf(row.key) })
      : t(targetLabels[bothTarget]);
    const value = row.value >= 0 ? `+${row.value}` : `−${-row.value}`;
    return t("{label} {value}", { label, value });
  });
}

export interface EffectsEditor {
  readonly root: HTMLElement;
  /** The button that adds a row, for the owner to place. */
  readonly button: HTMLButtonElement;
  /** The rows as entered; validation happens where the item is checked. */
  read(): Effect[];
}

/**
 * Structured effect rows: the target decides which key control appears, and a
 * proficiency locks its mode and value to the only form the Engine accepts.
 * `changed` reports edits; `restructured` asks the owner to refresh enhanced
 * controls after rows are added, removed or retargeted. `classes`, from the
 * installed rules data, turns a spellcasting effect's class into a choice.
 */
export function effectsEditor(
  document: Document,
  initial: readonly Effect[],
  t: Translator,
  changed: () => void,
  restructured: () => void,
  classes?: readonly RuleOption[],
): EffectsEditor {
  const root = element(document, "div", "hb-effects");
  const list = element(document, "ol", "hb-effect-list");
  const rows: { node: HTMLElement; read: () => Effect[] }[] = [];
  const addRow = (effect: RowState): void => {
    const node = element(document, "li", "hb-effect-row");
    node.dataset["uiToolbar"] = "";
    let current: RowState = effect;
    const render = (): void => {
      node.replaceChildren();
      const target = selectField(
        document,
        t("Target"),
        "effect-target",
        current.target,
        rowTargets.map((value) => [value, t(targetLabels[value])] as const),
      );
      node.append(target);
      if (isAbilityTarget(current.target))
        node.append(
          selectField(
            document,
            t("Key"),
            "effect-key",
            current.key ?? "STR",
            abilities.map((value) => [value, t(abilityNames[value]!)] as const),
          ),
        );
      else if (current.target === "proficiency")
        node.append(
          selectField(document, t("Key"), "effect-key", current.key ?? "insight", [
            ...skills.map((value) => [value, t(skillName(value))] as const),
            ...abilities.map(
              (value) =>
                [
                  value,
                  t("{ability} saving throws", { ability: t(abilityNames[value]!) }),
                ] as const,
            ),
          ]),
        );
      else if (isKeyedTarget(current.target))
        node.append(
          textField(document, t("Sense or resource"), "effect-key", current.key ?? "", {
            maxLength: 60,
            placeholder: t("For example darkvision."),
          }),
        );
      else if (isClassTarget(current.target) || current.target === bothTarget)
        node.append(classKeyField(document, t, current.key ?? "", classes));
      if (current.target !== "proficiency") {
        // The combined spellcasting bonus is always added, so it has no mode.
        if (current.target !== bothTarget)
          node.append(
            selectField(
              document,
              t("Mode"),
              "effect-mode",
              current.mode,
              modes.map((value) => [value, t(modeLabels[value])] as const),
            ),
          );
        node.append(numberField(document, t("Value"), "effect-value", current.value));
      }
      node.append(
        actionButton(document, t("Remove effect"), () => {
          rows.splice(
            rows.findIndex((row) => row.node === node),
            1,
          );
          node.remove();
          changed();
          restructured();
        }),
      );
      node
        .querySelector<HTMLSelectElement>('select[name="effect-target"]')!
        .addEventListener("change", (event) => {
          const value = (event.target as HTMLSelectElement).value as RowTarget;
          current = defaultEffect(value, current);
          render();
          changed();
          restructured();
        });
    };
    const read = (): Effect[] => {
      const key =
        node
          .querySelector<HTMLInputElement | HTMLSelectElement>('[name="effect-key"]')
          ?.value.trim() ?? "";
      if (current.target === "proficiency")
        return [{ target: "proficiency", key, mode: "set", value: 1 }];
      const value = Number(
        node.querySelector<HTMLInputElement>('[name="effect-value"]')?.value ?? "0",
      );
      if (current.target === bothTarget)
        return (["spellAttack", "spellSaveDC"] as const).map((target) => ({
          target,
          ...(key ? { key } : {}),
          mode: "add",
          value,
        }));
      const mode = (node.querySelector<HTMLSelectElement>('[name="effect-mode"]')?.value ??
        "add") as EffectMode;
      return [{ target: current.target, ...(key ? { key } : {}), mode, value }];
    };
    render();
    rows.push({ node, read });
    list.append(node);
  };
  for (const row of pairRows(initial)) addRow(row);
  root.append(list);
  const button = actionButton(document, t("Add bonus or proficiency"), () => {
    addRow({ target: "armorClass", mode: "add", value: 1 });
    changed();
    restructured();
  });
  return { root, button, read: () => rows.flatMap((row) => row.read()) };
}

/** A spellcasting effect's class: a choice from the rules data, else an id. */
function classKeyField(
  document: Document,
  t: Translator,
  key: string,
  classes: readonly RuleOption[] | undefined,
): HTMLElement {
  if (!classes?.length)
    return textField(document, t("Class"), "effect-key", key, {
      maxLength: 64,
      placeholder: "wizard",
      hint: t("A class id such as wizard; empty for every class."),
    });
  const options = classes.map((entry) => [entry.id, entry.name] as const);
  // A saved class the rules data no longer lists stays selectable.
  if (key && !classes.some((entry) => entry.id === key)) options.push([key, titleOf(key)]);
  return selectField(document, t("Class"), "effect-key", key, [["", t("Every class")], ...options]);
}

function defaultEffect(target: RowTarget, previous: RowState): RowState {
  if (target === "proficiency") return { target, key: "insight", mode: "set", value: 1 };
  const mode = previous.target === "proficiency" ? "add" : previous.mode;
  const value = previous.target === "proficiency" ? 1 : previous.value;
  if (isAbilityTarget(target))
    return {
      target,
      key: abilities.includes(previous.key as never) ? previous.key! : "STR",
      mode,
      value,
    };
  if (isKeyedTarget(target))
    return { target, key: target === "sense" ? "darkvision" : "", mode, value };
  if (target === bothTarget || isClassTarget(target)) {
    // Moving between the spellcasting targets keeps the chosen class.
    const kept = previous.target === bothTarget || isClassTarget(previous.target);
    return {
      target,
      ...(kept && previous.key ? { key: previous.key } : {}),
      mode: target === bothTarget ? "add" : mode,
      value,
    };
  }
  return { target, mode, value };
}
