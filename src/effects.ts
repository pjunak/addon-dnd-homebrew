import type { Translator } from "./catalogs.js";
import { actionButton, element, numberField, selectField, textField } from "./fields.js";
import {
  abilities,
  abilityTargets,
  effectTargets,
  keyedTargets,
  modes,
  skills,
  type Effect,
  type EffectMode,
  type EffectTarget,
} from "./model.js";

const targetLabels: Readonly<Record<EffectTarget, string>> = {
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
};
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
export function skillName(skill: string): string {
  if (skill === "sleightOfHand") return "Sleight of Hand";
  if (skill === "animalHandling") return "Animal Handling";
  return skill.charAt(0).toUpperCase() + skill.slice(1);
}
const isAbilityTarget = (target: string): boolean =>
  (abilityTargets as readonly string[]).includes(target);
const isKeyedTarget = (target: string): boolean =>
  (keyedTargets as readonly string[]).includes(target);

/** One effect in plain words, for lists, previews and the gallery. */
export function describeEffect(effect: Effect, t: Translator): string {
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
 * controls after rows are added, removed or retargeted.
 */
export function effectsEditor(
  document: Document,
  initial: readonly Effect[],
  t: Translator,
  changed: () => void,
  restructured: () => void,
): EffectsEditor {
  const root = element(document, "div", "hb-effects");
  const list = element(document, "ol", "hb-effect-list");
  const rows: { node: HTMLElement; read: () => Effect }[] = [];
  const addRow = (effect: Effect): void => {
    const node = element(document, "li", "hb-effect-row");
    node.dataset["uiToolbar"] = "";
    let current: Effect = effect;
    const render = (): void => {
      node.replaceChildren();
      const target = selectField(
        document,
        t("Target"),
        "effect-target",
        current.target,
        effectTargets.map((value) => [value, t(targetLabels[value])] as const),
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
      if (current.target !== "proficiency") {
        node.append(
          selectField(
            document,
            t("Mode"),
            "effect-mode",
            current.mode,
            modes.map((value) => [value, t(modeLabels[value])] as const),
          ),
          numberField(document, t("Value"), "effect-value", current.value),
        );
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
          const value = (event.target as HTMLSelectElement).value as EffectTarget;
          current = defaultEffect(value, current);
          render();
          changed();
          restructured();
        });
    };
    const read = (): Effect => {
      const key =
        node
          .querySelector<HTMLInputElement | HTMLSelectElement>('[name="effect-key"]')
          ?.value.trim() ?? "";
      if (current.target === "proficiency")
        return { target: "proficiency", key, mode: "set", value: 1 };
      const mode = (node.querySelector<HTMLSelectElement>('[name="effect-mode"]')?.value ??
        "add") as EffectMode;
      const value = Number(
        node.querySelector<HTMLInputElement>('[name="effect-value"]')?.value ?? "0",
      );
      return { target: current.target, ...(key ? { key } : {}), mode, value };
    };
    render();
    rows.push({ node, read });
    list.append(node);
  };
  for (const effect of initial) addRow(effect);
  root.append(list);
  const button = actionButton(document, t("Add bonus or proficiency"), () => {
    addRow({ target: "armorClass", mode: "add", value: 1 });
    changed();
    restructured();
  });
  return { root, button, read: () => rows.map((row) => row.read()) };
}

function defaultEffect(target: EffectTarget, previous: Effect): Effect {
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
  return { target, mode, value };
}
