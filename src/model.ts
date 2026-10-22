// Stored shapes and rules for item sets, item drafts and published records.
// internal/homebrew (Go) enforces the same rules for imports and serving; the
// shared fixtures in tests/fixtures keep the two in step.

export const abilities = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
export const skills = [
  "acrobatics",
  "animalHandling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleightOfHand",
  "stealth",
  "survival",
] as const;
export const rarities = [
  "Common",
  "Uncommon",
  "Rare",
  "Very Rare",
  "Legendary",
  "Artifact",
  "Rarity Varies",
] as const;
export const bodyPlacements = [
  "head",
  "body",
  "wrists",
  "legs",
  "feet",
  "face",
  "neck",
  "shoulders",
  "waist",
  "gloves",
  "other",
] as const;
export const modes = ["set", "add", "minimum", "maximum"] as const;
export const abilityTargets = ["abilityScore", "abilityCap", "savingThrow"] as const;
export const plainTargets = [
  "armorClass",
  "initiative",
  "speed",
  "maxHp",
  "attunementLimit",
] as const;
export const keyedTargets = ["sense", "resourceMax"] as const;
export const effectTargets = [
  ...abilityTargets,
  ...plainTargets,
  "proficiency",
  ...keyedTargets,
] as const;

export const advantageRolls = [
  "save",
  "check",
  "attack",
  "initiative",
  "concentration",
  "deathSave",
] as const;
export const damageTypes = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
] as const;
export const conditionIds = [
  "blinded",
  "charmed",
  "deafened",
  "exhaustion",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
] as const;
export const spellSchools = [
  "abjuration",
  "conjuration",
  "divination",
  "enchantment",
  "evocation",
  "illusion",
  "necromancy",
  "transmutation",
] as const;
export const modifierTargets = [
  "advantage",
  "sense",
  "senseBonus",
  "resistance",
  "conditionImmunity",
  "damageImmunity",
] as const;
/** Every grants field, in the order a published record lists them. */
export const grantFields = [
  "advantages",
  "castingAbility",
  "resources",
  "spells",
  "activations",
  "resistances",
  "damageImmunities",
  "conditionImmunities",
  "conditions",
] as const;

export type EffectTarget = (typeof effectTargets)[number];
export type EffectMode = (typeof modes)[number];
export type Ability = (typeof abilities)[number];
export type Skill = (typeof skills)[number];
export type AdvantageRoll = (typeof advantageRolls)[number];
export type DamageType = (typeof damageTypes)[number];
export type ConditionId = (typeof conditionIds)[number];
export type SpellSchool = (typeof spellSchools)[number];
export type Rarity = (typeof rarities)[number];
export type BodyPlacement = (typeof bodyPlacements)[number];
export type Mechanics = "complete" | "narrative";

export const collections = {
  sets: "homebrew_sets",
  items: "homebrew_items",
  published: "homebrew_published",
  meta: "homebrew_meta",
} as const;
export const metaKey = "publish";
export const idPrefix = "hb.";
export const maxMarkdown = 20000;
export const maxEffects = 40;
export const maxConditionSummary = 2000;
export const maxWeight = 100000;
export const baseItemKinds = ["weapon", "armor"] as const;
export const weaponCategories = ["simple", "martial"] as const;
export const weaponRanges = ["melee", "ranged"] as const;
export const armorTypes = ["light", "medium", "heavy", "shield"] as const;
/** The weapon properties the rules data uses; a base filter may also name others. */
export const weaponProperties = [
  "ammunition",
  "finesse",
  "heavy",
  "light",
  "loading",
  "reach",
  "thrown",
  "two-handed",
  "versatile",
] as const;
export const maxBaseIds = 20;
export const maxBonus = 5;
export const importFormat = "dnd-homebrew";

export interface Effect {
  readonly target: EffectTarget;
  readonly key?: string;
  readonly mode: EffectMode;
  readonly value: number;
}
export interface Advantage {
  readonly on: AdvantageRoll;
  readonly mode?: "advantage" | "disadvantage";
  readonly abilities?: readonly Ability[];
  readonly skills?: readonly Skill[];
  /** A situation; the sheet lists the entry without marking rolls. */
  readonly when?: string;
}
export type CastingAbility =
  { readonly fixed: Ability } | { readonly id: string; readonly choose: readonly Ability[] };
/** A limited use the item owns; its spent count belongs to the item. */
export interface GrantResource {
  readonly key: string;
  readonly name: string;
  readonly fixed: number;
  readonly recharge: "short" | "long";
}
export type SpellResource = string | { readonly key: string; readonly cost?: number };
export interface SpellFilter {
  readonly class?: readonly string[];
  readonly school?: readonly SpellSchool[];
  readonly ids?: readonly string[];
  readonly ritual?: true;
}
/** Named spells (`ids`) or a player's pick (`id` + `choose`); never a spell slot. */
export interface SpellGrant {
  readonly ids?: readonly string[];
  readonly id?: string;
  readonly choose?: number;
  readonly spellLevel?: number;
  readonly maxSpellLevel?: number;
  readonly from?: SpellFilter;
  readonly resource?: SpellResource;
  readonly atWill?: true;
}
export type Modifier =
  | ({ readonly target: "advantage" } & Advantage)
  | { readonly target: "sense"; readonly key: string; readonly value: number }
  | { readonly target: "senseBonus"; readonly key: string; readonly add: number }
  | { readonly target: "resistance" | "damageImmunity"; readonly value: DamageType }
  | { readonly target: "conditionImmunity"; readonly value: ConditionId };
/** A toggle the player switches on the sheet. */
export interface Activation {
  readonly id: string;
  readonly name: string;
  readonly condition?: string;
  readonly modifiers: readonly Modifier[];
}
/** A level-counted condition: one level per item in effect that gives it. */
export interface GrantedCondition {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
}
/** The Engine's item grants allowlist; drafts never declare `conditions`. */
export interface Grants {
  readonly advantages?: readonly Advantage[];
  readonly castingAbility?: CastingAbility;
  readonly resources?: readonly GrantResource[];
  readonly spells?: readonly SpellGrant[];
  readonly activations?: readonly Activation[];
  readonly resistances?: readonly DamageType[];
  readonly damageImmunities?: readonly DamageType[];
  readonly conditionImmunities?: readonly ConditionId[];
  readonly conditions?: readonly GrantedCondition[];
}
export interface ItemSet {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly name: string;
  readonly description: string;
  readonly curse: string;
  readonly itemType: string;
  readonly rarity: Rarity;
  readonly attunement: boolean;
  readonly bodyPlacements: readonly BodyPlacement[];
  readonly tags: readonly string[];
  readonly namePrefix: string;
  readonly playerVisible: boolean;
  readonly updatedAt: number;
  /** Given by every item of the set. */
  readonly condition?: GrantedCondition;
  /** Each item's weight in pounds unless the item overrides it. */
  readonly weightLb?: number;
}
export interface Overrides {
  readonly itemType?: string;
  readonly rarity?: Rarity;
  readonly attunement?: boolean;
  readonly bodyPlacements?: readonly BodyPlacement[];
  readonly weightLb?: number;
}
/** What an item holds: a capacity in pounds and/or contents that weigh nothing. */
export interface Container {
  readonly capacityLb?: number;
  readonly weightless?: true;
}
/** One class at a minimum level, as the Engine's prerequisites name it. */
export type ClassLevel = Readonly<Record<string, number>>;
/** Who may attune: the subset of the Engine's prerequisites the Compendium uses. */
export type AttunementRequirement =
  | { readonly spellcaster: true }
  | { readonly classes: ClassLevel }
  | { readonly any: readonly { readonly classes: ClassLevel }[] }
  | { readonly text: string };
