import type { Translator } from "./catalogs.js";
import { abilityNames, skillName } from "./effects.js";
import {
  actionButton,
  checkField,
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
  modifierTargets,
  skills,
  slug,
  spellSchools,
  titleOf,
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
  type SpellFilter,
  type SpellGrant,
  type SpellSchool,
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
type SpellSource = "named" | "pick";
const spellSourceLabels: Readonly<Record<SpellSource, string>> = {
  named: "These spells",
  pick: "The player's choice",
};
type SpellCast = "use" | "atWill" | "cantrip";
const spellCastLabels: Readonly<Record<SpellCast, string>> = {
  use: "With a use",
  atWill: "At will",
  cantrip: "As a cantrip, without a use",
};
type ModifierTarget = Modifier["target"];
const modifierLabels: Readonly<Record<ModifierTarget, string>> = {
  advantage: "Advantage or Disadvantage",
  sense: "Sense range at least",
  senseBonus: "Sense range extended",
  resistance: "Resistance",
  damageImmunity: "Damage immunity",
  conditionImmunity: "Condition immunity",
};
type Rest = GrantResource["recharge"];
const rechargeLabels: Readonly<Record<Rest, string>> = {
  short: "Short Rest",
  long: "Long Rest",
};
/** The default player's choice of spellcasting ability, as the owner decided. */
const mentalAbilities = ["INT", "WIS", "CHA"] as const;

// --- Plain words -------------------------------------------------------------

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
function checked(node: HTMLElement, name: string): boolean {
  return node.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.checked ?? false;
}
/** Ids typed as a comma-separated list. */
function idList(text: string): string[] {
  return text
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");
}

/** One list of rows with an Add button; every row ends with its Remove button. */
function section<T>(
  hooks: Hooks,
  title: string,
  addLabel: string,
  initial: readonly T[],
  render: (node: HTMLElement, entry: T | undefined) => () => T,
  onRowsChanged: () => void = () => {},
  removeLabel: string = hooks.t("Remove"),
): { readonly root: HTMLElement; readonly rows: Row<T>[]; add(entry?: T): void } {
  const { document } = hooks;
  const root = element(document, "div", "hb-grants-section");
  const heading = element(document, "h4", "hb-grants-heading", title);
  const items = element(document, "ol", "hb-effect-list");
  const rows: Row<T>[] = [];
  const add = (entry?: T): void => {
    const node = element(document, "li", "hb-effect-row hb-grant-row");
    node.dataset["uiToolbar"] = "";
    const read = render(node, entry);
    node.append(
      actionButton(document, removeLabel, () => {
        rows.splice(
          rows.findIndex((row) => row.node === node),
          1,
        );
        node.remove();
        onRowsChanged();
        hooks.changed();
        hooks.restructured();
      }),
    );
    rows.push({ node, read });
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

/** Re-renders a row's controls in place, keeping the Remove button once it exists. */
function rerender(node: HTMLElement, controls: readonly HTMLElement[]): void {
  const remove = node.lastElementChild;
  node.replaceChildren(...controls, ...(remove ? [remove] : []));
}

/**
 * The controls of one advantage. Changing the roll calls `redraw`, because the
 * roll decides whether abilities and skills apply.
 */
function advantageFields(hooks: Hooks, entry: Advantage, redraw: () => void): HTMLElement[] {
  const { document, t } = hooks;
  const roll = selectField(
    document,
    t("Roll"),
    "advantage-on",
    entry.on,
    advantageRolls.map((roll) => [roll, t(rollLabels[roll])] as const),
  );
  roll.querySelector("select")!.addEventListener("change", redraw);
  const fields: HTMLElement[] = [
    roll,
    selectField(document, t("Result"), "advantage-mode", entry.mode ?? "advantage", [
      ["advantage", t("Advantage")],
      ["disadvantage", t("Disadvantage")],
    ]),
  ];
  if (entry.on === "save" || entry.on === "check")
    fields.push(
      chipsField(
        document,
        t("Abilities"),
        "advantage-abilities",
        entry.abilities ?? [],
        abilities.map((ability) => [ability, t(abilityNames[ability]!)] as const),
      ),
    );
  if (entry.on === "check")
    fields.push(
      chipsField(
        document,
        t("Skills"),
        "advantage-skills",
        entry.skills ?? [],
        skills.map((skill) => [skill, t(skillName(skill))] as const),
      ),
    );
  fields.push(
    textField(document, t("Only when"), "advantage-when", entry.when ?? "", {
      maxLength: 200,
      placeholder: t("Always"),
    }),
  );
  return fields;
}
/** The advantage a row's controls show; abilities and skills only where they apply. */
function readAdvantage(node: HTMLElement): Advantage {
  const on = value(node, "advantage-on") as AdvantageRoll,
    mode = value(node, "advantage-mode"),
    when = value(node, "advantage-when"),
    chosenAbilities = on === "save" || on === "check" ? selected(node, "advantage-abilities") : [],
    chosenSkills = on === "check" ? selected(node, "advantage-skills") : [];
  return {
    on,
    ...(mode === "disadvantage" ? { mode } : {}),
    ...(chosenAbilities.length > 0 ? { abilities: chosenAbilities as Ability[] } : {}),
    ...(chosenSkills.length > 0 ? { skills: chosenSkills as Skill[] } : {}),
    ...(when ? { when } : {}),
  };
}

function senseOptions(t: Translator, key: string): (readonly [string, string])[] {
  return [
    ...Object.keys(senseLabels).map((sense) => [sense, t(senseLabels[sense]!)] as const),
    ...(senseLabels[key] ? [] : [[key, titleOf(key)] as const]),
  ];
}
/** The controls of one toggle change, after its target. */
function modifierFields(hooks: Hooks, modifier: Modifier, redraw: () => void): HTMLElement[] {
  const { document, t } = hooks;
  switch (modifier.target) {
    case "advantage":
      return advantageFields(hooks, modifier, redraw);
    case "sense":
    case "senseBonus":
      return [
        selectField(
          document,
          t("Sense"),
          "change-sense",
          modifier.key,
          senseOptions(t, modifier.key),
        ),
        numberField(
          document,
          modifier.target === "sense" ? t("Range at least (ft)") : t("Range extended by (ft)"),
          "change-range",
          modifier.target === "sense" ? modifier.value : modifier.add,
          { min: 1, max: 1000 },
        ),
      ];
    case "resistance":
    case "damageImmunity":
      return [
        selectField(
          document,
          t("Damage type"),
          "change-damage",
          modifier.value,
          damageTypes.map((type) => [type, t(damageLabels[type])] as const),
        ),
      ];
    case "conditionImmunity":
      return [
        selectField(
          document,
          t("Condition"),
          "change-condition",
          modifier.value,
          conditionIds.map((id) => [id, t(conditionLabels[id])] as const),
        ),
      ];
  }
}
function readModifier(node: HTMLElement): Modifier {
  const target = value(node, "change-target") as ModifierTarget;
  switch (target) {
    case "advantage":
      return { target, ...readAdvantage(node) };
    case "sense":
      return { target, key: value(node, "change-sense"), value: count(node, "change-range") };
    case "senseBonus":
      return { target, key: value(node, "change-sense"), add: count(node, "change-range") };
    case "resistance":
    case "damageImmunity":
      return { target, value: value(node, "change-damage") as DamageType };
    case "conditionImmunity":
      return { target, value: value(node, "change-condition") as ConditionId };
  }
}
/** A new change of `target`, keeping the sense or damage type it replaces. */
function defaultModifier(target: ModifierTarget, previous?: Modifier): Modifier {
  const key =
    previous?.target === "sense" || previous?.target === "senseBonus" ? previous.key : "darkvision";
  const damage =
    previous?.target === "resistance" || previous?.target === "damageImmunity"
      ? previous.value
      : "fire";
  switch (target) {
    case "advantage":
      return { target, on: "save" };
    case "sense":
      return { target, key, value: 60 };
    case "senseBonus":
      return { target, key, add: 30 };
    case "resistance":
    case "damageImmunity":
      return { target, value: damage };
    case "conditionImmunity":
      return { target, value: "charmed" };
  }
}
function castOf(spell: SpellGrant): Pick<SpellGrant, "atWill" | "resource"> {
  if (spell.atWill) return { atWill: true };
  return spell.resource === undefined ? {} : { resource: spell.resource };
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
    (node, entry) => {
      const draw = (current: Advantage): void =>
        rerender(
          node,
          advantageFields(hooks, current, () => {
            draw(readAdvantage(node));
            changed();
            restructured();
          }),
        );
      draw(entry ?? { on: "save" });
      return () => readAdvantage(node);
    },
  );

  const usesKeys = (): string[] => uses.rows.map((row) => row.read().key);
  // Each spell row cast with a use lists the uses by name; keyed by row.
  const useSelects = new Map<HTMLElement, () => void>();
  const refreshUses = (): void => {
    for (const [node, refresh] of useSelects)
      if (node.parentElement) refresh();
      else useSelects.delete(node);
  };
  const uses = section<GrantResource>(
    hooks,
    t("Limited uses"),
    t("Add use"),
    source.resources ?? [],
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

  const spells = section<SpellGrant>(
    hooks,
    t("Spells"),
    t("Add spell"),
    source.spells ?? [],
    (node, entry) => {
      // The use this row spends survives redraws and renamed uses.
      let resource =
        typeof entry?.resource === "string" ? entry.resource : (entry?.resource?.key ?? "");
      const choiceId = entry?.id;
      let read: () => SpellGrant = () => entry ?? { ids: [] };
      const draw = (current: SpellGrant): void => {
        const named = current.ids !== undefined;
        const cast: SpellCast = current.atWill
          ? "atWill"
          : current.resource !== undefined
            ? "use"
            : "cantrip";
        const redraw = (next: () => SpellGrant) => (): void => {
          draw(next());
          changed();
          restructured();
        };
        const sourceField = selectField(
          document,
          t("Spells"),
          "spell-source",
          named ? "named" : "pick",
          (["named", "pick"] as const).map(
            (value) => [value, t(spellSourceLabels[value])] as const,
          ),
        );
        sourceField.querySelector("select")!.addEventListener(
          "change",
          redraw(() => {
            const previous = read();
            return named
              ? {
                  ...(choiceId !== undefined ? { id: choiceId } : {}),
                  choose: 1,
                  spellLevel: 0,
                  ...castOf(previous),
                }
              : { ids: [...(previous.from?.ids ?? [])], ...castOf(previous) };
          }),
        );
        const fields: HTMLElement[] = [sourceField];
        if (named)
          fields.push(
            textField(document, t("Spell ids"), "spell-ids", (current.ids ?? []).join(", "), {
              maxLength: 1300,
              placeholder: "bless",
              hint: t("Ids from the rules data, separated by commas."),
            }),
          );
        else
          fields.push(
            numberField(document, t("How many"), "spell-choose", current.choose ?? 1, {
              min: 1,
              max: 10,
            }),
            numberField(
              document,
              t("Spell level"),
              "spell-level",
              current.spellLevel ?? current.maxSpellLevel ?? 0,
              { min: 0, max: 9 },
            ),
            checkField(document, t("Or lower"), "spell-lower", current.maxSpellLevel !== undefined),
            textField(
              document,
              t("From class lists"),
              "spell-classes",
              (current.from?.class ?? []).join(", "),
              {
                maxLength: 1300,
                placeholder: t("Any"),
                hint: t("Class ids, separated by commas."),
              },
            ),
            chipsField(
              document,
              t("Schools"),
              "spell-schools",
              current.from?.school ?? [],
              spellSchools.map((school) => [school, t(titleOf(school))] as const),
            ),
            textField(
              document,
              t("Only these spells"),
              "spell-only",
              (current.from?.ids ?? []).join(", "),
              { maxLength: 1300, placeholder: t("Any") },
            ),
            checkField(document, t("Rituals only"), "spell-ritual", current.from?.ritual === true),
          );
        const castField = selectField(
          document,
          t("How it is cast"),
          "spell-cast",
          cast,
          (["use", "atWill", "cantrip"] as const).map(
            (value) => [value, t(spellCastLabels[value])] as const,
          ),
        );
        castField.querySelector("select")!.addEventListener(
          "change",
          redraw(() => {
            if (value(node, "spell-cast") === "use" && uses.rows.length === 0) {
              uses.add();
              refreshUses();
            }
            return read();
          }),
        );
        fields.push(castField);
        useSelects.delete(node);
        if (cast === "use") {
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
          const cost = typeof current.resource === "object" ? (current.resource.cost ?? 1) : 1;
          fields.push(
            field,
            numberField(document, t("Uses per cast"), "spell-cost", cost, { min: 1, max: 100 }),
          );
        }
        rerender(node, fields);
        read = (): SpellGrant => {
          const how = value(node, "spell-cast") as SpellCast,
            cost = count(node, "spell-cost") || 1;
          const castPart: Pick<SpellGrant, "atWill" | "resource"> =
            how === "atWill"
              ? { atWill: true }
              : how === "use"
                ? { resource: cost > 1 ? { key: resource, cost } : resource }
                : {};
          if (named) return { ids: idList(value(node, "spell-ids")), ...castPart };
          const level = count(node, "spell-level"),
            classes = idList(value(node, "spell-classes")),
            schools = selected(node, "spell-schools") as SpellSchool[],
            only = idList(value(node, "spell-only"));
          const from: SpellFilter = {
            ...(classes.length > 0 ? { class: classes } : {}),
            ...(schools.length > 0 ? { school: schools } : {}),
            ...(only.length > 0 ? { ids: only } : {}),
            ...(checked(node, "spell-ritual") ? { ritual: true as const } : {}),
          };
          return {
            ...(choiceId !== undefined ? { id: choiceId } : {}),
            choose: count(node, "spell-choose"),
            ...(checked(node, "spell-lower") ? { maxSpellLevel: level } : { spellLevel: level }),
            ...(Object.keys(from).length > 0 ? { from } : {}),
            ...castPart,
          };
        };
      };
      // A new spell is cast with a use, so offer one right away.
      if (!entry && uses.rows.length === 0) {
        uses.add();
        refreshUses();
      }
      draw(entry ?? { ids: [], resource: "" });
      return () => read();
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

  const toggles = section<Activation>(
    hooks,
    t("Toggles"),
    t("Add toggle"),
    source.activations ?? [],
    (node, entry) => {
      node.classList.add("hb-toggle-row");
      const changes = element(document, "ol", "hb-effect-list hb-toggle-changes");
      const changeRows: Row<Modifier>[] = [];
      const addChange = (modifier: Modifier): void => {
        const row = element(document, "li", "hb-effect-row hb-toggle-change");
        row.dataset["uiToolbar"] = "";
        const draw = (current: Modifier): void => {
          const target = selectField(
            document,
            t("Change"),
            "change-target",
            current.target,
            modifierTargets.map((target) => [target, t(modifierLabels[target])] as const),
          );
          target.querySelector("select")!.addEventListener("change", (event) => {
            draw(
              defaultModifier((event.target as HTMLSelectElement).value as ModifierTarget, current),
            );
            changed();
            restructured();
          });
          row.replaceChildren(
            target,
            ...modifierFields(hooks, current, () => {
              draw(readModifier(row));
              changed();
              restructured();
            }),
            actionButton(document, t("Remove change"), () => {
              changeRows.splice(
                changeRows.findIndex((change) => change.node === row),
                1,
              );
              row.remove();
              changed();
              restructured();
            }),
          );
        };
        draw(modifier);
        changeRows.push({ node: row, read: () => readModifier(row) });
        changes.append(row);
      };
      for (const modifier of entry?.modifiers ?? [defaultModifier("senseBonus")])
        addChange(modifier);
      node.append(
        textField(document, t("Name"), "toggle-name", entry?.name ?? "", {
          maxLength: 120,
          placeholder: t("For example Under open sky."),
        }),
        textField(document, t("Applies when"), "toggle-condition", entry?.condition ?? "", {
          maxLength: 200,
          placeholder: t("Optional"),
        }),
        changes,
        actionButton(document, t("Add change"), () => {
          addChange(defaultModifier("advantage"));
          changed();
          restructured();
        }),
      );
      return () => {
        const condition = value(node, "toggle-condition");
        return {
          id: entry?.id ?? "",
          name: value(node, "toggle-name"),
          ...(condition ? { condition } : {}),
          modifiers: changeRows.map((row) => row.read()),
        };
      };
    },
    undefined,
    t("Remove toggle"),
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
    const id = freeId(spell.spellLevel === 0 ? "cantrip" : "spell-choice", taken);
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
