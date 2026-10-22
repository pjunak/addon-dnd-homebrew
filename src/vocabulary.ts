// Words for the Engine's grants vocabulary, used by the form in
// src/schema-form.ts: labels, hints, offered values and starting entries.
// The schema (src/grants-schema.ts) decides what is valid; this file only
// explains it, so a field missing here still renders under its own name.
// Names repeat across definitions with one meaning: a field is looked up as
// "Owner.field", then "segment.field" for inline objects, then by name.
// Every English string is a catalog key; tests/localization.mts checks them.
import { abilityNames, skillName } from "./effects.js";
import { conditionLabels, damageLabels, rollLabels, senseLabels } from "./grants.js";
import {
  abilities,
  advantageRolls,
  conditionIds,
  damageTypes,
  skills,
  spellSchools,
} from "./model.js";

/** Value and English label pairs. */
export type Options = readonly (readonly [value: string, label: string])[];
/** Ids the page knows: rule records, or keys this subclass declares. */
export type Source = "spell" | "class" | "column" | "resource" | "activation" | "choice";
export interface Offer {
  readonly values?: Options;
  /** Only the offered values are allowed. */
  readonly closed?: boolean;
  readonly source?: Source;
}

const labels: Readonly<Record<string, string>> = {
  // Grants
  abilityScoreBonus: "Ability score bonus",
  abilityScoreIncrease: "Ability Score Increase",
  acBonus: "AC bonus",
  acBonuses: "AC bonuses in armor",
  acFormulas: "AC formulas",
  activations: "Toggles",
  advantages: "Advantages",
  armor: "Armor training",
  attackModifiers: "Attack changes",
  attacks: "Attacks",
  attunementLimit: "Attunement limit",
  bonuses: "Other bonuses",
  castingAbility: "Spellcasting ability",
  choiceOverrides: "Choice overrides",
  choicePackages: "Choice packages",
  choices: "Choices",
  conditionImmunities: "Condition immunities",
  conditions: "Conditions",
  criticalRange: "Critical hit range",
  damageImmunities: "Damage immunities",
  expertise: "Expertise",
  hpBonus: "HP bonus",
  hpPerClassLevel: "HP per class level",
  hpPerLevel: "HP per character level",
  initiativeBonuses: "Initiative bonuses",
  languages: "Languages",
  prepareSpellListOf: "Prepare spells of",
  proficiencies: "Proficiencies",
  resistances: "Resistances",
  resources: "Limited uses",
  saveBonuses: "Saving throw bonuses",
  saveDCs: "Save DCs",
  savingThrows: "Saving throw proficiencies",
  senseBonuses: "Sense range bonuses",
  senses: "Senses",
  skillBonuses: "Skill bonuses",
  skills: "Skill proficiencies",
  speedBonus: "Speed bonus",
  speedBonuses: "Conditional speed bonuses",
  speeds: "Special speeds",
  spellList: "Spell list",
  spellLists: "Extra spell lists",
  spellSlot: "Spell slot",
  spellbookBonus: "Spellbook bonus",
  spells: "Spells",
  tools: "Tool proficiencies",
  unquantifiable_modifiers: "Notes",
  weaponMasterySlots: "Weapon Mastery slots",
  weapons: "Weapon proficiencies",
  // Shared field names
  abilities: "Abilities",
  ability: "Ability",
  abilityMod: "Ability modifier",
  add: "Add",
  addAbilities: "Add ability modifiers",
  addAbility: "Add ability modifier",
  alwaysPrepared: "Always prepared",
  amount: "Amount",
  armorTypes: "Armor types",
  assign: "Increases",
  atLevel: "Available from level",
  atWill: "At will",
  attack: "Attack id",
  attackAbility: "Attack ability",
  attackBonus: "Attack bonus",
  attackBonusAbility: "Attack bonus ability",
  base: "Base",
  cap: "Score maximum",
  castAtLevel: "Cast at spell level",
  castAtLevelByLevel: "Higher casting level",
  castingTime: "Casting times",
  category: "Category",
  changeOn: "Can change on",
  choiceId: "Choice id",
  choose: "Choose",
  class: "Classes",
  classId: "Class",
  column: "Table column",
  components: "Needs components",
  condition: "Only when",
  cost: "Uses spent",
  count: "Count",
  countByLevel: "Count by level",
  creatureType: "Creature type",
  damage: "Damage",
  damageBonus: "Damage bonus",
  damageBonusColumn: "Damage bonus column",
  damageDie: "Damage die",
  damageDieColumn: "Damage die column",
  damageType: "Damage type",
  default: "Default",
  divisor: "Character level divided by",
  exclusiveGroup: "Exclusive group",
  extends: "Extends toggles",
  filter: "Filter",
  filterByLevel: "Filter by level",
  fixed: "Fixed",
  fly: "Can fly",
  free: "Free casts",
  from: "Options",
  fromAbilityScoreIncrease: "The increased ability",
  fromByLevel: "Options by level",
  fromCastingAbilityOf: "Casting ability of",
  fromCategory: "Option category",
  id: "Id",
  ids: "Ids",
  itemTypes: "Item types",
  key: "Key",
  level: "Level",
  levelReplacements: "Replacements per level",
  long: "Long (ft)",
  mastery: "Mastery",
  masteryActive: "Mastery in use",
  match: "Applies to attacks",
  max: "Maximum",
  maxCr: "Highest Challenge Rating",
  maxSpellLevel: "Highest spell level",
  min: "Minimum",
  minLevel: "From class level",
  mode: "Result",
  modifiers: "Changes",
  multiplier: "Multiplier",
  multiply: "Multiplied by",
  name: "Name",
  noArmor: "No armor",
  noShield: "No shield",
  normal: "Normal (ft)",
  notArmorTypes: "Not in armor types",
  notItemTypes: "Not item types",
  notProficient: "Only without proficiency",
  on: "Roll",
  optionKind: "Option kind",
  options: "Options",
  perLevel: "Per level",
  proficiencyBonus: "Add the Proficiency Bonus",
  proficient: "Proficient",
  progression: "By level",
  prompt: "Prompt",
  properties: "Properties",
  property: "Weapon property",
  range: "Range",
  rangeNormalLong: "Range",
  rarity: "Rarities",
  recharge: "Recharge",
  requires: "Armor requirement",
  resource: "Spends",
  restriction: "Restriction",
  restrictions: "Armor requirement",
  ritual: "Rituals only",
  ritualOnly: "Only as a ritual",
  round: "Rounding",
  school: "Schools",
  source: "Source",
  spellLevel: "Spell level",
  summary: "Summary",
  swappableOn: "Swappable on",
  target: "Change",
  thrownRange: "Thrown range",
  type: "Type",
  unarmed: "Unarmed",
  value: "Value",
  versatileDamage: "Versatile damage",
  when: "Only when",
  while: "While toggles",
  // One definition's own sense of a name
  "ACFormulaGrant.base": "Base AC",
  "AbilityScoreIncrease.choose": "Abilities to choose",
  "AbilityScoreIncrease.from": "From abilities",
  "CastingAbilityGrant.choose": "Player chooses from",
  "CastingAbilityGrant.fixed": "Fixed ability",
  "GrantChoice.category": "Feat category",
  "GrantChoice.default": "Default option",
  "GrantChoice.id": "Choice id",
  "LevelMaximum.max": "Uses",
  "ResourceGrant.fixed": "Fixed uses",
  "ResourceGrant.progression": "Uses by level",
  "SpellbookStep.count": "Spells in total",
  "SpellbookStep.level": "Class level",
  "SpellbookStep.school": "School",
  "SpellFromDecl.ids": "Spells",
  "SpellGrantDecl.default": "Default spell",
  "SpellGrantDecl.id": "Choice id",
  "SpellGrantDecl.ids": "Spells",
  "SpellGrantDecl.level": "Class level",
  "SpellSlotGrant.level": "Slot level",
  "SpellSlotLevel.max": "Highest slot level",
  "SpellSlotLevel.min": "Lowest slot level",
  "recharge.on": "Rest",
  // The subclass's own tables
  "TableColumn.key": "Key",
  "TableColumn.name": "Column name",
  "TableColumn.progression": "Values by level",
  "ColumnValue.level": "Class level",
  "ColumnValue.value": "Value",
  "Spellcasting.ability": "Spellcasting ability",
  "Spellcasting.startLevel": "Casting from class level",
  "Spellcasting.prepares": "Prepares spells",
  "Spellcasting.spellListClassId": "Spell list of",
  "Spellcasting.levelReplacements": "Replacements per level",
  "Spellcasting.ritual": "Ritual casting",
  "CastingRow.level": "Class level",
  "CastingRow.cantripsKnown": "Cantrips",
  "CastingRow.preparedSpells": "Prepared spells",
  "CastingRow.spellSlots": "Slots per spell level",
};

