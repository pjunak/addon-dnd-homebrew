// A subclass's mechanics and features. Each part is a schema-driven editor
// (src/schema-form.ts) over the Engine's grants vocabulary, so a feature can
// grant anything a printed subclass feature can. The page around it owns the
// name, class, text, saving and the preview.
import type { Translator } from "./catalogs.js";
import { actionButton, checkField, element, numberField, textArea, textField } from "./fields.js";
import {
  freeId,
  maxFeatures,
  maxMarkdown,
  resourceGrantSchema,
  spellGrantSchema,
  type CastingRow,
  type Subclass,
  type SubclassFeature,
  type SubclassSpellcasting,
  type TableColumn,
  type VocabularyValue,
} from "./model.js";
import type { References } from "./references.js";
import type { SchemaNode } from "./schema.js";
import {
  grantsNode,
  schemaEditor,
  type FormContext,
  type KeySource,
  type ValueEditor,
} from "./schema-form.js";

export type Mechanics = Pick<
  Subclass,
  | "spells"
  | "grants"
  | "classResources"
  | "tableColumns"
  | "spellcasting"
  | "progression"
  | "features"
>;
export interface MechanicsEditor {
  readonly root: HTMLElement;
  /** The mechanics as entered; validation happens where the subclass is checked. */
  read(): Mechanics;
}
export interface MechanicsHooks {
  readonly document: Document;
  readonly t: Translator;
  readonly references: References | undefined;
  /** The subclass level the form shows, for new features and spellcasting. */
  readonly subclassLevel: () => number;
  readonly changed: () => void;
  readonly restructured: () => void;
}

// Shapes of the subclass's own tables, for the same form as the vocabulary.
// The contracts and src/model.ts check them; these only lay out the fields.
const columnSchema: SchemaNode = {
  title: "TableColumn",
  type: "object",
  properties: {
    key: { type: "string" },
    name: { type: "string" },
    progression: {
      type: "array",
      items: {
        title: "ColumnValue",
        type: "object",
        properties: { level: { type: "integer" }, value: { type: ["integer", "string"] } },
        required: ["level", "value"],
        additionalProperties: false,
      },
    },
  },
  required: ["key", "name", "progression"],
  additionalProperties: false,
};
const spellcastingSchema: SchemaNode = {
  title: "Spellcasting",
  type: "object",
  properties: {
    ability: { type: "string" },
    type: { const: "third" },
    startLevel: { type: "integer" },
    prepares: { type: "string" },
    spellListClassId: { type: "string" },
    levelReplacements: { type: "integer" },
    ritual: { type: "boolean" },
  },
  required: ["ability", "type", "startLevel", "prepares", "spellListClassId"],
  additionalProperties: false,
};
const progressionSchema: SchemaNode = {
  type: "array",
  items: {
    title: "CastingRow",
    type: "object",
    properties: {
      level: { type: "integer" },
      cantripsKnown: { type: "integer" },
      preparedSpells: { type: "integer" },
      spellSlots: { type: "array", items: { type: "integer" } },
    },
    required: ["level", "cantripsKnown", "preparedSpells", "spellSlots"],
    additionalProperties: false,
  },
};
const listOf = (items: SchemaNode): SchemaNode => ({ type: "array", items });

/**
 * Spell slots of a third caster, from the multiclass table at a third of the
 * class level rounded up; the DM fills in cantrips and prepared spells.
 */
const multiclassSlots: readonly (readonly number[])[] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
];
export function thirdCasterTable(startLevel: number): CastingRow[] {
  const rows: CastingRow[] = [];
  for (let level = Math.max(1, startLevel); level <= 20; level++)
    rows.push({
      level,
      cantripsKnown: 0,
      preparedSpells: 0,
      spellSlots: [...multiclassSlots[Math.ceil(level / 3) - 1]!],
    });
  return rows;
}

/** What declares keys: grants, and parts such as features or lineages with their own. */
export type KeyHolder = Partial<Pick<Mechanics, "grants" | "classResources" | "tableColumns">> & {
  readonly features?: readonly { readonly grants?: VocabularyValue }[];
};
const grantsOf = (mechanics: KeyHolder): VocabularyValue[] => [
  ...(mechanics.grants ? [mechanics.grants] : []),
  ...(mechanics.features ?? []).flatMap((feature) => (feature.grants ? [feature.grants] : [])),
];
const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
      )
    : [];
const texts = (values: readonly unknown[]): string[] =>
  values.filter((entry): entry is string => typeof entry === "string" && entry !== "");
