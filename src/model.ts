// Stored shapes and rules for item sets, items, subclasses and published records.
// internal/homebrew (Go) enforces the same rules for imports and serving; the
// shared fixtures in tests/fixtures keep the two in step.

import { grantsSchema } from "./grants-schema.js";
import { schemaProblem, type SchemaNode } from "./schema.js";

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
  subclasses: "homebrew_subclasses",
  publishedSubclasses: "homebrew_published_subclasses",
  feats: "homebrew_feats",
  publishedFeats: "homebrew_published_feats",
  spells: "homebrew_spells",
  publishedSpells: "homebrew_published_spells",
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

function itemSpellProblem(
  value: unknown,
  resources: ReadonlyMap<string, number>,
): Problem | undefined {
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
      const failure = itemSpellProblem(entry, resources);
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

export function exactFields(
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
/** An item is automated exactly when it declares something to automate. */
export function mechanicsOf(
  effects: readonly unknown[],
  grants: unknown,
  baseItem: unknown,
): Mechanics {
  return effects.length > 0 ||
    grants !== undefined ||
    (isRecord(baseItem) && baseItem["bonus"] !== undefined)
    ? "complete"
    : "narrative";
}

/** What an item without a set is, unless its overrides say otherwise. */
export const noSetDefaults = {
  itemType: "Wondrous Item",
  rarity: "Common",
  attunement: false,
} as const satisfies Pick<ItemSet, "itemType" | "rarity" | "attunement">;

/**
 * The overrides that keep an item looking the same when it moves from one set
 * (or none) to another: values it set itself stay, values it took from its
 * old set stay when it leaves for no set, and a value equal to what the new
 * set or the no-set default gives is dropped so the item follows it.
 */
export function moveOverrides(
  overrides: Overrides,
  from: ItemSet | undefined,
  to: ItemSet | undefined,
): Overrides {
  const basics = (itemSet: ItemSet | undefined): Readonly<Record<keyof Overrides, unknown>> => ({
    itemType: itemSet?.itemType ?? noSetDefaults.itemType,
    rarity: itemSet?.rarity ?? noSetDefaults.rarity,
    attunement: itemSet?.attunement ?? noSetDefaults.attunement,
    bodyPlacements: itemSet?.bodyPlacements ?? [],
    weightLb: itemSet?.weightLb,
  });
  const before = basics(from),
    after = basics(to);
  const moved: Record<string, unknown> = {};
  for (const field of overrideFields) {
    const value = overrides[field] ?? (to === undefined ? before[field] : undefined);
    if (value !== undefined && canonical(value) !== canonical(after[field]))
      moved[field] = Array.isArray(value) ? [...(value as readonly unknown[])] : value;
  }
  return moved as Overrides;
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

// --- Subclasses --------------------------------------------------------------

// internal/homebrew/subclass.go enforces the same rules through the contracts;
// the shared fixture tests/fixtures/subclasses.json keeps the two in step.
// Mechanics are the Engine's grants vocabulary, checked against its schema.

/** JSON in the Engine's grants vocabulary; src/schema.ts checks it. */
export type VocabularyValue = Readonly<Record<string, unknown>>;
export interface SubclassFeature {
  readonly id: string;
  readonly level: number;
  readonly name: string;
  readonly text: string;
  /** A one-line summary the sheet shows on the feature, or "". */
  readonly excerpt: string;
  readonly grants?: VocabularyValue;
}
/** A printed per-level value, such as a die that grows. */
export interface TableColumn {
  readonly key: string;
  readonly name: string;
  readonly progression: readonly { readonly level: number; readonly value: number | string }[];
}
/** A third caster's own spellcasting, with its per-level table. */
export interface SubclassSpellcasting {
  readonly ability: Ability;
  readonly type: "third";
  readonly startLevel: number;
  readonly prepares: "list" | "spellbook";
  readonly spellListClassId: string;
  readonly levelReplacements?: number;
  readonly ritual?: boolean;
}
export interface CastingRow {
  readonly level: number;
  readonly cantripsKnown: number;
  readonly preparedSpells: number;
  readonly spellSlots: readonly number[];
}
export interface Subclass {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly name: string;
  /** The D&D class it belongs to, such as fighter. */
  readonly classId: string;
  readonly subclassLevel: number;
  readonly text: string;
  readonly excerpt: string;
  /** Subclass spells (SpellGrantDecl with a level), such as domain spells. */
  readonly spells: readonly VocabularyValue[];
  readonly grants?: VocabularyValue;
  /** Pools such as superiority dice (ResourceGrant). */
  readonly classResources: readonly VocabularyValue[];
  readonly tableColumns: readonly TableColumn[];
  readonly spellcasting?: SubclassSpellcasting;
  readonly progression?: readonly CastingRow[];
  readonly features: readonly SubclassFeature[];
  readonly updatedAt: number;
}
/** One served subclass: its subclass record first, then its feature records. */
export interface PublishedSubclass {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly subclassId: string;
  readonly classId: string;
  readonly withdrawn: boolean;
  readonly records: readonly VocabularyValue[];
}

export const maxFeatures = 40;
const subclassFields = [
  "id",
  "schemaVersion",
  "name",
  "classId",
  "subclassLevel",
  "text",
  "excerpt",
  "spells",
  "classResources",
  "tableColumns",
  "features",
  "updatedAt",
] as const;
const featureFields = ["id", "level", "name", "text", "excerpt"] as const;
const vocabulary = (name: string): SchemaNode => ({ $ref: `#/$defs/grants/$defs/${name}` });
export const spellGrantSchema = vocabulary("SpellGrantDecl");
export const resourceGrantSchema = vocabulary("ResourceGrant");

const isLevel = (value: unknown): value is number => isInteger(value, 1, 20);
/** A summary line: empty, or one line of at most 300 characters. */
export function excerptProblem(value: unknown): Problem | undefined {
  return value === "" ||
    (typeof value === "string" && length(value) <= 300 && /^\S[^\n\r]*$/u.test(value))
    ? undefined
    : problem("A summary is one line of at most 300 characters.");
}
function vocabularyProblem(node: SchemaNode, value: unknown, path: string): Problem | undefined {
  const failure = schemaProblem(node, value, path);
  return failure ? problem(failure.text, failure.params) : undefined;
}
function listProblem(
  value: unknown,
  limit: number,
  path: string,
  check: (entry: unknown, path: string) => Problem | undefined,
): Problem | undefined {
  if (!Array.isArray(value) || value.length > limit)
    return problem("{path} lists at most {count} entries.", { path, count: limit });
  for (const [index, entry] of value.entries()) {
    const failure = check(entry, `${path}[${index}]`);
    if (failure) return failure;
  }
  return undefined;
}
function tableColumnProblem(value: unknown, path: string): Problem | undefined {
  const shape = exactFields(value, ["key", "name", "progression"]);
  if (shape) return shape;
  const column = value as Json;
  if (!validId(column["key"]))
    return problem("{path}: the key must be lowercase words joined by hyphens.", { path });
  if (!validName(column["name"]))
    return problem("{path}: give the column a one-line name.", { path });
  const rows = column["progression"];
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 20)
    return problem("{path}: list 1 to 20 levels.", { path });
  for (const row of rows) {
    const rowShape = exactFields(row, ["level", "value"]);
    if (rowShape) return rowShape;
    const entry = row as Json;
    const value = entry["value"];
    if (
      !isLevel(entry["level"]) ||
      !(
        isInteger(value, -100, 100) ||
        (typeof value === "string" && /^[1-9][0-9]?d[1-9][0-9]?$/u.test(value))
      )
    )
      return problem("{path}: each level gives a whole number or a die such as 1d8.", { path });
  }
  return undefined;
}
function spellcastingProblem(value: unknown): Problem | undefined {
  const shape = exactFields(
    value,
    ["ability", "type", "startLevel", "prepares", "spellListClassId"],
    ["levelReplacements", "ritual"],
  );
  if (shape) return shape;
  const casting = value as Json;
  const valid =
    oneOf(abilities, casting["ability"]) &&
    casting["type"] === "third" &&
    isLevel(casting["startLevel"]) &&
    (casting["prepares"] === "list" || casting["prepares"] === "spellbook") &&
    validId(casting["spellListClassId"]) &&
    (casting["levelReplacements"] === undefined || isInteger(casting["levelReplacements"], 0, 1)) &&
    (casting["ritual"] === undefined || typeof casting["ritual"] === "boolean");
  return valid
    ? undefined
    : problem(
        "Spellcasting needs an ability, a start level, how spells are prepared and a class spell list.",
      );
}
function castingRowProblem(value: unknown, path: string): Problem | undefined {
  const shape = exactFields(value, ["level", "cantripsKnown", "preparedSpells", "spellSlots"]);
  if (shape) return shape;
  const row = value as Json;
  const slots = row["spellSlots"];
  return isLevel(row["level"]) &&
    isInteger(row["cantripsKnown"], 0, 20) &&
    isInteger(row["preparedSpells"], 0, 40) &&
    Array.isArray(slots) &&
    slots.length <= 9 &&
    slots.every((count) => isInteger(count, 0, 9))
    ? undefined
    : problem("{path}: give the level, cantrips, prepared spells and slots per spell level.", {
        path,
      });
}
function featureProblem(value: unknown, path: string): Problem | undefined {
  const shape = exactFields(value, featureFields, ["grants"]);
  if (shape) return problem("{path}: {problem}", { path, problem: fill(shape.text, shape.params) });
  const feature = value as SubclassFeature;
  if (!validId(feature.id))
    return problem("{path}: the id must be lowercase words joined by hyphens.", { path });
  if (!isLevel(feature.level))
    return problem("{path}: the level is a whole number from 1 to 20.", { path });
  if (!validName(feature.name))
    return problem("{path}: give the feature a one-line name of at most 120 characters.", {
      path,
    });
  if (!validMarkdown(feature.text))
    return problem("Descriptions are limited to {count} characters.", { count: maxMarkdown });
  return (
    excerptProblem(feature.excerpt) ??
    (feature.grants === undefined
      ? undefined
      : vocabularyProblem(grantsSchema, feature.grants, `${path}.grants`))
  );
}

export function subclassProblem(value: Subclass): Problem | undefined {
  if (value.schemaVersion !== 1) return problem("Unsupported subclass version.");
  if (!validId(value.id)) return problem("The id must be lowercase words joined by hyphens.");
  if (!validName(value.name))
    return problem("Give the subclass a one-line name of at most 120 characters.");
  if (!validId(value.classId)) return problem("Choose the class this subclass belongs to.");
  if (!isLevel(value.subclassLevel))
    return problem("The subclass level is a whole number from 1 to 20.");
  if (!validMarkdown(value.text))
    return problem("Descriptions are limited to {count} characters.", { count: maxMarkdown });
  if (!Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0)
    return problem("The subclass is malformed.");
  if ((value.spellcasting === undefined) !== (value.progression === undefined))
    return problem("Spellcasting and its table go together.");
  const features = value.features;
  if (
    Array.isArray(features) &&
    !distinct(features.map((feature) => (isRecord(feature) ? feature["id"] : undefined)))
  )
    return problem("Each feature needs its own id.");
  return (
    excerptProblem(value.excerpt) ??
    listProblem(value.spells, 30, "spells", (entry, path) =>
      vocabularyProblem(spellGrantSchema, entry, path),
    ) ??
    (value.grants === undefined
      ? undefined
      : vocabularyProblem(grantsSchema, value.grants, "grants")) ??
    listProblem(value.classResources, 10, "classResources", (entry, path) =>
      vocabularyProblem(resourceGrantSchema, entry, path),
    ) ??
    listProblem(value.tableColumns, 10, "tableColumns", tableColumnProblem) ??
    (value.spellcasting === undefined ? undefined : spellcastingProblem(value.spellcasting)) ??
    (value.progression === undefined
      ? undefined
      : value.progression.length < 1
        ? problem("Spellcasting and its table go together.")
        : listProblem(value.progression, 20, "progression", castingRowProblem)) ??
    listProblem(features, maxFeatures, "features", featureProblem)
  );
}

/** Checks an untrusted value as a stored subclass draft and returns it. */
export function parseSubclass(value: unknown): Subclass {
  const failure =
    exactFields(value, subclassFields, ["grants", "spellcasting", "progression"]) ??
    subclassProblem(value as unknown as Subclass);
  if (failure) throw new HomebrewError(failure.text, failure.params);
  return value as unknown as Subclass;
}

export function newSubclass(name: string, id: string, classId: string, now: number): Subclass {
  return {
    id,
    schemaVersion: 1,
    name,
    classId,
    subclassLevel: 3,
    text: "",
    excerpt: "",
    spells: [],
    classResources: [],
    tableColumns: [],
    features: [],
    updatedAt: now,
  };
}

/** A feature's record id: ids hold no dot, so two subclasses never collide. */
export function featureRecordId(subclassRecordId: string, featureId: string): string {
  return `${subclassRecordId}.${featureId}`;
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The subclass and feature records the Engine reads, features by level. */
export function flattenSubclass(subclass: Subclass): PublishedSubclass {
  const id = idPrefix + subclass.id;
  const features = [...subclass.features].sort((left, right) => left.level - right.level);
  const record: Record<string, unknown> = {
    kind: "subclass",
    id,
    name: subclass.name,
    edition: "2024",
    book: "homebrew",
    classId: subclass.classId,
    subclassLevel: subclass.subclassLevel,
    features: features.map((feature) => ({
      level: feature.level,
      id: feature.id,
      name: feature.name,
    })),
    spells: copy(subclass.spells),
    ...(subclass.grants ? { grants: copy(subclass.grants) } : {}),
    ...(subclass.classResources.length > 0
      ? { classResources: copy(subclass.classResources) }
      : {}),
    ...(subclass.tableColumns.length > 0 ? { tableColumns: copy(subclass.tableColumns) } : {}),
    ...(subclass.spellcasting && subclass.progression
      ? { spellcasting: copy(subclass.spellcasting), progression: copy(subclass.progression) }
      : {}),
    ...(subclass.excerpt ? { excerpt: subclass.excerpt } : {}),
    text: subclass.text,
  };
  return {
    id,
    schemaVersion: 1,
    subclassId: subclass.id,
    classId: subclass.classId,
    withdrawn: false,
    records: [
      record,
      ...features.map((feature) => ({
        kind: "feature",
        id: featureRecordId(id, feature.id),
        name: feature.name,
        edition: "2024",
        book: "homebrew",
        classId: subclass.classId,
        subclassId: id,
        level: feature.level,
        localId: feature.id,
        ...(feature.grants ? { grants: copy(feature.grants) } : {}),
        ...(feature.excerpt ? { excerpt: feature.excerpt } : {}),
        text: feature.text,
      })),
    ],
  };
}

/** Checks an untrusted value as a published subclass and returns it. */
export function parsePublishedSubclass(value: unknown): PublishedSubclass {
  const shape = exactFields(value, [
    "id",
    "schemaVersion",
    "subclassId",
    "classId",
    "withdrawn",
    "records",
  ]);
  if (shape) throw new HomebrewError(shape.text, shape.params);
  const published = value as PublishedSubclass;
  const records = published.records;
  const valid =
    published.schemaVersion === 1 &&
    validId(published.subclassId) &&
    published.id === idPrefix + published.subclassId &&
    validId(published.classId) &&
    typeof published.withdrawn === "boolean" &&
    Array.isArray(records) &&
    records.length >= 1 &&
    records.length <= maxFeatures + 1 &&
    records.every(
      (record, index) =>
        isRecord(record) &&
        record["classId"] === published.classId &&
        validName(record["name"]) &&
        typeof record["text"] === "string" &&
        (index === 0
          ? record["kind"] === "subclass" && record["id"] === published.id
          : record["kind"] === "feature" &&
            record["subclassId"] === published.id &&
            typeof record["localId"] === "string" &&
            record["id"] === featureRecordId(published.id, record["localId"])) &&
        (record["grants"] === undefined ||
          schemaProblem(grantsSchema, record["grants"], "grants") === undefined),
    ) &&
    distinct(records.map((record) => record["id"]));
  if (!valid) throw new HomebrewError("A published subclass is invalid.");
  return published;
}

// --- Feats -------------------------------------------------------------------

// internal/homebrew/feat.go enforces the same rules through the contracts; the
// shared fixture tests/fixtures/feats.json keeps the two in step. Grants are
// the Engine's vocabulary, as for subclasses.

export const featCategories = ["origin", "general", "fightingStyle", "epicBoon"] as const;
export type FeatCategory = (typeof featCategories)[number];
/** The Engine's structured prerequisite (prerequisiteMatches); {} is none. */
export type Prerequisite = Readonly<Record<string, unknown>>;
/** Once, any number of times, or once per value of one of its own choices. */
export type Repeatable = boolean | { readonly by: "choice"; readonly choice: string };
export interface Feat {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly name: string;
  readonly category: FeatCategory;
  readonly prerequisites: Prerequisite;
  readonly repeatable: Repeatable;
  readonly text: string;
  /** A one-line summary the sheet shows on the feat, or "". */
  readonly excerpt: string;
  readonly grants?: VocabularyValue;
  readonly updatedAt: number;
}
/** One served feat; withdrawn like an item when its draft is deleted. */
export interface PublishedFeat {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly featId: string;
  readonly withdrawn: boolean;
  readonly record: VocabularyValue;
}
const featFields = [
  "id",
  "schemaVersion",
  "name",
  "category",
  "prerequisites",
  "repeatable",
  "text",
  "excerpt",
  "updatedAt",
] as const;
/** The Fighting Style features the printed fighting style feats require. */
export const fightingStyleFeatures = [
  "fighter-fighting-style",
  "paladin-fighting-style",
  "ranger-fighting-style",
] as const;
export const weaponTrainings = ["simple", "martial"] as const;
export const armorTrainings = ["light", "medium", "heavy", "shield"] as const;
/** How deep any and all may nest. */
const maxPrerequisiteDepth = 3;
/** A record id another prerequisite names: a feat or feature, possibly homebrew. */
const validRecordRef = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 132 && /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/u.test(value);
/** A feat category, as records spell it: origin, fightingStyle. */
const validCategory = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 40 && /^[a-z][A-Za-z0-9]*$/u.test(value);

/**
 * The predicates the Engine evaluates. Anything else needs the DM to waive it
 * on each character there, so drafts may not declare it.
 */
export function prerequisiteProblem(
  value: unknown,
  path = "prerequisites",
  depth = 0,
): Problem | undefined {
  if (!isRecord(value)) return problem("{path} must be a group of fields.", { path });
  if (depth > 0 && Object.keys(value).length === 0)
    return problem("{path} needs at least one requirement.", { path });
  for (const [key, entry] of Object.entries(value)) {
    const at = `${path}.${key}`;
    let valid: boolean;
    switch (key) {
      case "level":
        valid = isLevel(entry);
        break;
      case "abilities":
        valid =
          isRecord(entry) &&
          Object.keys(entry).length > 0 &&
          Object.entries(entry).every(
            ([ability, score]) => oneOf(abilities, ability) && isInteger(score, 1, 30),
          );
        break;
      case "classes":
        valid =
          isRecord(entry) &&
          Object.keys(entry).length > 0 &&
          Object.entries(entry).every(([classId, level]) => validId(classId) && isLevel(level));
        break;
      case "all":
      case "any": {
        if (depth >= maxPrerequisiteDepth || !Array.isArray(entry) || entry.length === 0)
          return problem("{path} lists 1 to 20 requirements, nested at most {count} deep.", {
            path: at,
            count: maxPrerequisiteDepth,
          });
        valid = entry.length <= 20;
        for (const [index, child] of entry.entries()) {
          const failure = prerequisiteProblem(child, `${at}[${index}]`, depth + 1);
          if (failure) return failure;
        }
        break;
      }
      case "spellcaster":
      case "spellcastingFeature":
        valid = entry === true;
        break;
      case "feat":
      case "feature":
        valid = validRecordRef(entry);
        break;
      case "featCategory":
      case "withoutFeatCategory":
        valid = validCategory(entry);
        break;
      case "weaponTraining":
        valid = oneOf(weaponTrainings, entry);
        break;
      case "armorTraining":
        valid = oneOf(armorTrainings, entry);
        break;
      default:
        return problem("{path} does not take {field}.", { path, field: key });
    }
    if (!valid) return problem("{path} is not a requirement the Engine can check.", { path: at });
  }
  return undefined;
}

const abilityWords: Readonly<Record<string, string>> = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};
export const featCategoryNames: Readonly<Record<FeatCategory, string>> = {
  origin: "Origin Feat",
  general: "General Feat",
  fightingStyle: "Fighting Style Feat",
  epicBoon: "Epic Boon Feat",
};
const listWords = (parts: readonly string[], joiner: string): string =>
  parts.length <= 2
    ? parts.join(` ${joiner} `)
    : `${parts.slice(0, -1).join(", ")}, ${joiner} ${parts.at(-1)}`;
/** "Strength or Dexterity 13+" for branches that differ only in their ability. */
function anyWords(branches: readonly Prerequisite[]): string {
  const single = branches.map((branch) =>
    isRecord(branch["abilities"]) && Object.keys(branch["abilities"]).length === 1
      ? Object.entries(branch["abilities"])[0]!
      : undefined,
  );
  const first = branches[0]?.["level"],
    level = typeof first === "number" ? first : undefined;
  if (
    single.every((entry) => entry !== undefined) &&
    single.every((entry) => entry[1] === single[0]![1]) &&
    branches.every(
      (branch) =>
        branch["level"] === level && Object.keys(branch).length === (level === undefined ? 1 : 2),
    )
  ) {
    const names = listWords(
      single.map((entry) => abilityWords[entry![0]] ?? entry![0]),
      "or",
    );
    const scores = `${names} ${String(single[0]![1])}+`;
    return level === undefined ? scores : `Level ${level}+, ${scores}`;
  }
  if (
    branches.every(
      (branch) =>
        Object.keys(branch).length === 1 &&
        typeof branch["feature"] === "string" &&
        branch["feature"].endsWith("-fighting-style"),
    )
  )
    return "Fighting Style Feature";
  return listWords(branches.map(prerequisiteWords), "or");
}
const recordName = (id: string): string => titleOf(id.replace(/^hb\./u, "").replaceAll(".", "-"));
/** A prerequisite as printed after "Prerequisite:", such as "Level 4+, Strength 13+". */
export function prerequisiteWords(value: Prerequisite): string {
  const parts: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    switch (key) {
      case "level":
        parts.push(`Level ${String(entry)}+`);
        break;
      case "abilities":
        if (isRecord(entry))
          parts.push(
            ...Object.entries(entry).map(
              ([ability, score]) => `${abilityWords[ability] ?? ability} ${String(score)}+`,
            ),
          );
        break;
      case "classes":
        if (isRecord(entry))
          parts.push(
            ...Object.entries(entry).map(
              ([classId, level]) => `${titleOf(classId)} Level ${String(level)}+`,
            ),
          );
        break;
      case "any":
        if (Array.isArray(entry)) parts.push(anyWords(entry.filter(isRecord)));
        break;
      case "all":
        if (Array.isArray(entry)) parts.push(...entry.filter(isRecord).map(prerequisiteWords));
        break;
      case "spellcaster":
        parts.push("The ability to cast at least one spell");
        break;
      case "spellcastingFeature":
        parts.push("Spellcasting or Pact Magic Feature");
        break;
      case "feat":
        parts.push(`${recordName(String(entry))} Feat`);
        break;
      case "feature":
        parts.push(`${recordName(String(entry))} Feature`);
        break;
      case "featCategory":
      case "withoutFeatCategory": {
        const name = featCategoryNames[entry as FeatCategory] ?? `${titleOf(String(entry))} Feat`;
        parts.push(key === "featCategory" ? `Any ${name}` : `No ${name}`);
        break;
      }
      case "weaponTraining":
        parts.push(`${titleOf(String(entry))} Weapon Training`);
        break;
      case "armorTraining":
        parts.push(
          entry === "shield" ? "Shield Training" : `${titleOf(String(entry))} Armor Training`,
        );
        break;
    }
  }
  return parts.join(", ");
}

function repeatableProblem(value: unknown, grants: unknown): Problem | undefined {
  if (typeof value === "boolean") return undefined;
  const shape = exactFields(value, ["by", "choice"]);
  if (shape || (value as Json)["by"] !== "choice")
    return problem("A feat is taken once, any number of times, or once per choice.");
  // The Engine needs one enumerated choice of the feat itself, picked once.
  const choice = (value as Json)["choice"];
  const declared =
    isRecord(grants) && Array.isArray(grants["choices"])
      ? grants["choices"].find((entry) => isRecord(entry) && entry["id"] === choice)
      : undefined;
  return isRecord(declared) &&
    declared["type"] === "enumerated" &&
    declared["count"] === 1 &&
    Array.isArray(declared["from"]) &&
    declared["from"].length > 0
    ? undefined
    : problem("Repeating once per choice needs one of the feat's choices, of one listed value.");
}

export function featProblem(value: Feat): Problem | undefined {
  if (value.schemaVersion !== 1) return problem("Unsupported feat version.");
  if (!validId(value.id)) return problem("The id must be lowercase words joined by hyphens.");
  if (!validName(value.name))
    return problem("Give the feat a one-line name of at most 120 characters.");
  if (!oneOf(featCategories, value.category)) return problem("Choose the feat's category.");
  if (!validMarkdown(value.text))
    return problem("Descriptions are limited to {count} characters.", { count: maxMarkdown });
  if (!Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0)
    return problem("The feat is malformed.");
  return (
    excerptProblem(value.excerpt) ??
    prerequisiteProblem(value.prerequisites) ??
    (value.grants === undefined
      ? undefined
      : vocabularyProblem(grantsSchema, value.grants, "grants")) ??
    repeatableProblem(value.repeatable, value.grants)
  );
}

/** Checks an untrusted value as a stored feat draft and returns it. */
export function parseFeat(value: unknown): Feat {
  const failure =
    exactFields(value, featFields, ["grants"]) ?? featProblem(value as unknown as Feat);
  if (failure) throw new HomebrewError(failure.text, failure.params);
  return value as unknown as Feat;
}

export function newFeat(name: string, id: string, now: number): Feat {
  return {
    id,
    schemaVersion: 1,
    name,
    category: "general",
    prerequisites: { level: 4 },
    repeatable: false,
    text: "",
    excerpt: "",
    grants: { abilityScoreIncrease: { choose: 1, amount: 1, from: [...abilities] } },
    updatedAt: now,
  };
}

/** The feat record the Engine reads, its text opening with category and prerequisite. */
export function flattenFeat(feat: Feat): PublishedFeat {
  const id = idPrefix + feat.id;
  const requirement = prerequisiteWords(feat.prerequisites);
  const header = `*${featCategoryNames[feat.category]}${requirement ? ` (Prerequisite: ${requirement})` : ""}*`;
  return {
    id,
    schemaVersion: 1,
    featId: feat.id,
    withdrawn: false,
    record: {
      kind: "feat",
      id,
      name: feat.name,
      edition: "2024",
      book: "homebrew",
      category: feat.category,
      prerequisites: copy(feat.prerequisites),
      repeatable: copy(feat.repeatable),
      ...(feat.grants ? { grants: copy(feat.grants) } : {}),
      ...(feat.excerpt ? { excerpt: feat.excerpt } : {}),
      text: [header, feat.text.trim()].filter((part) => part !== "").join("\n\n"),
    },
  };
}

/** Checks an untrusted value as a published feat and returns it. */
export function parsePublishedFeat(value: unknown): PublishedFeat {
  const shape = exactFields(value, ["id", "schemaVersion", "featId", "withdrawn", "record"]);
  if (shape) throw new HomebrewError(shape.text, shape.params);
  const published = value as PublishedFeat;
  const record = published.record as unknown;
  const recordShape = exactFields(
    record,
    ["kind", "id", "name", "edition", "book", "category", "prerequisites", "repeatable", "text"],
    ["grants", "excerpt"],
  );
  const served = record as Json;
  const valid =
    recordShape === undefined &&
    published.schemaVersion === 1 &&
    validId(published.featId) &&
    published.id === idPrefix + published.featId &&
    typeof published.withdrawn === "boolean" &&
    served["kind"] === "feat" &&
    served["id"] === published.id &&
    validName(served["name"]) &&
    served["edition"] === "2024" &&
    served["book"] === "homebrew" &&
    oneOf(featCategories, served["category"]) &&
    typeof served["text"] === "string" &&
    prerequisiteProblem(served["prerequisites"]) === undefined &&
    repeatableProblem(served["repeatable"], served["grants"]) === undefined &&
    (served["excerpt"] === undefined || excerptProblem(served["excerpt"]) === undefined) &&
    (served["grants"] === undefined ||
      schemaProblem(grantsSchema, served["grants"], "grants") === undefined);
  if (!valid) throw new HomebrewError("A published feat is invalid.");
  return published;
}

// --- Spells ------------------------------------------------------------------

// internal/homebrew/spell.go enforces the same rules through the contracts; the
// shared fixture tests/fixtures/spells.json keeps the two in step. A spell is
// the Compendium's spell record, and its classes put it on their spell lists.

export type SpellSchoolName = Capitalize<SpellSchool>;
/** Schools as spell records name them: Evocation. */
export const spellSchoolNames = spellSchools.map((school) =>
  titleOf(school),
) as readonly SpellSchoolName[];
export const spellComponents = ["V", "S", "M"] as const;
export type SpellComponent = (typeof spellComponents)[number];
/** How a concentration spell's duration starts, as printed. */
export const concentrationPrefix = "Concentration, up to ";
/** Casting time, range, material and duration are one line of at most this. */
export const maxSpellLine = 300;
export interface Spell {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly name: string;
  /** 0 for a cantrip, up to 9. */
  readonly level: number;
  readonly school: SpellSchoolName;
  /** The class ids whose spell lists include it. */
  readonly classes: readonly string[];
  readonly ritual: boolean;
  readonly concentration: boolean;
  readonly castingTime: string;
  readonly range: string;
  readonly components: readonly SpellComponent[];
  /** The material component's material, or "" without one. */
  readonly material: string;
  /** "Concentration, up to 1 minute" for a concentration spell. */
  readonly duration: string;
  readonly text: string;
  readonly updatedAt: number;
}
/** The Compendium's spell record with an `hb.` id; material only with an M component. */
export interface SpellRecord {
  readonly kind: "spell";
  readonly id: string;
  readonly name: string;
  readonly edition: "2024";
  readonly book: "homebrew";
  readonly level: number;
  readonly school: SpellSchoolName;
  readonly classes: readonly string[];
  readonly ritual: boolean;
  readonly concentration: boolean;
  readonly castingTime: string;
  readonly range: string;
  readonly components: readonly SpellComponent[];
  readonly material?: string;
  readonly duration: string;
  readonly text: string;
}
/** One served spell; withdrawn like an item when its draft is deleted. */
export interface PublishedSpell {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly spellId: string;
  readonly withdrawn: boolean;
  readonly record: SpellRecord;
}
const spellFields = [
  "id",
  "schemaVersion",
  "name",
  "level",
  "school",
  "classes",
  "ritual",
  "concentration",
  "castingTime",
  "range",
  "components",
  "material",
  "duration",
  "text",
  "updatedAt",
] as const;
const spellLines: readonly (readonly [string, Problem])[] = [
  [
    "castingTime",
    problem("Give the spell's casting time on one line of at most {count} characters.", {
      count: maxSpellLine,
    }),
  ],
  [
    "range",
    problem("Give the spell's range on one line of at most {count} characters.", {
      count: maxSpellLine,
    }),
  ],
  [
    "duration",
    problem("Give the spell's duration on one line of at most {count} characters.", {
      count: maxSpellLine,
    }),
  ],
];

/** The rules a draft and its record share; `material` is "" for none. */
function spellRulesProblem(value: Json, material: string): Problem | undefined {
  if (!isInteger(value["level"], 0, 9))
    return problem("Choose the spell's level: 0 for a cantrip, up to 9.");
  if (!oneOf(spellSchoolNames, value["school"])) return problem("Choose the spell's school.");
  const classes = value["classes"];
  if (
    !Array.isArray(classes) ||
    classes.length > 20 ||
    !classes.every(validId) ||
    !distinct(classes)
  )
    return problem("List each class at most once, by its id.");
  if (typeof value["ritual"] !== "boolean" || typeof value["concentration"] !== "boolean")
    return problem("The spell is malformed.");
  for (const [field, failure] of spellLines)
    if (!validName(value[field], maxSpellLine)) return failure;
  const components = value["components"];
  if (
    !Array.isArray(components) ||
    components.length === 0 ||
    !components.every((entry) => oneOf(spellComponents, entry)) ||
    !distinct(components)
  )
    return problem("Choose the spell's components: V, S or M, each at most once.");
  if (components.includes("M") && !validName(material, maxSpellLine))
    return problem("Name the material of the material (M) component on one line.");
  if (!components.includes("M") && material !== "")
    return problem("Only a spell with a material (M) component names a material.");
  const duration = value["duration"] as string;
  if (value["concentration"] === true && !/^Concentration, up to \S/u.test(duration))
    return problem('A concentration spell\'s duration reads "Concentration, up to 1 minute".');
  if (value["concentration"] === false && duration.startsWith("Concentration"))
    return problem('Only a concentration spell\'s duration starts with "Concentration".');
  return undefined;
}

export function spellProblem(value: Spell): Problem | undefined {
  if (value.schemaVersion !== 1) return problem("Unsupported spell version.");
  if (!validId(value.id)) return problem("The id must be lowercase words joined by hyphens.");
  if (!validName(value.name))
    return problem("Give the spell a one-line name of at most 120 characters.");
  if (!validMarkdown(value.text))
    return problem("Descriptions are limited to {count} characters.", { count: maxMarkdown });
  if (
    !Number.isSafeInteger(value.updatedAt) ||
    value.updatedAt < 0 ||
    typeof value.material !== "string"
  )
    return problem("The spell is malformed.");
  return spellRulesProblem(value as unknown as Json, value.material);
}

/** Checks an untrusted value as a stored spell draft and returns it. */
export function parseSpell(value: unknown): Spell {
  const failure = exactFields(value, spellFields) ?? spellProblem(value as unknown as Spell);
  if (failure) throw new HomebrewError(failure.text, failure.params);
  return value as unknown as Spell;
}

export function newSpell(name: string, id: string, now: number): Spell {
  return {
    id,
    schemaVersion: 1,
    name,
    level: 1,
    school: "Evocation",
    classes: [],
    ritual: false,
    concentration: false,
    castingTime: "Action",
    range: "60 feet",
    components: ["V", "S"],
    material: "",
    duration: "Instantaneous",
    text: "",
    updatedAt: now,
  };
}

/** The line under a spell's name, as printed: "Level 3 Evocation (Sorcerer, Wizard)", classes by id. */
export function spellHeader(spell: Pick<Spell, "level" | "school" | "classes">): string {
  const kind =
    spell.level === 0 ? `${spell.school} Cantrip` : `Level ${spell.level} ${spell.school}`;
  const classes = [...spell.classes].sort(compare).map((id) => titleOf(id));
  return classes.length > 0 ? `${kind} (${classes.join(", ")})` : kind;
}

/**
 * The spell record the Engine reads, its text opening with the printed stat
 * block. Classes and components take a fixed order, so the order a form or a
 * file lists them in never changes the record.
 */
export function flattenSpell(spell: Spell): PublishedSpell {
  const id = idPrefix + spell.id;
  const components = spellComponents.filter((component) => spell.components.includes(component));
  const material = components.includes("M");
  // Two trailing spaces break the line without starting a paragraph.
  const block = [
    `*${spellHeader(spell)}*`,
    `**Casting Time:** ${spell.castingTime}${spell.ritual ? " or Ritual" : ""}`,
    `**Range:** ${spell.range}`,
    `**Components:** ${components.join(", ")}${material ? ` (${spell.material})` : ""}`,
    `**Duration:** ${spell.duration}`,
  ].join("  \n");
  return {
    id,
    schemaVersion: 1,
    spellId: spell.id,
    withdrawn: false,
    record: {
      kind: "spell",
      id,
      name: spell.name,
      edition: "2024",
      book: "homebrew",
      level: spell.level,
      school: spell.school,
      classes: [...spell.classes].sort(compare),
      ritual: spell.ritual,
      concentration: spell.concentration,
      castingTime: spell.castingTime,
      range: spell.range,
      components,
      ...(material ? { material: spell.material } : {}),
      duration: spell.duration,
      text: [block, spell.text.trim()].filter((part) => part !== "").join("\n\n"),
    },
  };
}

/** Checks an untrusted value as a published spell and returns it. */
export function parsePublishedSpell(value: unknown): PublishedSpell {
  const shape = exactFields(value, ["id", "schemaVersion", "spellId", "withdrawn", "record"]);
  if (shape) throw new HomebrewError(shape.text, shape.params);
  const published = value as PublishedSpell;
  const record = published.record as unknown;
  const recordShape = exactFields(
    record,
    [
      "kind",
      "id",
      "name",
      "edition",
      "book",
      "level",
      "school",
      "classes",
      "ritual",
      "concentration",
      "castingTime",
      "range",
      "components",
      "duration",
      "text",
    ],
    ["material"],
  );
  const served = record as Json;
  const material = served["material"];
  const valid =
    recordShape === undefined &&
    published.schemaVersion === 1 &&
    validId(published.spellId) &&
    published.id === idPrefix + published.spellId &&
    typeof published.withdrawn === "boolean" &&
    served["kind"] === "spell" &&
    served["id"] === published.id &&
    validName(served["name"]) &&
    served["edition"] === "2024" &&
    served["book"] === "homebrew" &&
    typeof served["text"] === "string" &&
    (material === undefined || (typeof material === "string" && material !== "")) &&
    spellRulesProblem(served, typeof material === "string" ? material : "") === undefined;
  if (!valid) throw new HomebrewError("A published spell is invalid.");
  return published;
}

// --- Publishing ------------------------------------------------------------

/** Set defaults, per-item overrides and the item's own text, as one record. */
export function flatten(itemSet: ItemSet | undefined, item: Item): Published {
  const overrides = item.overrides;
  const itemType = overrides.itemType ?? itemSet?.itemType ?? noSetDefaults.itemType,
    rarity = overrides.rarity ?? itemSet?.rarity ?? noSetDefaults.rarity,
    attunement = overrides.attunement ?? itemSet?.attunement ?? noSetDefaults.attunement,
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
/**
 * A guarded put for each draft `change` alters, stamped `now`; an unchanged
 * draft writes nothing. Several drafts then change in one transaction.
 */
export function draftPuts<T extends { readonly id: string; readonly updatedAt: number }>(
  collection: string,
  drafts: readonly Stored<T>[],
  change: (draft: T) => T,
  now: number,
): CollectionMutation[] {
  return drafts.flatMap((stored): CollectionMutation[] => {
    const next = change(stored.value);
    if (canonical(next) === canonical(stored.value)) return [];
    return [
      {
        operation: "put",
        kind: "collection",
        dataId: collection,
        key: stored.value.id,
        expectedRevision: stored.revision,
        value: { ...next, updatedAt: now },
      },
    ];
  });
}
/** A guarded delete for each draft. */
export function draftDeletes(
  collection: string,
  drafts: readonly Stored<{ readonly id: string }>[],
): CollectionMutation[] {
  return drafts.map((stored) => ({
    operation: "delete",
    kind: "collection",
    dataId: collection,
    key: stored.value.id,
    expectedRevision: stored.revision,
  }));
}

export interface PublishPlan {
  /** `itemId` names the draft: an item, a subclass, a feat or a spell. */
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
  subclasses: readonly Subclass[] = [],
  publishedSubclasses: ReadonlyMap<string, Stored<PublishedSubclass>> = new Map(),
  feats: readonly Feat[] = [],
  publishedFeats: ReadonlyMap<string, Stored<PublishedFeat>> = new Map(),
  spells: readonly Spell[] = [],
  publishedSpells: ReadonlyMap<string, Stored<PublishedSpell>> = new Map(),
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
  const desiredSubclasses = new Map<string, PublishedSubclass>();
  for (const subclass of subclasses) {
    const failure = subclassProblem(subclass);
    if (failure) problems.push({ itemId: subclass.id, problem: failure });
    else desiredSubclasses.set(idPrefix + subclass.id, flattenSubclass(subclass));
  }
  const putSubclass = (key: string, value: unknown, expectedRevision: number): void => {
    mutations.push({
      operation: "put",
      kind: "collection",
      dataId: collections.publishedSubclasses,
      key,
      expectedRevision,
      value,
    });
  };
  const nameOf = (published: PublishedSubclass): string =>
    typeof published.records[0]?.["name"] === "string"
      ? published.records[0]["name"]
      : published.id;
  for (const [id, value] of [...desiredSubclasses].sort(([left], [right]) =>
    compare(left, right),
  )) {
    const current = publishedSubclasses.get(id);
    if (current && canonical(current.value) === canonical(value)) continue;
    putSubclass(id, value, current?.revision ?? 0);
    changes.push({
      id,
      name: nameOf(value),
      operation: current && !current.value.withdrawn ? "update" : "add",
    });
  }
  for (const [id, current] of [...publishedSubclasses].sort(([left], [right]) =>
    compare(left, right),
  )) {
    if (desiredSubclasses.has(id) || current.value.withdrawn) continue;
    putSubclass(id, { ...current.value, withdrawn: true }, current.revision);
    changes.push({ id, name: nameOf(current.value), operation: "withdraw" });
  }
  /** Puts and withdrawals for a kind that publishes one record per draft; returns how many it serves. */
  const planRecords = <
    D extends { readonly id: string },
    P extends { readonly withdrawn: boolean; readonly record: { readonly name?: unknown } },
  >(
    drafts: readonly D[],
    current: ReadonlyMap<string, Stored<P>>,
    collection: string,
    check: (draft: D) => Problem | undefined,
    publish: (draft: D) => P,
  ): number => {
    const wanted = new Map<string, P>();
    for (const draft of drafts) {
      const failure = check(draft);
      if (failure) problems.push({ itemId: draft.id, problem: failure });
      else wanted.set(idPrefix + draft.id, publish(draft));
    }
    const putRecord = (key: string, value: unknown, expectedRevision: number): void => {
      mutations.push({
        operation: "put",
        kind: "collection",
        dataId: collection,
        key,
        expectedRevision,
        value,
      });
    };
    for (const [id, value] of [...wanted].sort(([left], [right]) => compare(left, right))) {
      const stored = current.get(id);
      if (stored && canonical(stored.value) === canonical(value)) continue;
      putRecord(id, value, stored?.revision ?? 0);
      changes.push({
        id,
        name: String(value.record.name),
        operation: stored && !stored.value.withdrawn ? "update" : "add",
      });
    }
    for (const [id, stored] of [...current].sort(([left], [right]) => compare(left, right))) {
      if (wanted.has(id) || stored.value.withdrawn) continue;
      putRecord(id, { ...stored.value, withdrawn: true }, stored.revision);
      changes.push({ id, name: String(stored.value.record.name), operation: "withdraw" });
    }
    return wanted.size;
  };
  const recordCount =
    desired.size +
    [...desiredSubclasses.values()].reduce((total, value) => total + value.records.length, 0) +
    planRecords(feats, publishedFeats, collections.publishedFeats, featProblem, flattenFeat) +
    planRecords(spells, publishedSpells, collections.publishedSpells, spellProblem, flattenSpell);
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
        recordCount,
      } satisfies PublishMeta,
    });
  return { problems, changes, mutations, recordCount };
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
const featDefaults: Record<string, unknown> = {
  prerequisites: {},
  repeatable: false,
  text: "",
  excerpt: "",
};
const spellDefaults: Record<string, unknown> = {
  classes: [],
  ritual: false,
  concentration: false,
  material: "",
  text: "",
};
const subclassDefaults: Record<string, unknown> = {
  text: "",
  excerpt: "",
  spells: [],
  classResources: [],
  tableColumns: [],
  features: [],
};
type DraftKind = "set" | "item" | "subclass" | "feat" | "spell";
/** Optional objects `{}` clears in an import; a cleared field takes its partner. */
const clearable: Readonly<Record<DraftKind, readonly string[]>> = {
  set: ["condition"],
  item: ["grants", "attunementPrerequisites", "container", "baseItem"],
  subclass: ["grants", "spellcasting"],
  feat: ["grants"],
  spell: [],
};
const partners: Readonly<Record<string, string>> = { spellcasting: "progression" };

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
  storedSubclasses: ReadonlyMap<string, Stored<unknown>> = new Map(),
  storedFeats: ReadonlyMap<string, Stored<unknown>> = new Map(),
  storedSpells: ReadonlyMap<string, Stored<unknown>> = new Map(),
): ImportPlan {
  const unknownField = exactFields(
    document,
    ["format", "schemaVersion", "sets", "items"],
    ["generatedAt", "mode", "subclasses", "feats", "spells"],
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
    incomingItems = source["items"],
    incomingSubclasses = source["subclasses"] ?? [],
    incomingFeats = source["feats"] ?? [],
    incomingSpells = source["spells"] ?? [];
  if (
    !Array.isArray(incomingSets) ||
    !Array.isArray(incomingItems) ||
    !Array.isArray(incomingSubclasses) ||
    !Array.isArray(incomingFeats) ||
    !Array.isArray(incomingSpells)
  )
    throw new HomebrewError("The document needs sets and items lists.");
  if (
    incomingSets.length +
      incomingItems.length +
      incomingSubclasses.length +
      incomingFeats.length +
      incomingSpells.length >
    2000
  )
    throw new HomebrewError("An import holds at most 2000 entries.");
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
    const value = guarded(at, () => parseSet(normalize(raw, existing, setDefaults, "set", now)));
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
    const value = guarded(at, () => parseItem(normalize(raw, existing, itemDefaults, "item", now)));
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
  for (const [index, raw] of incomingSubclasses.entries()) {
    const at = `subclasses[${index}]`;
    const existing = storedSubclasses.get(entryId(raw));
    const value = guarded(at, () =>
      parseSubclass(normalize(raw, existing, subclassDefaults, "subclass", now)),
    );
    if (seen.has(`subclass:${value.id}`))
      throw new HomebrewError("{at}: subclass {id} appears twice.", { at, id: value.id });
    seen.add(`subclass:${value.id}`);
    add(collections.subclasses, value.id, value.name, value, existing);
  }
  for (const [index, raw] of incomingFeats.entries()) {
    const at = `feats[${index}]`;
    const existing = storedFeats.get(entryId(raw));
    const value = guarded(at, () => parseFeat(normalize(raw, existing, featDefaults, "feat", now)));
    if (seen.has(`feat:${value.id}`))
      throw new HomebrewError("{at}: feat {id} appears twice.", { at, id: value.id });
    seen.add(`feat:${value.id}`);
    add(collections.feats, value.id, value.name, value, existing);
  }
  for (const [index, raw] of incomingSpells.entries()) {
    const at = `spells[${index}]`;
    const existing = storedSpells.get(entryId(raw));
    const value = guarded(at, () =>
      parseSpell(normalize(raw, existing, spellDefaults, "spell", now)),
    );
    if (seen.has(`spell:${value.id}`))
      throw new HomebrewError("{at}: spell {id} appears twice.", { at, id: value.id });
    seen.add(`spell:${value.id}`);
    add(collections.spells, value.id, value.name, value, existing);
  }
  if (mode === "replace")
    for (const [collection, stored, prefix] of [
      [collections.sets, storedSets, "set:"],
      [collections.items, storedItems, "item:"],
      [collections.subclasses, storedSubclasses, "subclass:"],
      [collections.feats, storedFeats, "feat:"],
      [collections.spells, storedSpells, "spell:"],
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
  // Sets, their items, subclasses, feats, then spells; each collection by id.
  const order: readonly string[] = [
    collections.sets,
    collections.items,
    collections.subclasses,
    collections.feats,
    collections.spells,
  ];
  const rank = (change: ImportChange): number => order.indexOf(change.collection);
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
  kind: DraftKind,
  now: number,
): Record<string, unknown> {
  if (!isRecord(raw)) throw new HomebrewError("The entry must be an object.");
  if (raw["schemaVersion"] !== undefined && raw["schemaVersion"] !== 1)
    throw new HomebrewError("schemaVersion must be 1.");
  const base = existing && isRecord(existing.value) ? existing.value : defaults;
  const fields: Record<string, unknown> = { ...base, ...raw };
  // An empty object clears an optional field, as [] clears a list.
  for (const optional of clearable[kind]) {
    const cleared = raw[optional];
    if (isRecord(cleared) && Object.keys(cleared).length === 0) {
      delete fields[optional];
      const partner = partners[optional];
      if (partner) delete fields[partner];
    }
  }
  if (kind === "item" && raw["characterMechanics"] === undefined)
    fields["characterMechanics"] = mechanicsOf(
      Array.isArray(fields["characterEffects"]) ? fields["characterEffects"] : [],
      fields["grants"],
      fields["baseItem"],
    );
  fields["schemaVersion"] = 1;
  fields["updatedAt"] = now;
  return fields;
}

// --- Export ----------------------------------------------------------------

export function exportDocument(
  sets: readonly ItemSet[],
  items: readonly Item[],
  now: number,
  subclasses: readonly Subclass[] = [],
  feats: readonly Feat[] = [],
  spells: readonly Spell[] = [],
): unknown {
  return {
    format: importFormat,
    schemaVersion: 1,
    generatedAt: now,
    mode: "merge",
    sets: [...sets].sort((left, right) => compare(left.id, right.id)),
    items: [...items].sort((left, right) => compare(left.id, right.id)),
    subclasses: [...subclasses].sort((left, right) => compare(left.id, right.id)),
    feats: [...feats].sort((left, right) => compare(left.id, right.id)),
    spells: [...spells].sort((left, right) => compare(left.id, right.id)),
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