const hints: Readonly<Record<string, string>> = {
  // Grants
  abilityScoreBonus: "A fixed increase from this feature's level, such as Strength +4 up to 25.",
  abilityScoreIncrease: "Applies on feats only.",
  acBonus: "Applies on species only; use AC bonuses in armor.",
  acBonuses: "Added to Armor Class while the character wears the listed armor types.",
  acFormulas: "Other ways to compute Armor Class, such as Unarmored Defense; the best one counts.",
  activations: "States the player switches on, such as Rage, and the changes they make while on.",
  advantages: "Advantage or Disadvantage on rolls, always or in a stated situation.",
  armor: "Armor training: light, medium, heavy or shield.",
  attackModifiers: "Changes to computed attacks, such as Martial Arts or Archery.",
  attacks: "Weapons the feature creates, such as Psychic Blades.",
  attunementLimit: "The number of items the character can attune to, if higher.",
  bonuses: "Not applied; kept for older records.",
  castingAbility: "The ability this feature's spells use.",
  choiceOverrides: "Replaces the count or options of one of the class's choices.",
  choicePackages: "Extra grants for each option of an enumerated choice.",
  choices: "Picks the player makes in the Builder, such as one skill from a list.",
  conditions: "Applies on items only.",
  criticalRange: "Attacks score a Critical Hit on this roll or higher, such as 19.",
  expertise: "Skills that gain Expertise.",
  hpBonus: "Added once to maximum HP.",
  hpPerClassLevel: "Added to maximum HP for each level in this class.",
  hpPerLevel: "Added to maximum HP for each character level.",
  initiativeBonuses: "Bonuses to Initiative.",
  languages: "Language ids, separated by commas, such as draconic, elvish.",
  prepareSpellListOf: "Applies on feats only.",
  proficiencies: "The same proficiencies grouped in one field.",
  resources: "Uses with a key, a maximum and a recharge; spells and toggles can spend them.",
  saveBonuses: "Bonuses to saving throws.",
  saveDCs: "A feature's own save DC, such as a Monk's Focus.",
  senseBonuses: "Extends a sense's range in feet, or grants it.",
  senses: "Senses and their range in feet; the greatest range counts.",
  skillBonuses: "Bonuses to ability checks with skills.",
  speedBonus: "Added to walking speed in feet.",
  speedBonuses: "Speed bonuses that need an armor condition or follow a table column.",
  speeds: "Fly, swim, climb or burrow speeds in feet, or equal to walking speed.",
  spellList: "Applies on feats only.",
  spellLists: "Class spell lists added to this class's preparation, as Magical Secrets does.",
  spellSlot: "Applies on feats only.",
  spellbookBonus: "Spellbook spells added at class levels, as the wizard Savants do.",
  spells: "Spells the feature grants: fixed spells, or a choice the player makes.",
  tools: "Tool ids, separated by commas, such as thieves-tools.",
  unquantifiable_modifiers: "Notes kept with the record; nothing applies them.",
  weaponMasterySlots: "Applies on feats only.",
  weapons: "Weapon ids or categories, separated by commas, such as martial.",
  // Fields
  "ACFormulaGrant.addAbilities": "Ability modifiers added to the base, such as DEX and CON.",
  "ACFormulaGrant.id": "Lowercase words joined by hyphens.",
  "AbilityScoreBonus.cap": "The highest score it can reach.",
  "ActivationGrant.condition": "Shown with the toggle, such as while raging.",
  "ActivationGrant.exclusiveGroup": "Toggles in one group cannot be on together.",
  "ActivationGrant.extends":
    "Toggle ids: these changes apply while one of them is on, without a toggle of their own.",
  "ActivationGrant.id": "Lowercase words joined by hyphens; other toggles refer to it.",
  "ActivationGrant.minLevel": "The class level the toggle starts at.",
  "ActivationGrant.resource": "A use spent when the toggle is switched on.",
  "ActivationGrant.while": "Toggle ids: an option chosen each time one of them is switched on.",
  "ActivationModifier.target": "What the change affects; it decides which fields apply.",
  "AdvantageGrant.when": "A situation the sheet shows instead of marking the roll.",
  "ArmorCondition.armorTypes": "Worn body armor of these types.",
  "AttackGrant.damage": "Dice such as 1d6.",
  "AttackGrant.id": "Lowercase words joined by hyphens.",
  "AttackMatch.attack": "An attack id from Attacks.",
  "CastingAbilityGrant.fromAbilityScoreIncrease": "The ability the feat's increase raised.",
  "CastingAbilityGrant.id": "Lowercase words joined by hyphens.",
  "CheckBonusGrant.add": "A number, or halfProficiency.",
  "ChoiceOverride.choiceId": "The class choice it changes.",
  "ChoicePackage.choiceId": "The enumerated choice whose options these are.",
  "ChoicePackage.options": "Grants for each option id of the choice.",
  "GrantChoice.countByLevel": "The total count from each class level.",
  "GrantChoice.from": "Ids to pick from, separated by commas; leave it out to offer every option.",
  "GrantChoice.fromCategory": "Option features of a category, such as maneuver.",
  "GrantChoice.id": "Lowercase words joined by hyphens, unique among all choices.",
  "GrantChoice.levelReplacements": "1 lets the player replace the pick at each later class level.",
  "GrantChoice.optionKind": "Offers records of another kind, such as monster.",
  "GrantChoice.type": "What the player picks; enumerated offers the ids under Options.",
  "GrantedCondition.id": "Lowercase words joined by hyphens.",
  "ResourceGrant.abilityMod": "Adds this ability's modifier, at least 1.",
  "ResourceGrant.key": "Lowercase words joined by hyphens; spells and toggles spend uses by key.",
  "ResourceGrant.minLevel": "The class level the uses start at.",
  "ResourceGrant.perLevel": "Times the class level, rounded down.",
  "ResourceGrant.progression": "Uses from each class level; replaces the other parts.",
  "ResourceGrant.recharge": "A Long Rest when left out.",
  "SpeedBonusGrant.column": "A table column of this subclass, read at the class level.",
  "SpellGrantDecl.alwaysPrepared": "Always prepared, as domain spells are.",
  "SpellGrantDecl.classId": "The spells count as this class's spells.",
  "SpellGrantDecl.default": "Granted until the player picks another.",
  "SpellGrantDecl.free": "Casts without a slot, such as 1/long, 1/shortOrLong or pb/long.",
  "SpellGrantDecl.id": "For a choice: lowercase words joined by hyphens, with Choose.",
  "SpellGrantDecl.ids": "Fixed spells. For a choice, give a choice id and Choose instead.",
  "SpellGrantDecl.level": "The class level the spells arrive at.",
  "SpellGrantDecl.levelReplacements":
    "1 lets the player replace the spell at each later class level.",
  "SpellGrantDecl.resource": "A use spent to cast it without a slot.",
  "SpellbookStep.count": "Spellbook spells in total from this class level.",
  damageBonusColumn: "A table column of this subclass, read at the class level.",
  damageDieColumn: "A table column of this subclass, read at the class level.",
  "Spellcasting.levelReplacements": "1 lets the player replace one spell at each later level.",
  "TableColumn.key": "Lowercase words joined by hyphens; grants read the column by key.",
  "ColumnValue.value": "A whole number or a die such as 1d8.",
  "CastingRow.spellSlots": "Slots for spell levels 1, 2, 3…, separated by commas.",
};