/**
 * The weapon or armor a magic item is: fixed base record ids, or filters over
 * every record of its kind, and a bonus (a list lets the player pick).
 */
export interface BaseItem {
  readonly kind: (typeof baseItemKinds)[number];
  readonly ids?: readonly string[];
  readonly categories?: readonly (typeof weaponCategories)[number][];
  readonly ranges?: readonly (typeof weaponRanges)[number][];
  readonly properties?: readonly string[];
  readonly armorTypes?: readonly (typeof armorTypes)[number][];
  readonly except?: readonly string[];
  readonly bonus?: number | readonly number[];
}
export interface Item {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly setId: string;
  readonly name: string;
  readonly text: string;
  readonly overrides: Overrides;
  readonly tags: readonly string[];
  readonly characterMechanics: Mechanics;
  readonly characterEffects: readonly Effect[];
  readonly playerVisible: boolean;
  readonly retired: boolean;
  readonly updatedAt: number;
  readonly grants?: Grants;
  readonly attunementPrerequisites?: AttunementRequirement;
  readonly container?: Container;
  readonly baseItem?: BaseItem;
}
/** The magic-item record served to the D&D Engine. */
export interface ServedRecord {
  readonly kind: "magic-item";
  readonly id: string;
  readonly name: string;
  readonly edition: "2024";
  readonly book: "homebrew";
  readonly itemType: string;
  readonly rarity: Rarity;
  readonly attunement: boolean;
  readonly tags: readonly string[];
  readonly text: string;
  readonly characterMechanics: Mechanics;
  readonly characterEffects: readonly Effect[];
  readonly bodyPlacements?: readonly BodyPlacement[];
  readonly grants?: Grants;
  readonly weightLb?: number;
  readonly attunementPrerequisites?: AttunementRequirement;
  readonly container?: Container;
  readonly baseItem?: BaseItem;
}
/**
 * A removed item is withdrawn, never deleted: the browser cannot learn a
 * deleted key's tombstone revision, so it could not publish that id again.
 */
export interface Published {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly itemId: string;
  readonly setId: string;
  readonly setName: string;
  readonly playerVisible: boolean;
  readonly retired: boolean;
  readonly withdrawn: boolean;
  readonly record: ServedRecord;
}
export interface PublishMeta {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly publishedAt: number;
  readonly recordCount: number;
}

/** An English message template with {placeholders}; catalogs translate it. */
export interface Problem {
  readonly text: string;
  readonly params?: Readonly<Record<string, string | number>>;
}
export class HomebrewError extends Error {
  readonly problem: Problem;
  constructor(text: string, params?: Readonly<Record<string, string | number>>) {
    super(fill(text, params));
    this.name = "HomebrewError";
    this.problem = params ? { text, params } : { text };
  }
}
export function fill(text: string, params: Readonly<Record<string, string | number>> = {}): string {
  return text.replace(/\{(\w+)\}/gu, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
function problem(text: string, params?: Readonly<Record<string, string | number>>): Problem {
  return params ? { text, params } : { text };
}

// --- Primitive checks ------------------------------------------------------

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Unicode code points, the unit JSON Schema maxLength counts. */
const length = (value: string): number =>
  value.length - (value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)?.length ?? 0);
export function validId(value: unknown): value is string {
  return (
    typeof value === "string" && value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
  );
}
export function validName(value: unknown, limit = 120): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    length(value) <= limit &&
    !/[\n\r\u2028\u2029]/u.test(value) &&
    value.trim() === value
  );
}
const validMarkdown = (value: unknown): value is string =>
  typeof value === "string" && length(value) <= maxMarkdown;
const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);
const validEffectKey = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 60 &&
  /^[a-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$/u.test(value);
function distinct(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}
function placementsProblem(value: unknown): Problem | undefined {
  if (!Array.isArray(value) || value.length > bodyPlacements.length || !distinct(value))
    return problem("Body placements must be distinct.");
  const unknown = value.find((entry) => !oneOf(bodyPlacements, entry));
  return unknown === undefined
    ? undefined
    : problem("Body placement {value} is not supported.", { value: String(unknown) });
}
function tagsProblem(value: unknown): Problem | undefined {
  if (!Array.isArray(value) || value.length > 20 || !distinct(value))
    return problem("Tags must be at most 20 distinct values.");
  const bad = value.find((tag) => !validId(tag) || (tag as string).length > 60);
  return bad === undefined
    ? undefined
    : problem("Tag {value} must be lowercase words joined by hyphens.", { value: String(bad) });
}

// --- Effects ---------------------------------------------------------------

/** The D&D Engine's validCharacterEffect plus its proficiency rule. */
export function effectProblem(effect: Effect): Problem | undefined {
  if (!oneOf(modes, effect.mode)) return problem("Choose set, add, minimum or maximum.");
  if (!Number.isInteger(effect.value) || effect.value < -100000 || effect.value > 100000)
    return problem("The value must be a whole number between -100000 and 100000.");
  const target: string = effect.target;
  if (oneOf(abilityTargets, target)) {
    if (!oneOf(abilities, effect.key)) return problem("Choose an ability.");
  } else if (oneOf(plainTargets, target)) {
    if (effect.key !== undefined && effect.key !== "") return problem("This effect takes no key.");
  } else if (target === "proficiency") {
    if (!oneOf(skills, effect.key) && !oneOf(abilities, effect.key))
      return problem("Choose a skill or a saving throw.");
    if (effect.mode !== "set" || effect.value !== 1)
      return problem("A proficiency uses mode set with value 1.");
  } else if (oneOf(keyedTargets, target)) {
    if (!validEffectKey(effect.key))
      return problem("Name the sense or resource, such as darkvision.");
  } else {
    return problem("Effect {target} is not supported.", { target });
  }
  return undefined;
}

/**
 * "complete" needs at least one supported effect, grants or a weapon or armor
 * bonus; "narrative" declares none of them, though it may name its base
 * weapon or armor. Absent grants and base items are `undefined`.
 */
export function mechanicsProblem(
  mechanics: unknown,
  effects: readonly Effect[],
  grants?: unknown,
  baseItem?: BaseItem,
): Problem | undefined {
  const bonus = baseItem?.bonus !== undefined;
  if (mechanics === "narrative")
    return effects.length > 0 || grants !== undefined || bonus
      ? problem("A text-only item cannot have effects, properties or a bonus.")
      : undefined;
  if (mechanics !== "complete") return problem("Choose automated or text-only mechanics.");
  if (effects.length === 0 && grants === undefined && !bonus)
    return problem("An automated item needs at least one effect, property or bonus.");
  if (grants !== undefined) {
    const failure = grantsProblem(grants);
    if (failure) return failure;
  }
  if (effects.length > maxEffects)
    return problem("An item has at most {count} effects.", { count: maxEffects });
  const seen = new Set<string>(),
    sets = new Set<string>(),
    bounds = new Map<string, [number, number]>();
  for (const [index, effect] of effects.entries()) {
    const failure = effectProblem(effect);
    const position = index + 1;
    if (failure)
      return problem("Effect {position}: {problem}", {
        position,
        problem: fill(failure.text, failure.params),
      });
    const identity = canonical(effect);
    if (seen.has(identity))
      return problem("Effect {position} repeats an earlier effect.", { position });
    seen.add(identity);
    if (effect.target === "proficiency") continue;
    const slot = `${effect.target}:${effect.key ?? ""}`;
    if (effect.mode === "set") {
      if (sets.has(slot))
        return problem("Effect {position} sets the same value twice.", { position });
      sets.add(slot);
    } else if (effect.mode === "minimum" || effect.mode === "maximum") {
      const limits = bounds.get(slot) ?? [-1_000_000, 1_000_000];
      if (effect.mode === "minimum") limits[0] = Math.max(limits[0], effect.value);
      else limits[1] = Math.min(limits[1], effect.value);
      if (limits[0] > limits[1])
        return problem("Effect {position} makes a minimum exceed its maximum.", { position });
      bounds.set(slot, limits);
    }
  }
  return undefined;
}

// --- Grants ----------------------------------------------------------------

// internal/homebrew/grants.go enforces the same allowlist; the shared fixture
// tests/fixtures/effects.json keeps the two in step.

type Json = Readonly<Record<string, unknown>>;
const isInteger = (value: unknown, low: number, high: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= low && value <= high;
function positioned(position: number, failure: Problem): Record<string, string | number> {
  return { position, problem: fill(failure.text, failure.params) };
}
function entries(value: unknown, field: string, limit: number): unknown[] | Problem {
  return Array.isArray(value) && value.length > 0 && value.length <= limit
    ? value
    : problem("{field} must list 1 to {count} entries.", { field, count: limit });
}
function choices(value: unknown, vocabulary: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= vocabulary.length &&
    distinct(value) &&
    value.every((entry) => oneOf(vocabulary, entry))
  );
}
function spellIds(value: unknown, limit: number): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= limit &&
    distinct(value) &&
    value.every(validId)
  );
}

