import type { Translator } from "./catalogs.js";
import { mechanicsOf, moveOverrides, type Item, type ItemSet } from "./model.js";

type TemplateFields = Partial<
  Pick<Item, "text" | "overrides" | "characterEffects" | "grants" | "baseItem" | "container">
>;
/** A common kind of magic item a new draft can start from; its words are English. */
export interface ItemTemplate {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly item: TemplateFields;
}

export const itemTemplates: readonly ItemTemplate[] = [
  {
    id: "weapon",
    label: "Magic weapon",
    hint: "A +1 weapon; the player picks which weapon on the sheet.",
    item: {
      overrides: { itemType: "Weapon", rarity: "Uncommon" },
      baseItem: { kind: "weapon", bonus: 1 },
      text: "You have a +1 bonus to attack and damage rolls made with this magic weapon.",
    },
  },
  {
    id: "armor",
    label: "Magic armor",
    hint: "+1 armor; the player picks which armor on the sheet.",
    item: {
      overrides: { itemType: "Armor", rarity: "Rare" },
      baseItem: { kind: "armor", armorTypes: ["light", "medium", "heavy"], bonus: 1 },
      text: "You have a +1 bonus to Armor Class while wearing this armor.",
    },
  },
  {
    id: "shield",
    label: "Magic shield",
    hint: "A +1 shield.",
    item: {
      overrides: { itemType: "Armor", rarity: "Uncommon" },
      baseItem: { kind: "armor", armorTypes: ["shield"], bonus: 1 },
      text: "While holding this Shield, you have a +1 bonus to Armor Class in addition to the Shield's normal bonus.",
    },
  },
  {
    id: "bonus",
    label: "Bonus to a statistic",
    hint: "+1 Armor Class while attuned; change the effect for another statistic.",
    item: {
      overrides: { itemType: "Ring", rarity: "Rare", attunement: true },
      characterEffects: [{ target: "armorClass", mode: "add", value: 1 }],
      text: "You have a +1 bonus to Armor Class while wearing this ring.",
    },
  },
  {
    id: "ability",
    label: "Ability score item",
    hint: "Intelligence becomes 19 while attuned, unless it is higher.",
    item: {
      overrides: { rarity: "Uncommon", attunement: true, bodyPlacements: ["head"] },
      characterEffects: [{ target: "abilityScore", key: "INT", mode: "minimum", value: 19 }],
      text: "Your Intelligence is 19 while you wear this item. It has no effect on you if your Intelligence is already 19 or higher.",
    },
  },
  {
    id: "spell",
    label: "Spell from the item",
    hint: "Cast a spell once per Long Rest without a spell slot.",
    item: {
      overrides: { itemType: "Wand", rarity: "Uncommon", attunement: true },
      grants: {
        castingAbility: { id: "casting", choose: ["INT", "WIS", "CHA"] },
        resources: [{ key: "uses", name: "", fixed: 1, recharge: "long" }],
        spells: [{ ids: [], resource: "uses" }],
      },
      text: "Once per Long Rest, you can cast a spell from this item without expending a spell slot.",
    },
  },
  {
    id: "resistance",
    label: "Resistance",
    hint: "Resistance to one damage type while attuned.",
    item: {
      overrides: { itemType: "Ring", rarity: "Rare", attunement: true },
      grants: { resistances: ["fire"] },
      text: "You have Resistance to Fire damage while wearing this ring.",
    },
  },
  {
    id: "container",
    label: "Container",
    hint: "A bag whose contents weigh nothing.",
    item: {
      overrides: { rarity: "Uncommon", weightLb: 5 },
      container: { capacityLb: 500, weightless: true },
      text: "This bag holds up to 500 pounds of items, and its contents never add to what you carry.",
    },
  },
  {
    id: "potion",
    label: "Potion",
    hint: "A consumable described in words.",
    item: {
      overrides: { itemType: "Potion", rarity: "Common" },
      text: "This potion's magic takes effect when you drink it as a Bonus Action.",
    },
  },
];

/**
 * A new draft shaped by `template`. It keeps the draft's name, set and a
 * description already written; template values its set already gives are
 * left to the set.
 */
export function fromTemplate(
  template: ItemTemplate,
  draft: Item,
  itemSet: ItemSet | undefined,
  t: Translator,
): Item {
  const {
    grants: _grants,
    baseItem: _baseItem,
    container: _container,
    attunementPrerequisites: _requirement,
    ...rest
  } = draft;
  const fields = template.item,
    effects = fields.characterEffects ?? [];
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  return {
    ...rest,
    text: draft.text.trim() !== "" ? draft.text : fields.text ? t(fields.text) : "",
    overrides: moveOverrides(fields.overrides ?? {}, undefined, itemSet),
    characterEffects: copy(effects),
    characterMechanics: mechanicsOf(effects, fields.grants, fields.baseItem),
    ...(fields.grants ? { grants: copy(fields.grants) } : {}),
    ...(fields.baseItem ? { baseItem: copy(fields.baseItem) } : {}),
    ...(fields.container ? { container: { ...fields.container } } : {}),
  };
}