/** Labels of whole entries in a list, by definition. */
const entryLabels: Readonly<Record<string, string>> = {
  ACBonusGrant: "AC bonus",
  ACFormulaGrant: "AC formula",
  ActivationGrant: "Toggle",
  ActivationModifier: "Change",
  AdvantageGrant: "Advantage",
  AttackGrant: "Attack",
  AttackMatch: "Matching attack",
  AttackModifierGrant: "Attack change",
  CastAtLevelStep: "Step",
  CheckBonusGrant: "Bonus",
  ChoiceOverride: "Override",
  ChoicePackage: "Package",
  GrantChoice: "Choice",
  GrantedCondition: "Condition",
  LevelMaximum: "Level",
  ResourceGrant: "Use",
  SaveDCGrant: "Save DC",
  SpeedBonusGrant: "Speed bonus",
  SpellbookStep: "Step",
  SpellGrantDecl: "Spell grant",
  TableColumn: "Column",
  recharge: "Recharge",
};
const addLabels: Readonly<Record<string, string>> = {
  ACBonusGrant: "Add AC bonus",
  ACFormulaGrant: "Add AC formula",
  ActivationGrant: "Add toggle",
  ActivationModifier: "Add change",
  AdvantageGrant: "Add advantage",
  AttackGrant: "Add attack",
  AttackMatch: "Add matching attack",
  AttackModifierGrant: "Add attack change",
  CheckBonusGrant: "Add bonus",
  ChoiceOverride: "Add override",
  ChoicePackage: "Add package",
  GrantChoice: "Add choice",
  GrantedCondition: "Add condition",
  ResourceGrant: "Add use",
  SaveDCGrant: "Add save DC",
  SpeedBonusGrant: "Add speed bonus",
  SpellGrantDecl: "Add spell grant",
  TableColumn: "Add column",
  recharge: "Add recharge",
};

