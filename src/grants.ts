import type { Translator } from "./catalogs.js";
import { abilityNames, skillName } from "./effects.js";
import {
  actionButton,
  chipsField,
  element,
  numberField,
  option,
  selectField,
  textField,
} from "./fields.js";
import {
  abilities,
  advantageRolls,
  conditionIds,
  damageTypes,
  freeId,
  grantFields,
  skills,
  slug,
  type Ability,
  type Activation,
  type Advantage,
  type AdvantageRoll,
  type CastingAbility,
  type ConditionId,
  type DamageType,
  type GrantedCondition,
  type GrantResource,
  type Grants,
  type Modifier,
  type Skill,
  type SpellGrant,
} from "./model.js";

const rollLabels: Readonly<Record<AdvantageRoll, string>> = {
  save: "Saving throws",
  check: "Ability checks",
  attack: "Attack rolls",
  initiative: "Initiative",
  concentration: "Concentration saving throws",
  deathSave: "Death saving throws",
};
const damageLabels: Readonly<Record<DamageType, string>> = {
  acid: "Acid",
  bludgeoning: "Bludgeoning",
  cold: "Cold",
  fire: "Fire",
  force: "Force",
  lightning: "Lightning",
  necrotic: "Necrotic",
  piercing: "Piercing",
  poison: "Poison",
  psychic: "Psychic",
  radiant: "Radiant",
  slashing: "Slashing",
  thunder: "Thunder",
};
const conditionLabels: Readonly<Record<ConditionId, string>> = {
  blinded: "Blinded",
  charmed: "Charmed",
  deafened: "Deafened",
  exhaustion: "Exhaustion",
  frightened: "Frightened",
  grappled: "Grappled",
  incapacitated: "Incapacitated",
  invisible: "Invisible",
  paralyzed: "Paralyzed",
  petrified: "Petrified",
  poisoned: "Poisoned",
  prone: "Prone",
  restrained: "Restrained",
  stunned: "Stunned",
  unconscious: "Unconscious",
};
const senseLabels: Readonly<Record<string, string>> = {
  darkvision: "Darkvision",
  blindsight: "Blindsight",
  tremorsense: "Tremorsense",
  truesight: "Truesight",
};
type SpellKind = "use" | "atWill" | "cantrip" | "pick";
const spellKindLabels: Readonly<Record<SpellKind, string>> = {
  use: "Cast with a use",
  atWill: "Cast at will",
  cantrip: "Cantrip",
  pick: "Player picks a cantrip",
};
type Rest = GrantResource["recharge"];
const rechargeLabels: Readonly<Record<Rest, string>> = {
  short: "Short Rest",
  long: "Long Rest",
};
/** The default player's choice of spellcasting ability, as the owner decided. */
const mentalAbilities = ["INT", "WIS", "CHA"] as const;

// --- Plain words -------------------------------------------------------------