function advantageProblem(value: unknown, modifier: boolean): Problem | undefined {
  const shape = exactFields(
    value,
    ["on"],
    modifier
      ? ["target", "mode", "abilities", "skills", "when"]
      : ["mode", "abilities", "skills", "when"],
  );
  if (shape) return shape;
  const entry = value as Json;
  if (!oneOf(advantageRolls, entry["on"])) return problem("Choose a roll.");
  if (
    entry["mode"] !== undefined &&
    entry["mode"] !== "advantage" &&
    entry["mode"] !== "disadvantage"
  )
    return problem("Choose advantage or disadvantage.");
  if (entry["abilities"] !== undefined) {
    if (entry["on"] !== "save" && entry["on"] !== "check")
      return problem("Abilities narrow only saving throws and ability checks.");
    if (!choices(entry["abilities"], abilities)) return problem("Choose distinct abilities.");
  }
  if (entry["skills"] !== undefined) {
    if (entry["on"] !== "check") return problem("Skills narrow only ability checks.");
    if (!choices(entry["skills"], skills)) return problem("Choose distinct skills.");
  }
  if (entry["when"] !== undefined && !validName(entry["when"], 200))
    return problem("The situation is one line of at most 200 characters.");
  return undefined;
}

function castingAbilityProblem(value: unknown): Problem | undefined {
  const fixed = isRecord(value) && value["fixed"] !== undefined;
  const shape = fixed ? exactFields(value, ["fixed"]) : exactFields(value, ["id", "choose"]);
  if (shape) return problem("The spellcasting ability is either fixed or chosen from abilities.");
  const entry = value as Json;
  if (
    fixed
      ? !oneOf(abilities, entry["fixed"])
      : !validId(entry["id"]) || !choices(entry["choose"], abilities)
  )
    return problem("The spellcasting ability is either fixed or chosen from abilities.");
  return undefined;
}

function resourceProblem(value: unknown): Problem | undefined {
  const shape = exactFields(value, ["key", "name", "fixed", "recharge"]);
  if (shape) return shape;
  const entry = value as Json;
  if (!validId(entry["key"])) return problem("The key must be lowercase words joined by hyphens.");
  if (!validName(entry["name"]))
    return problem("Give the use a one-line name of at most 120 characters.");
  if (!isInteger(entry["fixed"], 1, 100))
    return problem("The count is a whole number from 1 to 100.");
  if (entry["recharge"] !== "short" && entry["recharge"] !== "long")
    return problem("Uses come back on a Short Rest or a Long Rest.");
  return undefined;
}

function spellFilterProblem(value: unknown): Problem | undefined {
  if (
    exactFields(value, [], ["class", "school", "ids", "ritual"]) ||
    Object.keys(value as Json).length === 0
  )
    return problem("The spell filter needs a class, a school, spell ids or ritual.");
  const entry = value as Json;
  const valid =
    (entry["class"] === undefined || spellIds(entry["class"], 20)) &&
    (entry["school"] === undefined || choices(entry["school"], spellSchools)) &&
    (entry["ids"] === undefined || spellIds(entry["ids"], 20)) &&
    (entry["ritual"] === undefined || entry["ritual"] === true);
  return valid
    ? undefined
    : problem("The spell filter needs a class, a school, spell ids or ritual.");
}

function spellProblem(value: unknown, resources: ReadonlyMap<string, number>): Problem | undefined {
  if (!isRecord(value)) return problem("The value must be an object.");
  if (value["ids"] !== undefined) {
    const shape = exactFields(value, ["ids"], ["resource", "atWill"]);
    if (shape) return shape;
    if (!spellIds(value["ids"], 20))
      return problem("Enter spell ids such as bless, without repeats.");
  } else {
    const shape = exactFields(
      value,
      ["id", "choose"],
      ["spellLevel", "maxSpellLevel", "from", "resource", "atWill"],
    );
    if (shape) return shape;
    if (!validId(value["id"]))
      return problem("Give the spell choice an id of lowercase words joined by hyphens.");
    if (!isInteger(value["choose"], 1, 10)) return problem("Choose 1 to 10 spells.");
    const exact = value["spellLevel"] !== undefined,
      highest = value["maxSpellLevel"] !== undefined;
    if (exact === highest)
      return problem("Set either an exact spell level or a highest spell level.");
    const level = exact ? value["spellLevel"] : value["maxSpellLevel"];
    if (!isInteger(level, 0, 9)) return problem("The spell level is a whole number from 0 to 9.");
    if (value["from"] !== undefined) {
      const failure = spellFilterProblem(value["from"]);
      if (failure) return failure;
    }
    if (level > 0 && value["resource"] === undefined && value["atWill"] === undefined)
      return problem("A leveled spell choice needs a use or must be at will.");
  }
  const resource = value["resource"];
  if (resource !== undefined) {
    let key: unknown = resource,
      cost: unknown = 1;
    if (typeof resource !== "string") {
      const shape = exactFields(resource, ["key"], ["cost"]);
      if (shape) return shape;
      key = (resource as Json)["key"];
      cost = (resource as Json)["cost"] ?? 1;
    }
    const fixed = typeof key === "string" ? resources.get(key) : undefined;
    if (fixed === undefined) return problem("The spell spends a use this item does not have.");
    if (!isInteger(cost, 1, fixed))
      return problem("A use cost is a whole number up to that use's count.");
    if (value["atWill"] !== undefined) return problem("Cast it with a use or at will, not both.");
  }
  if (value["atWill"] !== undefined && value["atWill"] !== true)
    return problem("At will is either set or left out.");
  return undefined;
}