/** A map's key and value labels, by field. */
const keyLabels: Readonly<Record<string, string>> = {
  senses: "Sense",
  senseBonuses: "Sense",
  speeds: "Speed",
  assign: "Ability",
  countByLevel: "Class level",
  fromByLevel: "Class level",
  filterByLevel: "Class level",
  options: "Option id",
  bonuses: "Bonus",
};
const valueLabels: Readonly<Record<string, string>> = {
  senses: "Range (ft)",
  senseBonuses: "Extra range (ft)",
  speeds: "Speed",
  assign: "Increase",
  countByLevel: "Count",
  fromByLevel: "Options",
  filterByLevel: "Filter",
  options: "Grants",
  bonuses: "Amount",
};

/** Fields in the order the editor shows them; the rest follow in schema order. */
const fieldOrders: Readonly<Record<string, readonly string[]>> = {
  ACBonusGrant: ["add", "requires"],
  ACFormulaGrant: ["name", "id", "base", "addAbilities", "requires"],
  ActivationGrant: [
    "name",
    "id",
    "condition",
    "resource",
    "minLevel",
    "exclusiveGroup",
    "extends",
    "while",
    "restrictions",
    "modifiers",
  ],
  ActivationModifier: ["target", "value", "key", "add", "addAbility", "on", "mode"],
  AdvantageGrant: ["on", "mode", "abilities", "skills", "when", "requires"],
  AttackGrant: ["name", "id", "damage", "damageType", "range", "category", "ability", "proficient"],
  CastAtLevelStep: ["level", "castAtLevel"],
  CastingAbilityGrant: ["fixed", "choose", "id"],
  CastingRow: ["level", "cantripsKnown", "preparedSpells", "spellSlots"],
  CheckBonusGrant: ["add", "addAbility", "abilities", "skills", "min", "notProficient"],
  ChoiceOverride: ["choiceId"],
  ChoicePackage: ["choiceId", "options"],
  ColumnValue: ["level", "value"],
  DistancePair: ["normal", "long"],
  GrantChoice: ["id", "type", "count", "prompt", "from", "default"],
  GrantedCondition: ["name", "id", "summary"],
  LevelMaximum: ["level", "max"],
  ResourceGrant: [
    "name",
    "key",
    "fixed",
    "perLevel",
    "proficiencyBonus",
    "abilityMod",
    "multiplier",
    "add",
    "min",
    "minLevel",
    "progression",
    "recharge",
  ],
  SaveDCGrant: ["name", "abilities"],
  SpeedBonusGrant: ["add", "column", "requires"],
  SpellbookStep: ["level", "count", "school"],
  SpellGrantDecl: [
    "level",
    "ids",
    "alwaysPrepared",
    "id",
    "choose",
    "spellLevel",
    "maxSpellLevel",
    "from",
    "default",
  ],
  Spellcasting: ["ability", "startLevel", "prepares", "spellListClassId"],
  TableColumn: ["name", "key", "progression"],
  recharge: ["on", "amount", "minLevel"],
  resource: ["key", "cost"],
};
/** The label of the value under a chosen alternative, by field. */
const branchValueLabels: Readonly<Record<string, string>> = {
  resource: "Use key",
  maxSpellLevel: "Spell level",
  recharge: "Rest",
  amount: "Amount",
};