/** Keys the draft declares, so fields that name one can offer them. */
export function declaredKeys(mechanics: KeyHolder, source: KeySource): string[] {
  const grants = grantsOf(mechanics);
  const found =
    source === "column"
      ? (mechanics.tableColumns ?? []).map((column) => column.key)
      : source === "resource"
        ? [
            ...records(mechanics.classResources).map((entry) => entry["key"]),
            ...grants.flatMap((entry) =>
              records(entry["resources"]).map((resource) => resource["key"]),
            ),
          ]
        : grants.flatMap((entry) =>
            records(entry[source === "activation" ? "activations" : "choices"]).map(
              (item) => item["id"],
            ),
          );
  return [...new Set(texts(found))].sort();
}

function section(hooks: MechanicsHooks, title: string, hint: string): HTMLFieldSetElement {
  const root = element(hooks.document, "fieldset", "hb-effects-fieldset");
  root.append(
    element(hooks.document, "legend", "", hooks.t(title)),
    element(hooks.document, "p", "hb-hint", hooks.t(hint)),
  );
  return root;
}

interface FeatureEditor {
  readonly node: HTMLElement;
  read(taken: Set<string>): SubclassFeature;
}
function featureEditor(
  hooks: MechanicsHooks,
  context: FormContext,
  feature: SubclassFeature,
  index: number,
  saved: boolean,
  remove: () => void,
): FeatureEditor {
  const { document, t } = hooks;
  const path = `features[${index}]`;
  const node = element(document, "fieldset", "hb-effects-fieldset hb-feature");
  const legend = element(document, "legend", "", feature.name || t("New feature"));
  const name = textField(document, t("Name"), `${path}.name`, feature.name, { maxLength: 120 });
  const id = textField(document, t("Id"), `${path}.id`, feature.id, {
    maxLength: 64,
    readOnly: saved,
    placeholder: "war-drum",
    hint: saved
      ? t("Saved characters refer to it; it cannot change.")
      : t("Leave it empty to make one from the name."),
  });
  const level = numberField(document, t("Level"), `${path}.level`, feature.level, {
    min: 1,
    max: 20,
  });
  const excerpt = textField(document, t("Summary"), `${path}.excerpt`, feature.excerpt, {
    maxLength: 300,
    hint: t("One line the sheet shows on the feature: numbers, dice and actions."),
  });
  const text = textArea(document, t("Description"), `${path}.text`, feature.text, 5, maxMarkdown);
  const grants = schemaEditor(context, grantsNode, feature.grants, {
    path: `${path}.grants`,
    label: t("Grants"),
  });
  const nameInput = name.querySelector("input")!,
    idInput = id.querySelector("input")!;
  nameInput.addEventListener("input", () => {
    legend.textContent = nameInput.value.trim() || t("New feature");
  });
  const row = element(document, "div", "hb-feature-head");
  row.append(name, id, level);
  node.append(
    legend,
    row,
    excerpt,
    text,
    grants.root,
    actionButton(document, t("Remove feature"), remove, "danger"),
  );
  const value = (control: HTMLElement): string =>
    control.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")!.value;
  return {
    node,
    read: (taken) => {
      const featureName = nameInput.value.trim();
      const featureId = idInput.value.trim() || freeId(featureName || "feature", taken);
      taken.add(featureId);
      const entered = value(level).trim();
      const read = grants.read();
      return {
        id: featureId,
        level: entered === "" ? 0 : Number(entered),
        name: featureName,
        text: value(text),
        excerpt: value(excerpt).trim(),
        ...(read === undefined ? {} : { grants: read as VocabularyValue }),
      };
    },
  };
}