function modifierProblem(value: unknown): Problem | undefined {
  if (!isRecord(value)) return problem("The value must be an object.");
  const target = value["target"];
  if (target === "advantage") return advantageProblem(value, true);
  if (target === "sense" || target === "senseBonus") {
    const amount = target === "sense" ? "value" : "add";
    const shape = exactFields(value, ["target", "key", amount]);
    if (shape) return shape;
    // The Engine reads a granted sense key as an id, stricter than an effect key.
    if (!validId(value["key"])) return problem("Name a sense such as darkvision.");
    if (!isInteger(value[amount], 1, 1000))
      return problem("The range is a whole number of feet from 1 to 1000.");
    return undefined;
  }
  if (target === "resistance" || target === "damageImmunity" || target === "conditionImmunity") {
    const shape = exactFields(value, ["target", "value"]);
    if (shape) return shape;
    if (target === "conditionImmunity")
      return oneOf(conditionIds, value["value"]) ? undefined : problem("Choose a condition.");
    return oneOf(damageTypes, value["value"]) ? undefined : problem("Choose a damage type.");
  }
  return problem("Choose a supported change.");
}

function activationProblem(value: unknown): Problem | undefined {
  const shape = exactFields(value, ["id", "name", "modifiers"], ["condition"]);
  if (shape) return shape;
  const entry = value as Json;
  if (!validId(entry["id"])) return problem("The id must be lowercase words joined by hyphens.");
  if (!validName(entry["name"]))
    return problem("Give the toggle a one-line name of at most 120 characters.");
  if (entry["condition"] !== undefined && !validName(entry["condition"], 200))
    return problem("The situation is one line of at most 200 characters.");
  const modifiers = entry["modifiers"];
  return Array.isArray(modifiers) && modifiers.length > 0 && modifiers.length <= 20
    ? undefined
    : problem("Give the toggle 1 to 20 changes.");
}

/** A granted condition: the set condition, or a published grants.conditions entry. */
export function conditionProblem(value: unknown): Problem | undefined {
  const shape = exactFields(value, ["id", "name", "summary"]);
  if (shape) return shape;
  const entry = value as Json;
  if (!validId(entry["id"])) return problem("The id must be lowercase words joined by hyphens.");
  if (oneOf(conditionIds, entry["id"]))
    return problem("Choose an id that is not a standard condition.");
  if (!validName(entry["name"]))
    return problem("Give the condition a one-line name of at most 120 characters.");
  if (typeof entry["summary"] !== "string" || length(entry["summary"]) > maxConditionSummary)
    return problem("The summary is limited to {count} characters.", { count: maxConditionSummary });
  return undefined;
}

/** The D&D Engine's item grants allowlist, for a published record. */
export function grantsProblem(value: unknown): Problem | undefined {
  if (!isRecord(value)) return problem("The value must be an object.");
  const fields = Object.keys(value);
  if (fields.length === 0)
    return problem("The properties must declare something; leave them out instead.");
  const unknown = fields.find((field) => !oneOf(grantFields, field));
  if (unknown !== undefined) return problem("Unknown property {field}.", { field: unknown });
  const resources = new Map<string, number>();
  if (value["resources"] !== undefined) {
    const list = entries(value["resources"], "resources", 10);
    if (!Array.isArray(list)) return list;
    for (const [index, entry] of list.entries()) {
      const failure = resourceProblem(entry);
      if (failure) return problem("Use {position}: {problem}", positioned(index + 1, failure));
      const { key, fixed } = entry as GrantResource;
      if (resources.has(key))
        return problem("Use {position} repeats the key {key}.", { position: index + 1, key });
      resources.set(key, fixed);
    }
  }
  if (value["advantages"] !== undefined) {
    const list = entries(value["advantages"], "advantages", 20);
    if (!Array.isArray(list)) return list;
    for (const [index, entry] of list.entries()) {
      const failure = advantageProblem(entry, false);
      if (failure)
        return problem("Advantage {position}: {problem}", positioned(index + 1, failure));
    }
  }
  if (value["castingAbility"] !== undefined) {
    const failure = castingAbilityProblem(value["castingAbility"]);
    if (failure) return failure;
    if (value["spells"] === undefined) return problem("A spellcasting ability needs a spell.");
  }
  if (value["spells"] !== undefined) {
    const list = entries(value["spells"], "spells", 20);
    if (!Array.isArray(list)) return list;
    const ids = new Set<string>();
    for (const [index, entry] of list.entries()) {
      const failure = spellProblem(entry, resources);
      if (failure) return problem("Spell {position}: {problem}", positioned(index + 1, failure));
      const id = (entry as SpellGrant).id;
      if (id === undefined) continue;
      if (ids.has(id))
        return problem("Spell {position} repeats the choice id {id}.", { position: index + 1, id });
      ids.add(id);
    }
  }
  if (value["activations"] !== undefined) {
    const list = entries(value["activations"], "activations", 10);
    if (!Array.isArray(list)) return list;
    const ids = new Set<string>();
    for (const [index, entry] of list.entries()) {
      const failure = activationProblem(entry);
      if (failure) return problem("Toggle {position}: {problem}", positioned(index + 1, failure));
      const activation = entry as Activation;
      for (const [change, modifier] of activation.modifiers.entries()) {
        const invalid = modifierProblem(modifier);
        if (invalid)
          return problem("Toggle {position}, change {change}: {problem}", {
            position: index + 1,
            change: change + 1,
            problem: fill(invalid.text, invalid.params),
          });
      }
      if (ids.has(activation.id))
        return problem("Toggle {position} repeats the id {id}.", {
          position: index + 1,
          id: activation.id,
        });
      ids.add(activation.id);
    }
  }
  for (const field of ["resistances", "damageImmunities"] as const)
    if (value[field] !== undefined && !choices(value[field], damageTypes))
      return problem("Choose distinct damage types.");
  if (
    value["conditionImmunities"] !== undefined &&
    !choices(value["conditionImmunities"], conditionIds)
  )
    return problem("Choose distinct conditions.");
  if (value["conditions"] !== undefined) {
    const list = entries(value["conditions"], "conditions", 10);
    if (!Array.isArray(list)) return list;
    const ids = new Set<string>();
    for (const [index, entry] of list.entries()) {
      const failure = conditionProblem(entry);
      if (failure)
        return problem("Condition {position}: {problem}", positioned(index + 1, failure));
      const id = (entry as GrantedCondition).id;
      if (ids.has(id))
        return problem("Condition {position} repeats the id {id}.", { position: index + 1, id });
      ids.add(id);
    }
  }
  return undefined;
}

// --- Carrying and attunement ------------------------------------------------

// internal/homebrew/carrying.go enforces the same rules; the shared fixture
// tests/fixtures/effects.json ("carrying") keeps the two in step.

export function weightProblem(value: unknown): Problem | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maxWeight
    ? undefined
    : problem("A weight is a number of pounds from 0 to {count}.", { count: maxWeight });
}

export function containerProblem(value: unknown): Problem | undefined {
  const shape = exactFields(value, [], ["capacityLb", "weightless"]);
  if (shape) return shape;
  const entry = value as Json,
    capacity = entry["capacityLb"];
  if (capacity === undefined && entry["weightless"] === undefined)
    return problem("A container has a capacity, weightless contents or both.");
  if (
    capacity !== undefined &&
    (typeof capacity !== "number" ||
      !Number.isFinite(capacity) ||
      capacity <= 0 ||
      capacity > maxWeight)
  )
    return problem("A container's capacity is more than 0 and at most {count} pounds.", {
      count: maxWeight,
    });
  if (entry["weightless"] !== undefined && entry["weightless"] !== true)
    return problem("Weightless contents are either set or left out.");
  return undefined;
}

/** The class of `{"<class id>": <minimum level>}`, or undefined when malformed. */
function classOfLevel(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.length !== 1) return undefined;
  const [id, level] = entries[0]!;
  return validId(id) && isInteger(level, 1, 20) ? id : undefined;
}