/** Labels of the alternatives a field allows, in schema order. */
const branchLabels: Readonly<Record<string, readonly string[]>> = {
  resource: ["One use", "Several uses"],
  maxSpellLevel: ["A spell level", "What the class can cast"],
  recharge: ["On a rest", "Per rest"],
  amount: ["All or half", "Number of uses", "Ability modifier"],
  speeds: ["Feet", "Equal to walking speed"],
};

/** Starting entries for lists, so a new entry has its usual fields. */
const templates: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  ActivationGrant: { id: "", name: "", modifiers: [] },
  ActivationModifier: { target: "armorClass", add: 1 },
  AdvantageGrant: { on: "save" },
  CheckBonusGrant: { add: 1 },
  GrantChoice: { id: "", type: "skillProficiency", count: 1 },
  ResourceGrant: { key: "", name: "", fixed: 1, recharge: "long" },
  SpellGrantDecl: { ids: [] },
  ACFormulaGrant: { id: "", base: 10, addAbilities: ["DEX"] },
  TableColumn: { key: "", name: "", progression: [{ level: 3, value: "1d6" }] },
};

/** Top-level grants in the order and groups the editor offers them. */
export const grantGroups: readonly {
  readonly label: string;
  readonly fields: readonly string[];
}[] = [
  {
    label: "Proficiencies",
    fields: [
      "skills",
      "expertise",
      "savingThrows",
      "armor",
      "weapons",
      "tools",
      "languages",
      "proficiencies",
    ],
  },
  { label: "Choices", fields: ["choices", "choicePackages", "choiceOverrides"] },
  { label: "Uses and toggles", fields: ["resources", "activations"] },
  { label: "Spells", fields: ["spells", "castingAbility", "spellLists", "spellbookBonus"] },
  {
    label: "Combat",
    fields: ["attacks", "attackModifiers", "saveDCs", "criticalRange", "acFormulas", "acBonuses"],
  },
  { label: "Rolls", fields: ["advantages", "skillBonuses", "saveBonuses", "initiativeBonuses"] },
  { label: "Defenses", fields: ["resistances", "damageImmunities", "conditionImmunities"] },
  {
    label: "Hit points, speed and senses",
    fields: [
      "hpBonus",
      "hpPerLevel",
      "hpPerClassLevel",
      "speedBonus",
      "speedBonuses",
      "speeds",
      "senses",
      "senseBonuses",
    ],
  },
  { label: "Abilities and attunement", fields: ["abilityScoreBonus", "attunementLimit"] },
  {
    label: "Not applied on subclasses",
    fields: [
      "abilityScoreIncrease",
      "weaponMasterySlots",
      "spellSlot",
      "spellList",
      "prepareSpellListOf",
      "acBonus",
      "conditions",
      "bonuses",
      "unquantifiable_modifiers",
    ],
  },
];

// --- Offered values ------------------------------------------------------------

const pairs = (values: readonly string[], names: Readonly<Record<string, string>>): Options =>
  values.map((value) => [value, names[value] ?? value] as const);