/** The editors of a subclass's mechanics, from `value`; `saved` features keep their ids. */
export function mechanicsEditor(
  hooks: MechanicsHooks,
  value: Subclass,
  saved: ReadonlySet<string>,
): MechanicsEditor {
  const { document, t } = hooks;
  let snapshot: Partial<Mechanics> = value;
  const context: FormContext = {
    document,
    t,
    references: hooks.references,
    keys: (source) => declaredKeys(snapshot, source),
    changed: () => {
      hooks.changed();
      refresh();
    },
    restructured: hooks.restructured,
    subject: "subclass",
  };
  const root = element(document, "div", "hb-mechanics");

  // Features
  const features = section(
    hooks,
    "Features",
    "Each feature arrives at its class level with its text and grants; grants apply on character sheets.",
  );
  const featureList = element(document, "div", "hb-feature-list");
  let featureEditors: FeatureEditor[] = [];
  const readFeatures = (): SubclassFeature[] => {
    const taken = new Set<string>();
    // Typed ids first, so a made-up one never takes a typed one's id.
    for (const editor of featureEditors) {
      const typed = editor.node.querySelector<HTMLInputElement>('input[name$=".id"]')?.value.trim();
      if (typed) taken.add(typed);
    }
    return featureEditors.map((editor) => editor.read(taken));
  };
  const addFeature = actionButton(document, t("Add feature"), () => {
    const current = readFeatures();
    current.push({
      id: "",
      level: current.at(-1)?.level ?? hooks.subclassLevel(),
      name: "",
      text: "",
      excerpt: "",
    });
    renderFeatures(current);
    context.changed();
    hooks.restructured();
    featureList.lastElementChild?.querySelector<HTMLElement>("input")?.focus();
  });
  const renderFeatures = (values: readonly SubclassFeature[]): void => {
    featureList.replaceChildren();
    featureEditors = values.map((feature, index) => {
      const editor = featureEditor(hooks, context, feature, index, saved.has(feature.id), () => {
        const current = readFeatures();
        current.splice(index, 1);
        renderFeatures(current);
        context.changed();
        hooks.restructured();
      });
      featureList.append(editor.node);
      return editor;
    });
    addFeature.disabled = values.length >= maxFeatures;
  };
  renderFeatures(value.features);
  features.append(featureList, addFeature);

  // Subclass-wide mechanics
  const wide = section(
    hooks,
    "Subclass-wide",
    "Grants, spells and pools that belong to the subclass itself, from its subclass level.",
  );
  const grants = schemaEditor(context, grantsNode, value.grants, {
    path: "grants",
    label: t("Subclass grants"),
  });
  const spells = schemaEditor(context, listOf(spellGrantSchema), value.spells, {
    path: "spells",
    label: t("Subclass spells"),
    hint: t("Spells from a class level, such as domain spells."),
    required: true,
    start: () => ({ level: hooks.subclassLevel(), ids: [], alwaysPrepared: true }),
  });
  const resources = schemaEditor(context, listOf(resourceGrantSchema), value.classResources, {
    path: "classResources",
    label: t("Class resources"),
    hint: t("Pools such as superiority dice; features spend them by key."),
    required: true,
  });
  const columns = schemaEditor(context, listOf(columnSchema), value.tableColumns, {
    path: "tableColumns",
    label: t("Table columns"),
    hint: t("Printed per-level values, such as a die that grows; grants read them by key."),
    required: true,
  });
  wide.append(grants.root, spells.root, resources.root, columns.root);

  // Spellcasting
  const casting = section(
    hooks,
    "Spellcasting",
    "A subclass that casts spells of its own, as the Eldritch Knight does: a third caster.",
  );
  const castsSpells = checkField(
    document,
    t("This subclass casts spells"),
    "castsSpells",
    value.spellcasting !== undefined,
  );
  const castingSlot = element(document, "div", "hb-mechanics");
  let castingEditors: { spellcasting: ValueEditor; progression: ValueEditor } | undefined;
  const renderCasting = (
    spellcasting?: SubclassSpellcasting,
    progression?: readonly CastingRow[],
  ): void => {
    castingSlot.replaceChildren();
    castingEditors = undefined;
    if (!spellcasting) return;
    castingEditors = {
      spellcasting: schemaEditor(context, spellcastingSchema, spellcasting, {
        path: "spellcasting",
        label: t("How it casts"),
        required: true,
      }),
      progression: schemaEditor(
        context,
        progressionSchema,
        progression ?? thirdCasterTable(spellcasting.startLevel),
        {
          path: "progression",
          label: t("Spells by level"),
          hint: t(
            "A new table has a third caster's spell slots; give cantrips and prepared spells per level.",
          ),
          required: true,
        },
      ),
    };
    castingSlot.append(castingEditors.spellcasting.root, castingEditors.progression.root);
  };
  renderCasting(value.spellcasting, value.progression);
  castsSpells.querySelector("input")!.addEventListener("change", (event) => {
    const on = (event.target as HTMLInputElement).checked;
    const level = hooks.subclassLevel();
    renderCasting(
      on
        ? {
            ability: "INT",
            type: "third",
            startLevel: level,
            prepares: "list",
            spellListClassId: "wizard",
          }
        : undefined,
    );
    hooks.restructured();
  });
  casting.append(castsSpells, castingSlot);

  root.append(features, wide, casting);
  const read = (): Mechanics => {
    const grantsValue = grants.read();
    return {
      spells: spells.read() as VocabularyValue[],
      ...(grantsValue === undefined ? {} : { grants: grantsValue as VocabularyValue }),
      classResources: resources.read() as VocabularyValue[],
      tableColumns: columns.read() as TableColumn[],
      ...(castingEditors
        ? {
            spellcasting: castingEditors.spellcasting.read() as SubclassSpellcasting,
            progression: castingEditors.progression.read() as CastingRow[],
          }
        : {}),
      features: readFeatures(),
    };
  };
  const refresh = (): void => {
    snapshot = read();
  };
  root.addEventListener("change", refresh);
  return { root, read };
}