/** Who may attune: a spellcaster, one class, any of several classes, or words. */
export function requirementProblem(value: unknown): Problem | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 1)
    return problem("Choose a spellcaster, classes or a requirement in words.");
  const classProblem = problem("Name each class by its id, with a minimum level from 1 to 20.");
  if ("spellcaster" in value)
    return value["spellcaster"] === true
      ? undefined
      : problem("Choose a spellcaster, classes or a requirement in words.");
  if ("classes" in value) return classOfLevel(value["classes"]) ? undefined : classProblem;
  if ("any" in value) {
    const list = value["any"];
    if (!Array.isArray(list) || list.length < 2 || list.length > 13)
      return problem("List 2 to 13 classes.");
    const ids = list.map((entry) =>
      exactFields(entry, ["classes"]) === undefined
        ? classOfLevel((entry as Json)["classes"])
        : undefined,
    );
    if (ids.some((id) => id === undefined)) return classProblem;
    return distinct(ids) ? undefined : problem("List each class once.");
  }
  if ("text" in value)
    return validName(value["text"], 300)
      ? undefined
      : problem("Describe the requirement in one line of at most 300 characters.");
  return problem("Choose a spellcaster, classes or a requirement in words.");
}

/** A class or spell id as words: cure-wounds reads "Cure Wounds". */
export function titleOf(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Who may attune, as published text says it after "Requires Attunement by". */
export function requirementWords(requirement: AttunementRequirement): string {
  if ("spellcaster" in requirement) return "a Spellcaster";
  if ("text" in requirement) return requirement.text;
  const names = (
    "classes" in requirement ? [requirement.classes] : requirement.any.map((entry) => entry.classes)
  ).map((entry) => {
    const [id, level] = Object.entries(entry)[0]!;
    return level > 1 ? `${titleOf(id)} of level ${level} or higher` : titleOf(id);
  });
  const list =
    names.length <= 2 ? names.join(" or ") : `${names.slice(0, -1).join(", ")}, or ${names.at(-1)}`;
  return `${/^[AEIOU]/u.test(list) ? "an" : "a"} ${list}`;
}

// --- Weapons and armor -----------------------------------------------------

// internal/homebrew/gear.go enforces the same rules, a stricter subset of the
// Engine's baseItem (internal/rules/magic_gear.go); the shared fixture
// tests/fixtures/effects.json ("baseItems") keeps the two in step.

/** A list field of a base item: present lists hold 1 to `limit` distinct entries. */
function baseList(value: unknown, limit: number, valid: (entry: unknown) => boolean): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.length <= limit &&
      value.every(valid) &&
      distinct(value))
  );
}

export function baseItemProblem(value: unknown): Problem | undefined {
  const shape = exactFields(
    value,
    ["kind"],
    ["ids", "categories", "ranges", "properties", "armorTypes", "except", "bonus"],
  );
  if (shape) return shape;
  const base = value as Json,
    kind = base["kind"];
  if (!oneOf(baseItemKinds, kind)) return problem("Choose a weapon or armor as the base.");
  if (!baseList(base["ids"], maxBaseIds, validId) || !baseList(base["except"], maxBaseIds, validId))
    return problem("Name at most {count} base records by id, each once.", { count: maxBaseIds });
  const weapon = kind === "weapon";
  if (
    !baseList(base["categories"], weaponCategories.length, (entry) =>
      oneOf(weaponCategories, entry),
    ) ||
    !baseList(base["ranges"], weaponRanges.length, (entry) => oneOf(weaponRanges, entry)) ||
    !baseList(base["properties"], 20, validId) ||
    !baseList(base["armorTypes"], armorTypes.length, (entry) => oneOf(armorTypes, entry))
  )
    return problem("Choose each base filter from its options, once.");
  if (
    weapon
      ? base["armorTypes"] !== undefined
      : ["categories", "ranges", "properties"].some((field) => base[field] !== undefined)
  )
    return problem("Filter a weapon by category, range and property, and armor by armor type.");
  if (
    base["ids"] !== undefined &&
    ["categories", "ranges", "properties", "armorTypes", "except"].some(
      (field) => base[field] !== undefined,
    )
  )
    return problem("Name the base records or filter them, not both.");
  const bonus = base["bonus"],
    validBonus = (entry: unknown): boolean => isInteger(entry, 1, maxBonus);
  if (
    bonus !== undefined &&
    !(Array.isArray(bonus) ? baseList(bonus, maxBonus, validBonus) : validBonus(bonus))
  )
    return problem("A bonus is a whole number from 1 to {count}, or a list of them.", {
      count: maxBonus,
    });
  return undefined;
}

/** Rules that span a flattened record: a requirement needs attunement. */
export function recordProblem(record: ServedRecord): Problem | undefined {
  return record.attunementPrerequisites !== undefined && !record.attunement
    ? problem("Only an item that requires attunement can have an attunement requirement.")
    : undefined;
}

// --- Drafts ----------------------------------------------------------------

export function setProblem(value: ItemSet): Problem | undefined {
  if (value.schemaVersion !== 1) return problem("Unsupported set version.");
  if (!validId(value.id)) return problem("The id must be lowercase words joined by hyphens.");
  if (!validName(value.name))
    return problem("Give the set a one-line name of at most 120 characters.");
  if (value.namePrefix !== "" && !validName(value.namePrefix, 60))
    return problem("The name prefix is one line of at most 60 characters.");
  if (!validMarkdown(value.description) || !validMarkdown(value.curse))
    return problem("Descriptions are limited to {count} characters.", { count: maxMarkdown });
  if (!validName(value.itemType))
    return problem("Give the set an item type, such as Wondrous Item.");
  if (!oneOf(rarities, value.rarity)) return problem("Choose a rarity.");
  if (typeof value.attunement !== "boolean" || typeof value.playerVisible !== "boolean")
    return problem("The set is malformed.");
  if (!Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0)
    return problem("The set is malformed.");
  return (
    placementsProblem(value.bodyPlacements) ??
    tagsProblem(value.tags) ??
    (value.condition === undefined ? undefined : conditionProblem(value.condition)) ??
    (value.weightLb === undefined ? undefined : weightProblem(value.weightLb))
  );
}

export function itemProblem(value: Item): Problem | undefined {
  if (value.schemaVersion !== 1) return problem("Unsupported item version.");
  if (!validId(value.id)) return problem("The id must be lowercase words joined by hyphens.");
  if (value.setId !== "" && !validId(value.setId)) return problem("The set reference is invalid.");
  if (!validName(value.name))
    return problem("Give the item a one-line name of at most 120 characters.");
  if (!validMarkdown(value.text))
    return problem("Descriptions are limited to {count} characters.", { count: maxMarkdown });
  if (typeof value.playerVisible !== "boolean" || typeof value.retired !== "boolean")
    return problem("The item is malformed.");
  if (!Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0)
    return problem("The item is malformed.");
  const overrides = value.overrides;
  if (overrides.itemType !== undefined && !validName(overrides.itemType))
    return problem("The item type override is invalid.");
  if (overrides.rarity !== undefined && !oneOf(rarities, overrides.rarity))
    return problem("Choose a rarity.");
  if (overrides.attunement !== undefined && typeof overrides.attunement !== "boolean")
    return problem("The item is malformed.");
  if (overrides.bodyPlacements !== undefined) {
    const failure = placementsProblem(overrides.bodyPlacements);
    if (failure) return failure;
  }
  if (isRecord(value.grants) && value.grants["conditions"] !== undefined)
    return problem("Conditions come from the item's set.");
  return (
    tagsProblem(value.tags) ??
    (overrides.weightLb === undefined ? undefined : weightProblem(overrides.weightLb)) ??
    (value.attunementPrerequisites === undefined
      ? undefined
      : requirementProblem(value.attunementPrerequisites)) ??
    (value.container === undefined ? undefined : containerProblem(value.container)) ??
    (value.baseItem === undefined ? undefined : baseItemProblem(value.baseItem)) ??
    mechanicsProblem(value.characterMechanics, value.characterEffects, value.grants, value.baseItem)
  );
}