const abilityOptions = pairs(abilities, abilityNames);
const skillOptions: Options = skills.map((skill) => [skill, skillName(skill)] as const);
const damageOptions = pairs(damageTypes, damageLabels);
const conditionOptions = pairs(conditionIds, conditionLabels);
const senseOptions = pairs(Object.keys(senseLabels), senseLabels);

const speedLabels: Readonly<Record<string, string>> = {
  fly: "Fly",
  swim: "Swim",
  climb: "Climb",
  burrow: "Burrow",
};
const modeLabels: Readonly<Record<string, string>> = {
  advantage: "Advantage",
  disadvantage: "Disadvantage",
};
const checkAddLabels: Readonly<Record<string, string>> = {
  halfProficiency: "Half the Proficiency Bonus",
};
const walkingLabels: Readonly<Record<string, string>> = { speed: "Equal to walking speed" };
const restLabels: Readonly<Record<string, string>> = {
  short: "Short Rest",
  long: "Long Rest",
  shortOrLong: "Short or Long Rest",
};
const amountLabels: Readonly<Record<string, string>> = {
  full: "All uses",
  halfLevel: "Half the class level",
};
const roundLabels: Readonly<Record<string, string>> = { up: "Round up", down: "Round down" };
const targetLabels: Readonly<Record<string, string>> = {
  armorClass: "Armor Class",
  speed: "Speed",
  flySpeed: "Fly Speed",
  swimSpeed: "Swim Speed",
  climbSpeed: "Climb Speed",
  burrowSpeed: "Burrow Speed",
  advantage: "Advantage or Disadvantage",
  attack: "Attacks",
  weaponAbility: "Weapon attack ability",
  spellSaveDC: "Spell save DC",
  concentrationSave: "Concentration saving throws",
  resistance: "Resistance",
  damageImmunity: "Damage immunity",
  conditionImmunity: "Condition immunity",
  sense: "Sense range at least",
  senseBonus: "Sense range extended",
};
const armorLabels: Readonly<Record<string, string>> = {
  light: "Light armor",
  medium: "Medium armor",
  heavy: "Heavy armor",
};
const rangeLabels: Readonly<Record<string, string>> = { melee: "Melee", ranged: "Ranged" };
const categoryLabels: Readonly<Record<string, string>> = { simple: "Simple", martial: "Martial" };
/** Mastery names as weapon records spell them; names, not words to translate. */
const masteries = ["Cleave", "Graze", "Nick", "Push", "Sap", "Slow", "Topple", "Vex"] as const;
const choiceTypeLabels: Readonly<Record<string, string>> = {
  skillProficiency: "Skill proficiency",
  expertise: "Expertise",
  skillExpertise: "Skill proficiency with Expertise",
  skillProficiencyOrExpertise: "Skill proficiency, or Expertise",
  toolProficiency: "Tool proficiency",
  proficiency: "Skill or tool proficiency",
  language: "Language",
  savingThrowProficiency: "Saving throw proficiency",
  weaponProficiency: "Weapon proficiency",
  armorProficiency: "Armor training",
  weaponMastery: "Weapon Mastery",
  damageResistance: "Damage resistance",
  conditionImmunity: "Condition immunity",
  feat: "Feat",
  enumerated: "One of the listed options",
};
const featCategoryLabels: Readonly<Record<string, string>> = {
  origin: "Origin",
  general: "General",
  fightingStyle: "Fighting Style",
  epicBoon: "Epic Boon",
};
const changeLabels: Readonly<Record<string, string>> = {
  longRest: "Long Rest",
  shortRest: "Short Rest",
  classLevel: "Class level",
  turn: "Each turn",
};
const prepareLabels: Readonly<Record<string, string>> = {
  list: "From the class spell list",
  spellbook: "From a spellbook",
};
const schoolLabels: Readonly<Record<string, string>> = {
  abjuration: "Abjuration",
  conjuration: "Conjuration",
  divination: "Divination",
  enchantment: "Enchantment",
  evocation: "Evocation",
  illusion: "Illusion",
  necromancy: "Necromancy",
  transmutation: "Transmutation",
};
const optionKindLabels: Readonly<Record<string, string>> = {
  monster: "Monsters",
  "magic-item": "Magic items",
};
const rarityLabels: Readonly<Record<string, string>> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  "very-rare": "Very Rare",
  legendary: "Legendary",
};
const propertyIds = [
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

const closed = (values: Options): Offer => ({ values, closed: true });
const open = (values: Options): Offer => ({ values });
const of = (names: Readonly<Record<string, string>>): Options => pairs(Object.keys(names), names);
const levels: Options = Array.from({ length: 20 }, (_, index) => {
  const level = String(index + 1);
  return [level, level] as const;
});

const offers: Readonly<Record<string, Offer>> = {
  abilities: closed(abilityOptions),
  addAbilities: closed(abilityOptions),
  savingThrows: closed(abilityOptions),
  "AbilityScoreIncrease.from": closed(abilityOptions),
  "CastingAbilityGrant.choose": closed(abilityOptions),
  ability: closed(abilityOptions),
  abilityMod: closed(abilityOptions),
  addAbility: closed(abilityOptions),
  attackAbility: closed(abilityOptions),
  attackBonusAbility: closed(abilityOptions),
  "CastingAbilityGrant.fixed": closed(abilityOptions),
  skills: closed(skillOptions),
  expertise: closed(skillOptions),
  resistances: closed(damageOptions),
  damageImmunities: closed(damageOptions),
  damageType: closed(damageOptions),
  conditionImmunities: closed(conditionOptions),
  armorTypes: closed(of(armorLabels)),
  notArmorTypes: closed(of(armorLabels)),
  "AdvantageGrant.on": closed(pairs(advantageRolls, rollLabels)),
  "ActivationModifier.on": closed(pairs(advantageRolls, rollLabels)),
  recharge: closed(of(restLabels)),
  "recharge.on": closed(of(restLabels)),
  "recharge.amount": closed(of(amountLabels)),
  mode: closed(of(modeLabels)),
  round: closed(of(roundLabels)),
  target: closed(of(targetLabels)),
  "AttackGrant.range": closed(of(rangeLabels)),
  "AttackMatch.range": closed(of(rangeLabels)),
  "AttackGrant.category": closed(of(categoryLabels)),
  "AttackMatch.category": closed(of(categoryLabels)),
  mastery: closed(pairs(masteries, {})),
  properties: open(pairs(propertyIds, {})),
  property: open(pairs(propertyIds, {})),
  "GrantChoice.type": open(of(choiceTypeLabels)),
  "GrantChoice.category": open(of(featCategoryLabels)),
  changeOn: open(of(changeLabels)),
  optionKind: open(of(optionKindLabels)),
  rarity: closed(of(rarityLabels)),
  "SpellFromDecl.school": closed(of(schoolLabels)),
  "SpellbookStep.school": closed(
    spellSchools.map((school) => [schoolLabels[school]!, schoolLabels[school]!] as const),
  ),
  "Spellcasting.prepares": closed(of(prepareLabels)),
  "CheckBonusGrant.add": open(of(checkAddLabels)),
  // Ids the page knows
  "SpellGrantDecl.ids": { source: "spell" },
  "SpellFromDecl.ids": { source: "spell" },
  "SpellGrantDecl.default": { source: "spell" },
  "SpellFromDecl.class": { source: "class" },
  "SpellGrantDecl.classId": { source: "class" },
  spellLists: { source: "class" },
  "Spellcasting.spellListClassId": { source: "class" },
  column: { source: "column" },
  damageBonusColumn: { source: "column" },
  damageDieColumn: { source: "column" },
  "resource.key": { source: "resource" },
  "ActivationGrant.resource": { source: "resource" },
  "SpellGrantDecl.resource": { source: "resource" },
  extends: { source: "activation" },
  while: { source: "activation" },
  choiceId: { source: "choice" },
};
/** Offers for a map's keys. */
const keyOffers: Readonly<Record<string, Offer>> = {
  senses: closed(senseOptions),
  senseBonuses: closed(senseOptions),
  speeds: closed(of(speedLabels)),
  assign: closed(abilityOptions),
  countByLevel: closed(levels),
  fromByLevel: closed(levels),
  filterByLevel: closed(levels),
};

/**
 * Activation changes: the target decides which other fields apply, and a new
 * target starts from these values.
 */
const targetFields: Readonly<Record<string, readonly string[]>> = {
  armorClass: ["add", "addAbility"],
  speed: ["add"],
  flySpeed: ["value", "multiply"],
  swimSpeed: ["value", "multiply"],
  climbSpeed: ["value", "multiply"],
  burrowSpeed: ["value", "multiply"],
  advantage: ["on", "mode", "abilities", "skills", "when", "requires"],
  attack: [
    "ability",
    "attackBonus",
    "attackBonusAbility",
    "min",
    "damageBonus",
    "damageBonusColumn",
    "damageDie",
    "damageDieColumn",
    "match",
    "requires",
  ],
  weaponAbility: ["ability"],
  spellSaveDC: ["add"],
  concentrationSave: ["add", "addAbility"],
  resistance: ["value"],
  damageImmunity: ["value"],
  conditionImmunity: ["value"],
  sense: ["key", "value"],
  senseBonus: ["key", "add"],
};
const targetStarts: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  armorClass: { add: 1 },
  speed: { add: 10 },
  flySpeed: { value: "speed" },
  swimSpeed: { value: "speed" },
  climbSpeed: { value: "speed" },
  burrowSpeed: { value: "speed" },
  advantage: { on: "save" },
  weaponAbility: { ability: "WIS" },
  spellSaveDC: { add: 1 },
  concentrationSave: { add: 1 },
  resistance: { value: "fire" },
  damageImmunity: { value: "fire" },
  conditionImmunity: { value: "frightened" },
  sense: { key: "darkvision", value: 60 },
  senseBonus: { key: "darkvision", add: 30 },
};