/** A spell or class id as words: cure-wounds reads "Cure Wounds". */
export function titleOf(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
const list = (values: readonly string[]): string => values.join(", ");
const abilityList = (values: readonly string[], t: Translator): string =>
  list(values.map((value) => t(abilityNames[value] ?? value)));
const senseName = (key: string, t: Translator): string =>
  senseLabels[key] ? t(senseLabels[key]) : titleOf(key);

function rollText(entry: Advantage, t: Translator): string {
  const abilityNamesOf = abilityList(entry.abilities ?? [], t);
  switch (entry.on) {
    case "save":
      return abilityNamesOf
        ? t("{abilities} saving throws", { abilities: abilityNamesOf })
        : t("saving throws");
    case "check": {
      const names = [
        ...(entry.abilities ?? []).map((value) => t(abilityNames[value] ?? value)),
        ...(entry.skills ?? []).map((value) => t(skillName(value))),
      ];
      return names.length > 0 ? t("{names} checks", { names: list(names) }) : t("ability checks");
    }
    case "attack":
      return t("attack rolls");
    case "initiative":
      return t("Initiative rolls");
    case "concentration":
      return t("saving throws to maintain Concentration");
    case "deathSave":
      return t("Death Saving Throws");
  }
}
export function describeAdvantage(entry: Advantage, t: Translator): string {
  const roll = rollText(entry, t);
  const text =
    entry.mode === "disadvantage"
      ? t("Disadvantage on {roll}", { roll })
      : t("Advantage on {roll}", { roll });
  return entry.when ? t("{text} ({when})", { text, when: entry.when }) : text;
}
export function describeUse(resource: GrantResource, t: Translator): string {
  const rest = t(rechargeLabels[resource.recharge]);
  return resource.fixed === 1
    ? t("{name}: 1 use per {rest}", { name: resource.name, rest })
    : t("{name}: {count} uses per {rest}", { name: resource.name, count: resource.fixed, rest });
}
function castText(spell: SpellGrant, uses: readonly GrantResource[], t: Translator): string {
  if (spell.atWill) return t("at will");
  if (spell.resource === undefined) return "";
  const key = typeof spell.resource === "string" ? spell.resource : spell.resource.key;
  const cost = typeof spell.resource === "string" ? 1 : (spell.resource.cost ?? 1);
  const use = uses.find((entry) => entry.key === key)?.name ?? key;
  return cost === 1
    ? t("with a use of {use}", { use })
    : t("with {cost} uses of {use}", { cost, use });
}
export function describeSpell(
  spell: SpellGrant,
  uses: readonly GrantResource[],
  t: Translator,
): string {
  const cast = castText(spell, uses, t);
  if (spell.ids) {
    const spells = list(spell.ids.map(titleOf));
    return cast ? `${t("Cast {spells}", { spells })} ${cast}` : t("Learn {spells}", { spells });
  }
  const count = spell.choose ?? 1,
    level = spell.spellLevel ?? spell.maxSpellLevel ?? 0;
  let choice: string;
  if (level === 0)
    choice = count === 1 ? t("Choose a cantrip") : t("Choose {count} cantrips", { count });
  else if (spell.spellLevel !== undefined)
    choice =
      count === 1
        ? t("Choose a level {level} spell", { level })
        : t("Choose {count} level {level} spells", { count, level });
  else
    choice =
      count === 1
        ? t("Choose a spell up to level {level}", { level })
        : t("Choose {count} spells up to level {level}", { count, level });
  const from = spell.from;
  const filter = from
    ? list([
        ...(from.class ?? []).map(titleOf),
        ...(from.school ?? []).map(titleOf),
        ...(from.ids ?? []).map(titleOf),
        ...(from.ritual ? [t("rituals")] : []),
      ])
    : "";
  return [choice, filter ? t("from: {filter}", { filter }) : "", cast]
    .filter((part) => part !== "")
    .join(", ");
}
export function describeCastingAbility(ability: CastingAbility, t: Translator): string {
  return "fixed" in ability
    ? t("Spellcasting ability: {ability}", { ability: t(abilityNames[ability.fixed] ?? "") })
    : t("Spellcasting ability: the player's choice of {abilities}", {
        abilities: abilityList(ability.choose, t),
      });
}
function describeModifier(modifier: Modifier, t: Translator): string {
  switch (modifier.target) {
    case "advantage":
      return describeAdvantage(modifier, t);
    case "sense":
      return t("{sense} at least {range} ft", {
        sense: senseName(modifier.key, t),
        range: modifier.value,
      });
    case "senseBonus":
      return t("{sense} +{range} ft", { sense: senseName(modifier.key, t), range: modifier.add });
    case "resistance":
      return t("Resistance: {types}", { types: t(damageLabels[modifier.value]) });
    case "damageImmunity":
      return t("Damage immunity: {types}", { types: t(damageLabels[modifier.value]) });
    case "conditionImmunity":
      return t("Condition immunity: {conditions}", {
        conditions: t(conditionLabels[modifier.value]),
      });
  }
}
export function describeActivation(activation: Activation, t: Translator): string {
  const name = activation.condition
    ? `${activation.name} (${activation.condition})`
    : activation.name;
  return t("Toggle {name}: {changes}", {
    name,
    changes: activation.modifiers.map((modifier) => describeModifier(modifier, t)).join("; "),
  });
}
export function describeCondition(condition: GrantedCondition, t: Translator): string {
  return t("Condition {name}: one level for each item in effect that gives it", {
    name: condition.name,
  });
}
/** Every grant in plain words, for the editor preview and the gallery. */
export function describeGrants(grants: Grants | undefined, t: Translator): string[] {
  if (!grants) return [];
  const uses = grants.resources ?? [];
  return [
    ...(grants.advantages ?? []).map((entry) => describeAdvantage(entry, t)),
    ...uses.map((entry) => describeUse(entry, t)),
    ...(grants.spells ?? []).map((entry) => describeSpell(entry, uses, t)),
    ...(grants.castingAbility ? [describeCastingAbility(grants.castingAbility, t)] : []),
    ...(grants.activations ?? []).map((entry) => describeActivation(entry, t)),
    ...(grants.resistances
      ? [
          t("Resistance: {types}", {
            types: list(grants.resistances.map((value) => t(damageLabels[value]))),
          }),
        ]
      : []),
    ...(grants.damageImmunities
      ? [
          t("Damage immunity: {types}", {
            types: list(grants.damageImmunities.map((value) => t(damageLabels[value]))),
          }),
        ]
      : []),
    ...(grants.conditionImmunities
      ? [
          t("Condition immunity: {conditions}", {
            conditions: list(grants.conditionImmunities.map((value) => t(conditionLabels[value]))),
          }),
        ]
      : []),
    ...(grants.conditions ?? []).map((entry) => describeCondition(entry, t)),
  ];
}

// --- Editor --------------------------------------------------------------------

export interface GrantsEditor {
  readonly root: HTMLElement;
  /** The rows as entered; validation happens where the item is checked. */
  read(): Grants | undefined;
}
interface Row<T> {
  readonly node: HTMLElement;
  read(): T;
}
interface Hooks {
  readonly document: Document;
  readonly t: Translator;
  readonly changed: () => void;
  readonly restructured: () => void;
}

/** Selected values of a chips field inside a row. */
function selected(node: HTMLElement, name: string): string[] {
  const input = node.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
  return input ? [...input.selectedOptions].map((entry) => entry.value) : [];
}
function value(node: HTMLElement, name: string): string {
  return (
    node.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value.trim() ?? ""
  );
}
function count(node: HTMLElement, name: string): number {
  return Number(value(node, name) || "0");
}

/**
 * One list of rows with an Add button. A row the editor cannot show (an
 * imported shape beyond its controls) stays as a described, removable row,
 * so saving never drops it.
 */
function section<T>(
  hooks: Hooks,
  title: string,
  addLabel: string,
  initial: readonly T[],
  editable: (entry: T) => boolean,
  describe: (entry: T) => string,
  render: (node: HTMLElement, entry: T | undefined) => () => T,
  onRowsChanged: () => void = () => {},
): { readonly root: HTMLElement; readonly rows: Row<T>[]; add(entry?: T): void } {
  const { document, t } = hooks;
  const root = element(document, "div", "hb-grants-section");
  const heading = element(document, "h4", "hb-grants-heading", title);
  const items = element(document, "ol", "hb-effect-list");
  const rows: Row<T>[] = [];
  const remove = (node: HTMLElement): HTMLButtonElement =>
    actionButton(document, t("Remove"), () => {
      rows.splice(
        rows.findIndex((row) => row.node === node),
        1,
      );
      node.remove();
      onRowsChanged();
      hooks.changed();
      hooks.restructured();
    });
  const add = (entry?: T): void => {
    const node = element(document, "li", "hb-effect-row hb-grant-row");
    node.dataset["uiToolbar"] = "";
    let read: () => T;
    if (entry !== undefined && !editable(entry)) {
      node.classList.add("hb-grant-kept");
      node.append(
        element(document, "span", "hb-grant-text", describe(entry)),
        element(document, "small", "hb-hint", t("Kept as imported; edit the file to change it.")),
        remove(node),
      );
      read = () => entry;
    } else {
      read = render(node, entry);
      node.append(remove(node));
    }
    rows.push({ node, read: () => read() });
    items.append(node);
  };
  for (const entry of initial) add(entry);
  root.append(
    heading,
    items,
    actionButton(document, addLabel, () => {
      add();
      onRowsChanged();
      hooks.changed();
      hooks.restructured();
    }),
  );
  return { root, rows, add };
}

/** Re-renders a row's controls in place when a choice changes which controls apply. */
function rerender(node: HTMLElement, controls: () => HTMLElement[]): void {
  const remove = node.lastElementChild;
  node.replaceChildren(...controls(), ...(remove ? [remove] : []));
}

/**
 * Rows for the grants the Engine reads from an item: advantages, uses,
 * spells with a spellcasting ability, toggles, resistances and immunities.
 * `useName` names a use added for a spell, normally after the item.
 */
export function grantsEditor(
  document: Document,
  initial: Grants | undefined,
  t: Translator,
  changed: () => void,
  restructured: () => void,
  useName: () => string,
): GrantsEditor {
  const hooks: Hooks = { document, t, changed, restructured };
  const root = element(document, "div", "hb-grants");
  const source = initial ?? {};

  const advantages = section<Advantage>(
    hooks,
    t("Advantages"),
    t("Add advantage"),
    source.advantages ?? [],
    () => true,
    (entry) => describeAdvantage(entry, t),
    (node, entry) => {
      const state = {
        on: entry?.on ?? ("save" as AdvantageRoll),
        mode: entry?.mode ?? "advantage",
        abilities: [...(entry?.abilities ?? [])] as string[],
        skills: [...(entry?.skills ?? [])] as string[],
        when: entry?.when ?? "",
      };
      const read = (): Advantage => {
        const mode = value(node, "advantage-mode"),
          when = value(node, "advantage-when"),
          chosenAbilities = selected(node, "advantage-abilities"),
          chosenSkills = selected(node, "advantage-skills");
        return {
          on: state.on,
          ...(mode === "disadvantage" ? { mode } : {}),
          ...(chosenAbilities.length > 0 ? { abilities: chosenAbilities as Ability[] } : {}),
          ...(chosenSkills.length > 0 ? { skills: chosenSkills as Skill[] } : {}),
          ...(when ? { when } : {}),
        };
      };
      const controls = (): HTMLElement[] => {
        const roll = selectField(
          document,
          t("Roll"),
          "advantage-on",
          state.on,
          advantageRolls.map((roll) => [roll, t(rollLabels[roll])] as const),
        );
        roll.querySelector("select")!.addEventListener("change", (event) => {
          const current = read();
          state.on = (event.target as HTMLSelectElement).value as AdvantageRoll;
          state.mode = current.mode ?? "advantage";
          state.abilities = [...(current.abilities ?? [])];
          state.skills = [...(current.skills ?? [])];
          state.when = current.when ?? "";
          rerender(node, controls);
          changed();
          restructured();
        });
        const fields: HTMLElement[] = [
          roll,
          selectField(document, t("Result"), "advantage-mode", state.mode, [
            ["advantage", t("Advantage")],
            ["disadvantage", t("Disadvantage")],
          ]),
        ];
        if (state.on === "save" || state.on === "check")
          fields.push(
            chipsField(
              document,
              t("Abilities"),
              "advantage-abilities",
              state.abilities,
              abilities.map((ability) => [ability, t(abilityNames[ability]!)] as const),
            ),
          );
        if (state.on === "check")
          fields.push(
            chipsField(
              document,
              t("Skills"),
              "advantage-skills",
              state.skills,
              skills.map((skill) => [skill, t(skillName(skill))] as const),
            ),
          );
        fields.push(
          textField(document, t("Only when"), "advantage-when", state.when, {
            maxLength: 200,
            placeholder: t("Always"),
          }),
        );
        return fields;
      };
      node.append(...controls());
      return read;
    },
  );

  const usesKeys = (): string[] => uses.rows.map((row) => row.read().key);
  // Each spell row cast with a use lists the uses by name; keyed by row.
  const useSelects = new Map<HTMLElement, () => void>();
  const refreshUses = (): void => {
    for (const [node, refresh] of useSelects)
      if (spells.rows.some((row) => row.node === node)) refresh();
      else useSelects.delete(node);
  };
  const uses = section<GrantResource>(
    hooks,
    t("Limited uses"),
    t("Add use"),
    source.resources ?? [],
    () => true,
    (entry) => describeUse(entry, t),
    (node, entry) => {
      const key = entry?.key ?? freeId("uses", new Set(usesKeys()));
      node.append(
        textField(document, t("Name"), "use-name", entry?.name ?? useName(), { maxLength: 120 }),
        numberField(document, t("Uses"), "use-count", entry?.fixed ?? 1, { min: 1, max: 100 }),
        selectField(
          document,
          t("Comes back after"),
          "use-recharge",
          entry?.recharge ?? "long",
          (["short", "long"] as const).map((rest) => [rest, t(rechargeLabels[rest])] as const),
        ),
      );
      node.querySelector('[name="use-name"]')!.addEventListener("input", refreshUses);
      return () => ({
        key,
        name: value(node, "use-name"),
        fixed: count(node, "use-count"),
        recharge: value(node, "use-recharge") === "short" ? "short" : "long",
      });
    },
    refreshUses,
  );

  const representableSpell = (spell: SpellGrant): boolean =>
    spell.ids !== undefined
      ? spell.resource === undefined || typeof spell.resource === "string"
      : Object.keys(spell).every((field) => ["id", "choose", "spellLevel"].includes(field)) &&
        spell.spellLevel === 0;
  const spells = section<SpellGrant>(
    hooks,
    t("Spells"),
    t("Add spell"),
    source.spells ?? [],
    representableSpell,
    (entry) => describeSpell(entry, source.resources ?? [], t),
    (node, entry) => {
      let kind: SpellKind = !entry
        ? "use"
        : entry.ids === undefined
          ? "pick"
          : entry.atWill
            ? "atWill"
            : entry.resource !== undefined
              ? "use"
              : "cantrip";
      let ids = (entry?.ids ?? []).join(", "),
        choose = entry?.choose ?? 1,
        resource = typeof entry?.resource === "string" ? entry.resource : "";
      const controls = (): HTMLElement[] => {
        const kindField = selectField(
          document,
          t("How it is cast"),
          "spell-kind",
          kind,
          (["use", "atWill", "cantrip", "pick"] as const).map(
            (value) => [value, t(spellKindLabels[value])] as const,
          ),
        );
        kindField.querySelector("select")!.addEventListener("change", (event) => {
          if (kind === "pick") choose = count(node, "spell-choose") || 1;
          else ids = value(node, "spell-ids");
          kind = (event.target as HTMLSelectElement).value as SpellKind;
          if (kind === "use" && uses.rows.length === 0) {
            uses.add();
            refreshUses();
          }
          rerender(node, controls);
          changed();
          restructured();
        });
        const fields: HTMLElement[] = [kindField];
        if (kind === "pick")
          fields.push(
            numberField(document, t("Cantrips"), "spell-choose", choose, { min: 1, max: 10 }),
          );
        else
          fields.push(
            textField(document, t("Spell ids"), "spell-ids", ids, {
              maxLength: 1300,
              placeholder: "bless",
              hint: t("Ids from the rules data, separated by commas."),
            }),
          );
        useSelects.delete(node);
        if (kind === "use") {
          const field = selectField(document, t("Use"), "spell-use", resource, []);
          const input = field.querySelector("select")!;
          input.addEventListener("change", () => (resource = input.value));
          const refresh = (): void => {
            const options = uses.rows.map((row) => {
              const use = row.read();
              return [use.key, use.name || use.key] as const;
            });
            if (!options.some(([key]) => key === resource)) resource = options[0]?.[0] ?? "";
            input.replaceChildren(
              ...(options.length > 0 ? options : [["", t("Add a use first")] as const]).map(
                ([key, label]) => {
                  const entry = option(document, key, label);
                  entry.selected = key === resource;
                  return entry;
                },
              ),
            );
          };
          refresh();
          useSelects.set(node, refresh);
          fields.push(field);
        }
        return fields;
      };
      node.append(...controls());
      return (): SpellGrant => {
        if (kind === "pick")
          return {
            ...(entry?.id !== undefined ? { id: entry.id } : {}),
            choose: count(node, "spell-choose"),
            spellLevel: 0,
          };
        const named = value(node, "spell-ids")
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id !== "");
        if (kind === "atWill") return { ids: named, atWill: true };
        if (kind === "use") return { ids: named, resource };
        return { ids: named };
      };
    },
    () => {
      casting.hidden = spells.rows.length === 0;
    },
  );

  const original = source.castingAbility;
  const playerChoiceId =
    original && "choose" in original && sameAbilities(original.choose, mentalAbilities)
      ? original.id
      : "casting";
  const castingValue =
    original === undefined
      ? "choose"
      : "fixed" in original
        ? original.fixed
        : sameAbilities(original.choose, mentalAbilities)
          ? "choose"
          : "imported";
  const casting = element(document, "div", "hb-grants-casting");
  casting.append(
    selectField(document, t("Spellcasting ability"), "casting-ability", castingValue, [
      ["choose", t("The player picks Intelligence, Wisdom or Charisma")],
      ...abilities.map((ability) => [ability, t(abilityNames[ability]!)] as const),
      ...(castingValue === "imported" && original
        ? [["imported", describeCastingAbility(original, t)] as const]
        : []),
    ]),
  );
  casting.hidden = spells.rows.length === 0;
  spells.root.insertBefore(casting, spells.root.lastElementChild);

  const representableToggle = (activation: Activation): boolean => {
    const senses = activation.modifiers.filter(
      (modifier) => modifier.target === "sense" || modifier.target === "senseBonus",
    );
    const keys = new Set(senses.map((modifier) => ("key" in modifier ? modifier.key : "")));
    const targets = senses.map((modifier) => modifier.target);
    return (
      senses.length === activation.modifiers.length &&
      senses.length > 0 &&
      keys.size === 1 &&
      new Set(targets).size === targets.length
    );
  };
  const toggles = section<Activation>(
    hooks,
    t("Toggles"),
    t("Add toggle"),
    source.activations ?? [],
    representableToggle,
    (entry) => describeActivation(entry, t),
    (node, entry) => {
      const minimum = entry?.modifiers.find((modifier) => modifier.target === "sense"),
        bonus = entry?.modifiers.find((modifier) => modifier.target === "senseBonus");
      const key =
        (minimum && "key" in minimum ? minimum.key : undefined) ??
        (bonus && "key" in bonus ? bonus.key : undefined) ??
        "darkvision";
      node.append(
        textField(document, t("Name"), "toggle-name", entry?.name ?? "", {
          maxLength: 120,
          placeholder: t("For example Under open sky."),
        }),
        textField(document, t("Applies when"), "toggle-condition", entry?.condition ?? "", {
          maxLength: 200,
          placeholder: t("Optional"),
        }),
        selectField(document, t("Sense"), "toggle-sense", key, [
          ...Object.keys(senseLabels).map((sense) => [sense, t(senseLabels[sense]!)] as const),
          ...(senseLabels[key] ? [] : [[key, titleOf(key)] as const]),
        ]),
        numberField(
          document,
          t("Range at least (ft)"),
          "toggle-minimum",
          minimum?.target === "sense" ? minimum.value : 0,
          { min: 0, max: 1000 },
        ),
        numberField(
          document,
          t("Range extended by (ft)"),
          "toggle-bonus",
          bonus?.target === "senseBonus" ? bonus.add : 0,
          { min: 0, max: 1000 },
        ),
      );
      return () => {
        const name = value(node, "toggle-name"),
          condition = value(node, "toggle-condition"),
          sense = value(node, "toggle-sense"),
          floor = count(node, "toggle-minimum"),
          extension = count(node, "toggle-bonus");
        return {
          id: entry?.id ?? "",
          name,
          ...(condition ? { condition } : {}),
          modifiers: [
            ...(extension !== 0
              ? [{ target: "senseBonus" as const, key: sense, add: extension }]
              : []),
            ...(floor !== 0 ? [{ target: "sense" as const, key: sense, value: floor }] : []),
          ],
        };
      };
    },
  );

  const passive = element(document, "div", "hb-grants-section");
  passive.append(
    element(document, "h4", "hb-grants-heading", t("Resistances and immunities")),
    chipsField(
      document,
      t("Resistances"),
      "grant-resistances",
      source.resistances ?? [],
      damageTypes.map((type) => [type, t(damageLabels[type])] as const),
    ),
    chipsField(
      document,
      t("Damage immunities"),
      "grant-damage-immunities",
      source.damageImmunities ?? [],
      damageTypes.map((type) => [type, t(damageLabels[type])] as const),
    ),
    chipsField(
      document,
      t("Condition immunities"),
      "grant-condition-immunities",
      source.conditionImmunities ?? [],
      conditionIds.map((id) => [id, t(conditionLabels[id])] as const),
    ),
  );

  root.append(advantages.root, uses.root, spells.root, toggles.root, passive);
  return {
    root,
    read(): Grants | undefined {
      const spellRows = withChoiceIds(spells.rows.map((row) => row.read()));
      const choice = value(casting, "casting-ability");
      const castingAbility: CastingAbility | undefined =
        spellRows.length === 0
          ? undefined
          : choice === "imported" && original
            ? original
            : choice === "choose"
              ? { id: playerChoiceId, choose: [...mentalAbilities] }
              : { fixed: choice as Ability };
      const fields: Record<string, unknown> = {
        advantages: advantages.rows.map((row) => row.read()),
        castingAbility,
        resources: uses.rows.map((row) => row.read()),
        spells: spellRows,
        activations: withToggleIds(toggles.rows.map((row) => row.read())),
        resistances: selected(passive, "grant-resistances"),
        damageImmunities: selected(passive, "grant-damage-immunities"),
        conditionImmunities: selected(passive, "grant-condition-immunities"),
      };
      const kept = grantFields.filter(
        (field) =>
          fields[field] !== undefined &&
          !(Array.isArray(fields[field]) && (fields[field] as unknown[]).length === 0),
      );
      return kept.length > 0
        ? (Object.fromEntries(kept.map((field) => [field, fields[field]])) as Grants)
        : undefined;
    },
  };
}

function sameAbilities(values: readonly string[], expected: readonly string[]): boolean {
  return values.length === expected.length && expected.every((value) => values.includes(value));
}
/**
 * New rows get ids here, once every saved id is known. Characters store these
 * ids (spell picks, toggle state), so a saved id never changes.
 */
function withChoiceIds(spells: SpellGrant[]): SpellGrant[] {
  const taken = new Set(spells.flatMap((spell) => (spell.id === undefined ? [] : [spell.id])));
  return spells.map((spell) => {
    if (spell.ids !== undefined || spell.id !== undefined) return spell;
    const id = freeId("cantrip", taken);
    taken.add(id);
    return { id, ...spell };
  });
}
function withToggleIds(activations: Activation[]): Activation[] {
  const taken = new Set(activations.map((activation) => activation.id).filter(Boolean));
  return activations.map((activation) => {
    if (activation.id) return activation;
    const id = freeId(slug(activation.name || "toggle"), taken);
    taken.add(id);
    return { ...activation, id };
  });
}