const setFields = [
  "id",
  "schemaVersion",
  "name",
  "description",
  "curse",
  "itemType",
  "rarity",
  "attunement",
  "bodyPlacements",
  "tags",
  "namePrefix",
  "playerVisible",
  "updatedAt",
] as const;
const itemFields = [
  "id",
  "schemaVersion",
  "setId",
  "name",
  "text",
  "overrides",
  "tags",
  "characterMechanics",
  "characterEffects",
  "playerVisible",
  "retired",
  "updatedAt",
] as const;
const overrideFields = ["itemType", "rarity", "attunement", "bodyPlacements", "weightLb"] as const;

function exactFields(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Problem | undefined {
  if (!isRecord(value)) return problem("The value must be an object.");
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown !== undefined) return problem("Unknown field {field}.", { field: unknown });
  const missing = required.find((key) => value[key] === undefined || value[key] === null);
  return missing === undefined ? undefined : problem("Missing field {field}.", { field: missing });
}
function effectsShapeProblem(value: unknown): Problem | undefined {
  if (!Array.isArray(value)) return problem("characterEffects must be a list.");
  for (const [index, effect] of value.entries()) {
    const failure = exactFields(effect, ["target", "mode", "value"], ["key"]);
    if (failure)
      return problem("Effect {position}: {problem}", {
        position: index + 1,
        problem: fill(failure.text, failure.params),
      });
  }
  return undefined;
}

/** Checks an untrusted value as a stored set and returns it. */
export function parseSet(value: unknown): ItemSet {
  const failure =
    exactFields(value, setFields, ["condition", "weightLb"]) ??
    setProblem(value as unknown as ItemSet);
  if (failure) throw new HomebrewError(failure.text, failure.params);
  return value as unknown as ItemSet;
}
/** Checks an untrusted value as a stored item draft and returns it. */
export function parseItem(value: unknown): Item {
  const failure =
    exactFields(value, itemFields, [
      "grants",
      "attunementPrerequisites",
      "container",
      "baseItem",
    ]) ??
    exactFields((value as Record<string, unknown>)["overrides"], [], overrideFields) ??
    effectsShapeProblem((value as Record<string, unknown>)["characterEffects"]) ??
    itemProblem(value as unknown as Item);
  if (failure) throw new HomebrewError(failure.text, failure.params);
  return value as unknown as Item;
}
/** Checks an untrusted value as a published record and returns it. */
export function parsePublished(value: unknown): Published {
  const top = exactFields(value, [
    "id",
    "schemaVersion",
    "itemId",
    "setId",
    "setName",
    "playerVisible",
    "retired",
    "withdrawn",
    "record",
  ]);
  if (top) throw new HomebrewError(top.text, top.params);
  const published = value as unknown as Published,
    record = published.record as unknown;
  const shape = exactFields(
    record,
    [
      "kind",
      "id",
      "name",
      "edition",
      "book",
      "itemType",
      "rarity",
      "attunement",
      "tags",
      "text",
      "characterMechanics",
      "characterEffects",
    ],
    ["bodyPlacements", "grants", "weightLb", "attunementPrerequisites", "container", "baseItem"],
  );
  if (shape) throw new HomebrewError(shape.text, shape.params);
  const served = published.record;
  const valid =
    published.schemaVersion === 1 &&
    validId(published.itemId) &&
    published.id === idPrefix + published.itemId &&
    served.id === published.id &&
    (published.setId === "" || validId(published.setId)) &&
    (published.setId === "") === (published.setName === "") &&
    (published.setName === "" || validName(published.setName)) &&
    typeof published.playerVisible === "boolean" &&
    typeof published.retired === "boolean" &&
    typeof published.withdrawn === "boolean" &&
    served.kind === "magic-item" &&
    served.edition === "2024" &&
    served.book === "homebrew" &&
    validName(served.name, 243) &&
    validName(served.itemType) &&
    oneOf(rarities, served.rarity) &&
    typeof served.attunement === "boolean" &&
    typeof served.text === "string" &&
    Array.isArray(served.tags) &&
    served.tags.every((tag) => typeof tag === "string" && tag.length > 0) &&
    (served.bodyPlacements === undefined ||
      (served.bodyPlacements.length > 0 &&
        placementsProblem(served.bodyPlacements) === undefined)) &&
    effectsShapeProblem(served.characterEffects) === undefined &&
    (served.weightLb === undefined || weightProblem(served.weightLb) === undefined) &&
    (served.attunementPrerequisites === undefined ||
      requirementProblem(served.attunementPrerequisites) === undefined) &&
    (served.container === undefined || containerProblem(served.container) === undefined) &&
    (served.baseItem === undefined || baseItemProblem(served.baseItem) === undefined) &&
    recordProblem(served) === undefined &&
    mechanicsProblem(
      served.characterMechanics,
      served.characterEffects,
      served.grants,
      served.baseItem,
    ) === undefined;
  if (!valid) throw new HomebrewError("A published record is invalid.");
  return published;
}
export function parseMeta(value: unknown): PublishMeta {
  const failure = exactFields(value, ["schemaVersion", "revision", "publishedAt", "recordCount"]);
  const meta = value as PublishMeta;
  if (
    failure ||
    meta.schemaVersion !== 1 ||
    !Number.isSafeInteger(meta.revision) ||
    meta.revision < 1 ||
    !Number.isSafeInteger(meta.publishedAt) ||
    !Number.isSafeInteger(meta.recordCount)
  )
    throw new HomebrewError("The publish record is invalid.");
  return meta;
}

// --- New drafts ------------------------------------------------------------