// --- Lookups -------------------------------------------------------------------

const segmentOf = (owner: string): string => owner.slice(owner.lastIndexOf(".") + 1);

function lookup<T>(
  table: Readonly<Record<string, T>>,
  owner: string,
  field: string,
): T | undefined {
  return table[`${owner}.${field}`] ?? table[`${segmentOf(owner)}.${field}`] ?? table[field];
}
/** "spellSaveDC" → "Spell save DC"-like words for a field nothing names. */
export function humanize(field: string): string {
  const words = field
    .replace(/_/gu, " ")
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .split(" ")
    .map((word) => (/^[A-Z]{2,}$/u.test(word) ? word : word.toLowerCase()))
    .join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function fieldLabel(owner: string, field: string): string {
  return lookup(labels, owner, field) ?? humanize(field);
}
export function fieldHint(owner: string, field: string): string | undefined {
  return lookup(hints, owner, field);
}
export function fieldOffer(
  owner: string,
  field: string,
  siblings: Readonly<Record<string, unknown>>,
): Offer | undefined {
  if (owner === "ActivationModifier") {
    const target = siblings["target"];
    if (field === "value" && (target === "resistance" || target === "damageImmunity"))
      return closed(damageOptions);
    if (field === "value" && target === "conditionImmunity") return closed(conditionOptions);
    if (field === "key") return closed(senseOptions);
    if (field === "value" && typeof target === "string" && target.endsWith("Speed"))
      return open(of(walkingLabels));
  }
  return lookup(offers, owner, field);
}
export function keyOffer(owner: string, field: string): Offer | undefined {
  return lookup(keyOffers, owner, field);
}
/** The label of one entry in a list of `owner`. */
export function entryLabel(owner: string): string {
  return entryLabels[owner] ?? entryLabels[segmentOf(owner)] ?? "Entry";
}
export function addLabel(owner: string): string {
  return addLabels[owner] ?? addLabels[segmentOf(owner)] ?? "Add entry";
}
/** A map's key and value labels. */
export function mapLabels(field: string): readonly [key: string, value: string] {
  return [keyLabels[field] ?? "Key", valueLabels[field] ?? "Value"];
}
/** `fields` in the order the editor shows an object of `owner`. */
export function fieldOrder(owner: string, fields: readonly string[]): string[] {
  const preferred = (fieldOrders[owner] ?? fieldOrders[segmentOf(owner)] ?? []).filter((field) =>
    fields.includes(field),
  );
  return [...preferred, ...fields.filter((field) => !preferred.includes(field))];
}
export function branchValueLabel(field: string): string {
  return branchValueLabels[field] ?? "Value";
}
export function branchLabel(owner: string, field: string, index: number): string | undefined {
  return lookup(branchLabels, owner, field)?.[index];
}
/** A new list entry of `owner`, or undefined to start from the schema. */
export function template(owner: string): Readonly<Record<string, unknown>> | undefined {
  return templates[owner];
}
/** Text lists whose entries are sentences, one per line, not ids. */
export function isProse(owner: string, field: string): boolean {
  return owner === "Grants" && field === "unquantifiable_modifiers";
}

/** The field that decides which others apply, as an activation's target does. */
export interface Switch {
  readonly field: string;
  /** The fields that apply for a value, or undefined for all. */
  fields(value: unknown): readonly string[] | undefined;
  /** Values a newly chosen value starts with. */
  start(value: unknown): Readonly<Record<string, unknown>>;
}
export function switchOf(owner: string): Switch | undefined {
  if (owner !== "ActivationModifier") return undefined;
  return {
    field: "target",
    fields: (value) => (typeof value === "string" ? targetFields[value] : undefined),
    start: (value) => (typeof value === "string" ? (targetStarts[value] ?? {}) : {}),
  };
}

/** Every English word this file shows, for the localization test. */
export function vocabularyWords(): string[] {
  const optionWords = (offer: Offer | undefined): string[] =>
    offer?.values?.map(([, label]) => label) ?? [];
  const named = new Set<string>([...masteries, ...propertyIds]);
  return [
    ...Object.values(labels),
    ...Object.values(hints),
    ...Object.values(entryLabels),
    ...Object.values(addLabels),
    ...Object.values(branchLabels).flat(),
    ...grantGroups.map((group) => group.label),
    ...Object.values(offers).flatMap(optionWords),
    ...Object.values(keyOffers).flatMap(optionWords),
    ...Object.values(targetLabels),
    ...Object.values(keyLabels),
    ...Object.values(valueLabels),
    ...Object.values(walkingLabels),
    ...Object.values(branchValueLabels),
    "Entry",
    "Add entry",
  ].filter((word) => !named.has(word) && !/^\d+$/u.test(word));
}