export function slug(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 64)
      .replace(/-+$/u, "") || "item"
  );
}
/** An id from the name that no listed draft uses yet. */
export function freeId(name: string, taken: ReadonlySet<string>): string {
  const base = slug(name);
  if (!taken.has(base)) return base;
  for (let index = 2; ; index++) {
    const suffix = `-${index}`,
      candidate = `${base.slice(0, 64 - suffix.length).replace(/-+$/u, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
export function newSet(name: string, id: string, now: number): ItemSet {
  return {
    id,
    schemaVersion: 1,
    name,
    description: "",
    curse: "",
    itemType: "Wondrous Item",
    rarity: "Uncommon",
    attunement: false,
    bodyPlacements: [],
    tags: [],
    namePrefix: "",
    playerVisible: false,
    updatedAt: now,
  };
}
export function newItem(name: string, id: string, setId: string, now: number): Item {
  return {
    id,
    schemaVersion: 1,
    setId,
    name,
    text: "",
    overrides: {},
    tags: [],
    characterMechanics: "narrative",
    characterEffects: [],
    playerVisible: false,
    retired: false,
    updatedAt: now,
  };
}

// --- Publishing ------------------------------------------------------------

/** Set defaults, per-item overrides and the item's own text, as one record. */
export function flatten(itemSet: ItemSet | undefined, item: Item): Published {
  const overrides = item.overrides;
  const itemType = overrides.itemType ?? itemSet?.itemType ?? "Wondrous Item",
    rarity = overrides.rarity ?? itemSet?.rarity ?? "Common",
    attunement = overrides.attunement ?? itemSet?.attunement ?? false,
    placements = overrides.bodyPlacements ?? itemSet?.bodyPlacements ?? [],
    prefix = itemSet?.namePrefix ?? "";
  const requirement = item.attunementPrerequisites,
    weight = overrides.weightLb ?? itemSet?.weightLb;
  const by = requirement ? ` by ${requirementWords(requirement)}` : "";
  const header = `*${itemType}, ${rarity}${attunement ? ` (Requires Attunement${by})` : ""}*`;
  const curse = itemSet?.curse.trim() ?? "";
  const grants = publishedGrants(item.grants, itemSet?.condition);
  const text = [
    header,
    item.text.trim(),
    itemSet?.description.trim() ?? "",
    curse ? `**Curse.** ${curse}` : "",
  ]
    .filter((part) => part !== "")
    .join("\n\n");
  const record: ServedRecord = {
    kind: "magic-item",
    id: idPrefix + item.id,
    name: prefix ? `${prefix}: ${item.name}` : item.name,
    edition: "2024",
    book: "homebrew",
    itemType,
    rarity,
    attunement,
    tags: [
      ...new Set([
        "homebrew",
        ...(itemSet ? [itemSet.id] : []),
        ...(itemSet?.tags ?? []),
        ...item.tags,
      ]),
    ],
    text,
    // The set condition makes even a text-only item a grant source.
    characterMechanics: grants ? "complete" : item.characterMechanics,
    characterEffects: item.characterEffects.map((effect) => ({
      target: effect.target,
      ...(effect.key ? { key: effect.key } : {}),
      mode: effect.mode,
      value: effect.value,
    })),
    ...(placements.length > 0 ? { bodyPlacements: [...placements] } : {}),
    ...(grants ? { grants } : {}),
    ...(weight !== undefined ? { weightLb: weight } : {}),
    ...(requirement
      ? {
          attunementPrerequisites: JSON.parse(JSON.stringify(requirement)) as AttunementRequirement,
        }
      : {}),
    ...(item.container ? { container: { ...item.container } } : {}),
    ...(item.baseItem ? { baseItem: JSON.parse(JSON.stringify(item.baseItem)) as BaseItem } : {}),
  };
  return {
    id: record.id,
    schemaVersion: 1,
    itemId: item.id,
    setId: item.setId,
    setName: itemSet?.name ?? "",
    playerVisible: item.playerVisible && (itemSet ? itemSet.playerVisible : true),
    retired: item.retired,
    withdrawn: false,
    record,
  };
}

/** The item's grants plus its set condition, in record field order. */
function publishedGrants(
  grants: Grants | undefined,
  condition: GrantedCondition | undefined,
): Grants | undefined {
  const source: Record<string, unknown> = {
    ...(grants ? (JSON.parse(JSON.stringify(grants)) as Grants) : {}),
    ...(condition
      ? { conditions: [{ id: condition.id, name: condition.name, summary: condition.summary }] }
      : {}),
  };
  const fields = grantFields.filter((field) => source[field] !== undefined);
  return fields.length > 0
    ? (Object.fromEntries(fields.map((field) => [field, source[field]])) as Grants)
    : undefined;
}

export interface Stored<T> {
  readonly value: T;
  readonly revision: number;
}
export interface PublishChange {
  readonly id: string;
  readonly name: string;
  readonly operation: "add" | "update" | "withdraw";
}
export type CollectionMutation =
  | {
      readonly operation: "put";
      readonly kind: "collection";
      readonly dataId: string;
      readonly key: string;
      readonly expectedRevision: number;
      readonly value: unknown;
    }
  | {
      readonly operation: "delete";
      readonly kind: "collection";
      readonly dataId: string;
      readonly key: string;
      readonly expectedRevision: number;
    };
export interface PublishPlan {
  readonly problems: readonly { readonly itemId: string; readonly problem: Problem }[];
  readonly changes: readonly PublishChange[];
  readonly mutations: readonly CollectionMutation[];
  readonly recordCount: number;
}

/**
 * The guarded writes that make the published records match the drafts. The
 * metadata revision moves with every publish, which is the Engine's signal
 * that rules data changed; an unchanged publish writes nothing.
 */
export function planPublish(
  sets: readonly ItemSet[],
  items: readonly Item[],
  published: ReadonlyMap<string, Stored<Published>>,
  meta: Stored<PublishMeta> | undefined,
  now: number,
): PublishPlan {
  const bySet = new Map(sets.map((entry) => [entry.id, entry]));
  const problems: { itemId: string; problem: Problem }[] = [];
  const desired = new Map<string, Published>();
  for (const itemSet of sets) {
    const failure = setProblem(itemSet);
    if (failure)
      for (const item of items.filter((entry) => entry.setId === itemSet.id))
        problems.push({ itemId: item.id, problem: failure });
  }
  for (const item of items) {
    const failure =
      itemProblem(item) ??
      (item.setId !== "" && !bySet.has(item.setId)
        ? problem("Its set {setId} no longer exists.", { setId: item.setId })
        : undefined);
    if (failure) {
      problems.push({ itemId: item.id, problem: failure });
      continue;
    }
    const published = flatten(bySet.get(item.setId), item);
    const crossing = recordProblem(published.record);
    if (crossing) problems.push({ itemId: item.id, problem: crossing });
    else desired.set(idPrefix + item.id, published);
  }
  const changes: PublishChange[] = [],
    mutations: CollectionMutation[] = [];
  const put = (key: string, value: unknown, expectedRevision: number): void => {
    mutations.push({
      operation: "put",
      kind: "collection",
      dataId: collections.published,
      key,
      expectedRevision,
      value,
    });
  };
  for (const [id, record] of [...desired].sort(([left], [right]) => compare(left, right))) {
    const current = published.get(id);
    if (current && canonical(current.value) === canonical(record)) continue;
    put(id, record, current?.revision ?? 0);
    changes.push({
      id,
      name: record.record.name,
      operation: current && !current.value.withdrawn ? "update" : "add",
    });
  }
  for (const [id, current] of [...published].sort(([left], [right]) => compare(left, right))) {
    if (desired.has(id) || current.value.withdrawn) continue;
    put(id, { ...current.value, withdrawn: true }, current.revision);
    changes.push({ id, name: current.value.record.name, operation: "withdraw" });
  }
  if (mutations.length > 0)
    mutations.push({
      operation: "put",
      kind: "collection",
      dataId: collections.meta,
      key: metaKey,
      expectedRevision: meta?.revision ?? 0,
      value: {
        schemaVersion: 1,
        revision: (meta?.value.revision ?? 0) + 1,
        publishedAt: now,
        recordCount: desired.size,
      } satisfies PublishMeta,
    });
  return { problems, changes, mutations, recordCount: desired.size };
}

// --- Imports ---------------------------------------------------------------

export interface ImportSummary {
  readonly creates: number;
  readonly updates: number;
  readonly skips: number;
  readonly deletes: number;
}
export interface ImportChange {
  readonly collection: string;
  readonly id: string;
  readonly operation: "create" | "update" | "delete";
  readonly label: string;
}
export interface ImportPlan {
  readonly mode: "merge" | "replace";
  readonly summary: ImportSummary;
  readonly changes: readonly ImportChange[];
  readonly mutations: readonly CollectionMutation[];
}
const setDefaults: Record<string, unknown> = {
  description: "",
  curse: "",
  attunement: false,
  bodyPlacements: [],
  tags: [],
  namePrefix: "",
  playerVisible: false,
};
const itemDefaults: Record<string, unknown> = {
  setId: "",
  text: "",
  overrides: {},
  tags: [],
  characterEffects: [],
  playerVisible: false,
  retired: false,
};

/**
 * The import the worker would make, checked locally so the DM sees exactly
 * which entry is wrong. A field an entry omits keeps its stored value, or
 * takes its default for a new draft.
 */
export function planImport(
  document: unknown,
  storedSets: ReadonlyMap<string, Stored<unknown>>,
  storedItems: ReadonlyMap<string, Stored<unknown>>,
  now: number,
): ImportPlan {
  const unknownField = exactFields(
    document,
    ["format", "schemaVersion", "sets", "items"],
    ["generatedAt", "mode"],
  );
  if (unknownField)
    throw new HomebrewError("The document is invalid: {problem}", {
      problem: fill(unknownField.text, unknownField.params),
    });
  const source = document as Record<string, unknown>;
  if (source["format"] !== importFormat || source["schemaVersion"] !== 1)
    throw new HomebrewError('The format must be "{format}" with schemaVersion 1.', {
      format: importFormat,
    });
  const mode = source["mode"] ?? "merge";
  if (mode !== "merge" && mode !== "replace")
    throw new HomebrewError("The mode must be merge or replace.");
  const incomingSets = source["sets"],
    incomingItems = source["items"];
  if (!Array.isArray(incomingSets) || !Array.isArray(incomingItems))
    throw new HomebrewError("The document needs sets and items lists.");
  if (incomingSets.length + incomingItems.length > 2000)
    throw new HomebrewError("An import holds at most 2000 sets and items.");
  let creates = 0,
    updates = 0,
    skips = 0,
    deletes = 0;
  const changes: ImportChange[] = [],
    mutations: CollectionMutation[] = [],
    seen = new Set<string>();
  const add = (
    collection: string,
    id: string,
    label: string,
    value: unknown,
    existing: Stored<unknown> | undefined,
  ): void => {
    if (existing && equivalent(existing.value, value)) {
      skips++;
      return;
    }
    if (existing) updates++;
    else creates++;
    mutations.push({
      operation: "put",
      kind: "collection",
      dataId: collection,
      key: id,
      expectedRevision: existing?.revision ?? 0,
      value,
    });
    changes.push({ collection, id, operation: existing ? "update" : "create", label });
  };
  const finalSets = new Set(mode === "merge" ? storedSets.keys() : []);
  for (const [index, raw] of incomingSets.entries()) {
    const at = `sets[${index}]`;
    const existing = storedSets.get(entryId(raw));
    const value = guarded(at, () => parseSet(normalize(raw, existing, setDefaults, false, now)));
    if (seen.has(`set:${value.id}`))
      throw new HomebrewError("{at}: set {id} appears twice.", { at, id: value.id });
    seen.add(`set:${value.id}`);
    finalSets.add(value.id);
    add(collections.sets, value.id, value.name, value, existing);
  }
  const finalItems = new Map<string, Item>();
  if (mode === "merge")
    for (const [id, stored] of storedItems)
      finalItems.set(
        id,
        guarded(`stored item ${id}`, () => parseItem(stored.value)),
      );
  for (const [index, raw] of incomingItems.entries()) {
    const at = `items[${index}]`;
    const existing = storedItems.get(entryId(raw));
    const value = guarded(at, () => parseItem(normalize(raw, existing, itemDefaults, true, now)));
    if (seen.has(`item:${value.id}`))
      throw new HomebrewError("{at}: item {id} appears twice.", { at, id: value.id });
    seen.add(`item:${value.id}`);
    finalItems.set(value.id, value);
    add(collections.items, value.id, value.name, value, existing);
  }
  for (const id of [...finalItems.keys()].sort(compare)) {
    const item = finalItems.get(id)!;
    if (item.setId !== "" && !finalSets.has(item.setId))
      throw new HomebrewError(
        "Item {id} belongs to set {setId}, which the import neither contains nor keeps.",
        { id, setId: item.setId },
      );
  }
  if (mode === "replace")
    for (const [collection, stored, prefix] of [
      [collections.sets, storedSets, "set:"],
      [collections.items, storedItems, "item:"],
    ] as const)
      for (const id of [...stored.keys()].sort(compare)) {
        if (seen.has(prefix + id)) continue;
        const current = stored.get(id)!,
          name =
            isRecord(current.value) && typeof current.value["name"] === "string"
              ? current.value["name"]
              : id;
        mutations.push({
          operation: "delete",
          kind: "collection",
          dataId: collection,
          key: id,
          expectedRevision: current.revision,
        });
        changes.push({ collection, id, operation: "delete", label: name || id });
        deletes++;
      }
  if (mutations.length > 256)
    throw new HomebrewError(
      "The import changes {count} drafts; split it into files of at most 256 changes.",
      {
        count: mutations.length,
      },
    );
  // Sets come before their items, then each collection by id.
  const rank = (change: ImportChange): number => (change.collection === collections.sets ? 0 : 1);
  changes.sort((left, right) => rank(left) - rank(right) || compare(left.id, right.id));
  return { mode, summary: { creates, updates, skips, deletes }, changes, mutations };
}

function guarded<T>(at: string, read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (error instanceof HomebrewError)
      throw new HomebrewError("{at}: {problem}", { at, problem: error.message });
    throw error;
  }
}
function entryId(raw: unknown): string {
  return isRecord(raw) && typeof raw["id"] === "string" ? raw["id"] : "";
}
function normalize(
  raw: unknown,
  existing: Stored<unknown> | undefined,
  defaults: Record<string, unknown>,
  item: boolean,
  now: number,
): Record<string, unknown> {
  if (!isRecord(raw)) throw new HomebrewError("The entry must be an object.");
  if (raw["schemaVersion"] !== undefined && raw["schemaVersion"] !== 1)
    throw new HomebrewError("schemaVersion must be 1.");
  const base = existing && isRecord(existing.value) ? existing.value : defaults;
  const fields: Record<string, unknown> = { ...base, ...raw };
  // An empty object clears the optional field, as [] clears effects.
  for (const optional of item
    ? ["grants", "attunementPrerequisites", "container", "baseItem"]
    : ["condition"]) {
    const cleared = raw[optional];
    if (isRecord(cleared) && Object.keys(cleared).length === 0) delete fields[optional];
  }
  if (item && raw["characterMechanics"] === undefined)
    fields["characterMechanics"] =
      (Array.isArray(fields["characterEffects"]) && fields["characterEffects"].length > 0) ||
      fields["grants"] !== undefined ||
      (isRecord(fields["baseItem"]) && fields["baseItem"]["bonus"] !== undefined)
        ? "complete"
        : "narrative";
  fields["schemaVersion"] = 1;
  fields["updatedAt"] = now;
  return fields;
}

// --- Export ----------------------------------------------------------------

export function exportDocument(
  sets: readonly ItemSet[],
  items: readonly Item[],
  now: number,
): unknown {
  return {
    format: importFormat,
    schemaVersion: 1,
    generatedAt: now,
    mode: "merge",
    sets: [...sets].sort((left, right) => compare(left.id, right.id)),
    items: [...items].sort((left, right) => compare(left.id, right.id)),
  };
}

// --- Helpers ---------------------------------------------------------------

export function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
/** JSON with sorted keys, so stored and planned values compare by content. */
export function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compare)
      .map((key) => [key, sortKeys(value[key])]),
  );
}
function equivalent(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right)) return false;
  const a = { ...left, updatedAt: 0 },
    b = { ...right, updatedAt: 0 };
  return canonical(a) === canonical(b);
}
