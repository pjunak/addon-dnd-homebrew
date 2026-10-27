// A species' form: what it is, its size, speeds and senses, its traits, its
// lineages and its grants. Grants use the schema-driven form
// (src/schema-form.ts) over the Engine's vocabulary, grouped for species; a
// lineage's grants add to the species' and are grouped for lineages.
import { problemText, type Translator } from "./catalogs.js";
import {
  actionButton,
  chipsField,
  element,
  formNumber,
  formText,
  formValues,
  markdown,
  messageBlock,
  numberField,
  selectField,
  textArea,
  textField,
} from "./fields.js";
import { damageLabels } from "./grants.js";
import {
  creatureSizes,
  creatureTypes,
  damageTypes,
  flattenSpecies,
  freeId,
  maxLineageText,
  maxLineages,
  maxMarkdown,
  maxTraitText,
  maxTraits,
  movementModes,
  slug,
  speciesProblem,
  type CreatureSize,
  type CreatureType,
  type DamageType,
  type Lineage,
  type Movement,
  type MovementMode,
  type Species,
  type SpeciesTrait,
  type VocabularyValue,
} from "./model.js";
import type { References } from "./references.js";
import { grantsNode, schemaEditor, type FormContext } from "./schema-form.js";
import { declaredKeys } from "./subclass-editor.js";
import { fieldLabel } from "./vocabulary.js";

const movementLabels: Readonly<Record<MovementMode, string>> = {
  fly: "Fly speed",
  swim: "Swim speed",
  climb: "Climb speed",
  burrow: "Burrow speed",
};
const sizeLabels: Readonly<Record<CreatureSize, string>> = {
  Tiny: "Tiny",
  Small: "Small",
  Medium: "Medium",
  Large: "Large",
  Huge: "Huge",
  Gargantuan: "Gargantuan",
};

export interface SpeciesEditorContext {
  readonly document: Document;
  readonly t: Translator;
  readonly references: References | undefined;
  /** Ids in use, for the id a new draft takes from its name. */
  readonly takenIds: () => ReadonlySet<string>;
  readonly changed: () => void;
  readonly restructured: () => void;
}
export interface SpeciesEditor {
  /** The species as the form holds it; validation happens where it is checked. */
  read(): Species;
}

/** One entry of a list the DM adds to and removes from. */
interface Entry<T> {
  readonly node: HTMLElement;
  read(): T;
}
/** Entries rendered from values; adding or removing one renders them again from what the form holds. */
function entryList<T>(
  context: SpeciesEditorContext,
  initial: readonly T[],
  options: {
    readonly add: string;
    readonly max: number;
    readonly blank: () => T;
    readonly render: (value: T, index: number, remove: () => void) => Entry<T>;
  },
): { readonly root: HTMLElement; read(): T[] } {
  const { document, t } = context;
  const root = element(document, "div", "hb-feature-list");
  let entries: Entry<T>[] = [];
  const read = (): T[] => entries.map((entry) => entry.read());
  const rerender = (values: readonly T[]): void => {
    list.replaceChildren();
    entries = values.map((value, index) => {
      const entry = options.render(value, index, () => {
        const current = read();
        current.splice(index, 1);
        rerender(current);
        context.changed();
        context.restructured();
      });
      list.append(entry.node);
      return entry;
    });
    add.disabled = values.length >= options.max;
  };
  const list = element(document, "div", "hb-entries");
  const add = actionButton(document, t(options.add), () => {
    rerender([...read(), options.blank()]);
    context.changed();
    context.restructured();
    list.lastElementChild?.querySelector<HTMLElement>("input")?.focus();
  });
  root.append(list, add);
  rerender(initial);
  return { root, read };
}
const valueOf = (control: HTMLElement): string =>
  control.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")!.value;

/** The species form; fields go into `main`, and the published preview follows the form. */
export function speciesEditor(
  context: SpeciesEditorContext,
  form: HTMLFormElement,
  main: HTMLElement,
  initial: Species,
  saved: boolean,
): SpeciesEditor {
  const { document, t } = context;
  let snapshot: Pick<Species, "grants" | "lineages"> = initial;
  const preview = element(document, "aside", "hb-preview");
  preview.setAttribute("aria-live", "polite");
  const formContext = (subject: FormContext["subject"]): FormContext => ({
    document,
    t,
    references: context.references,
    keys: (source) =>
      declaredKeys(
        {
          ...(snapshot.grants ? { grants: snapshot.grants } : {}),
          features: snapshot.lineages,
        },
        source,
      ),
    changed: () => {
      context.changed();
      update();
    },
    restructured: context.restructured,
    subject,
  });
  const grants = schemaEditor(formContext("species"), grantsNode, initial.grants, {
    path: "grants",
    label: t("Grants"),
  });

  const identity = element(document, "div", "hb-row hb-identity");
  identity.append(
    textField(document, t("Name"), "name", initial.name, { maxLength: 120 }),
    selectField(
      document,
      t("Creature type"),
      "creatureType",
      initial.creatureType,
      creatureTypes.map((type) => [type, t(type)] as const),
    ),
  );
  const body = element(document, "div", "hb-row");
  body.append(
    chipsField(
      document,
      t("Size"),
      "sizes",
      initial.sizes,
      creatureSizes.map((size) => [size, t(sizeLabels[size])] as const),
      t("One size, or several for the player to choose from."),
    ),
    numberField(document, t("Speed (feet)"), "speed", initial.speed, { min: 5, max: 300 }),
    numberField(
      document,
      t("Darkvision (feet)"),
      "darkvision",
      initial.darkvision === 0 ? undefined : initial.darkvision,
      { min: 5, max: 300, placeholder: t("None") },
    ),
  );
  const movement = element(document, "div", "hb-row");
  for (const mode of movementModes) {
    const current = initial.speeds[mode];
    movement.append(
      numberField(
        document,
        t(movementLabels[mode]),
        `speeds.${mode}`,
        typeof current === "number" ? current : undefined,
        { min: 5, max: 300, placeholder: t("None") },
      ),
    );
  }
  const following = chipsField(
    document,
    t("Equal to the walking speed"),
    "speedsEqual",
    movementModes.filter((mode) => initial.speeds[mode] === "speed"),
    movementModes.map((mode) => [mode, t(movementLabels[mode])] as const),
    t("These follow the walking speed, as printed: equal to your Speed."),
  );
  const resistances = chipsField(
    document,
    t("Damage resistances"),
    "resistances",
    initial.resistances,
    damageTypes.map((type) => [type, t(damageLabels[type])] as const),
  );

  const traits = entryList<SpeciesTrait>(context, initial.traits, {
    add: "Add trait",
    max: maxTraits,
    blank: () => ({ name: "", text: "" }),
    render: (trait, index, remove) => {
      const path = `traits[${index}]`;
      const node = element(document, "fieldset", "hb-effects-fieldset hb-feature");
      const legend = element(document, "legend", "", trait.name || t("New trait"));
      const name = textField(document, t("Name"), `${path}.name`, trait.name, { maxLength: 120 });
      const text = textArea(document, t("Text"), `${path}.text`, trait.text, 3, maxTraitText);
      name.querySelector("input")!.addEventListener("input", (event) => {
        legend.textContent =
          (event.currentTarget as HTMLInputElement).value.trim() || t("New trait");
      });
      node.append(legend, name, text, actionButton(document, t("Remove trait"), remove, "danger"));
      return { node, read: () => ({ name: valueOf(name).trim(), text: valueOf(text) }) };
    },
  });

  // Saved characters name their lineage by id, so a saved lineage keeps it.
  const savedLineages = new Set(saved ? initial.lineages.map((lineage) => lineage.id) : []);
  const lineages = entryList<Lineage>(context, initial.lineages, {
    add: "Add lineage",
    max: maxLineages,
    blank: () => ({ id: "", name: "", text: "" }),
    render: (lineage, index, remove) => {
      const path = `lineages[${index}]`;
      const node = element(document, "fieldset", "hb-effects-fieldset hb-feature");
      const legend = element(document, "legend", "", lineage.name || t("New lineage"));
      const name = textField(document, t("Name"), `${path}.name`, lineage.name, {
        maxLength: 120,
      });
      const kept = savedLineages.has(lineage.id);
      const id = textField(document, t("Id"), `${path}.id`, lineage.id, {
        maxLength: 64,
        readOnly: kept,
        placeholder: "high-elf",
        hint: kept
          ? t("Saved characters refer to it; it cannot change.")
          : t("Leave it empty to make one from the name."),
      });
      const text = textArea(document, t("Text"), `${path}.text`, lineage.text, 4, maxLineageText);
      const granted = schemaEditor(formContext("lineage"), grantsNode, lineage.grants, {
        path: `${path}.grants`,
        label: t("Lineage grants"),
      });
      name.querySelector("input")!.addEventListener("input", (event) => {
        const typed = (event.currentTarget as HTMLInputElement).value.trim();
        legend.textContent = typed || t("New lineage");
        // An unsaved lineage shows the id saving will make from its name.
        if (!kept) id.querySelector("input")!.placeholder = typed ? slug(typed) : "high-elf";
      });
      const head = element(document, "div", "hb-feature-head");
      head.append(name, id);
      node.append(
        legend,
        head,
        text,
        granted.root,
        actionButton(document, t("Remove lineage"), remove, "danger"),
      );
      return {
        node,
        read: () => {
          const value = granted.read() as VocabularyValue | undefined;
          return {
            id: valueOf(id).trim(),
            name: valueOf(name).trim(),
            text: valueOf(text),
            ...(value === undefined ? {} : { grants: value }),
          };
        },
      };
    },
  });
  /** Lineages with an id each: a typed one, or one made from the name that no typed one takes. */
  const readLineages = (): Lineage[] => {
    const entered = lineages.read();
    const taken = new Set(entered.map((lineage) => lineage.id).filter((id) => id !== ""));
    return entered.map((lineage) => {
      if (lineage.id !== "") return lineage;
      const id = freeId(lineage.name || "lineage", taken);
      taken.add(id);
      return { ...lineage, id };
    });
  };

  const section = (title: string, hint: string, ...content: HTMLElement[]): HTMLElement => {
    const root = element(document, "fieldset", "hb-effects-fieldset");
    root.append(
      element(document, "legend", "", t(title)),
      element(document, "p", "hb-hint", t(hint)),
      ...content,
    );
    return root;
  };

  const more = element(document, "details", "hb-defaults");
  const id = textField(document, t("Id"), "id", initial.id, {
    maxLength: 64,
    readOnly: saved,
    placeholder: "emberkin",
    hint: saved
      ? t("Used in saved characters; it cannot change after the first save.")
      : t(
          "Leave it empty to make one from the name. Saved characters use it, so it cannot change after the first save.",
        ),
  });
  more.append(element(document, "summary", "", t("Id")), id);

  main.append(
    identity,
    body,
    section(
      "Movement",
      "Special speeds in feet; leave a speed empty for none.",
      movement,
      following,
    ),
    resistances,
    textArea(
      document,
      t("Description"),
      "text",
      initial.text,
      6,
      maxMarkdown,
      t("The species as players read it; its size, speed and senses are added when published."),
    ),
    section(
      "Traits",
      "Each trait is printed with its name, as the books do. What a trait does on the sheet goes in the grants below.",
      traits.root,
    ),
    section(
      "Lineages",
      "Variants a player picks one of, such as High Elf or Drow. A lineage's grants add to the species'.",
      lineages.root,
    ),
    section(
      "What it grants on the sheet",
      "Proficiencies, spells, uses, toggles, choices and more. Add fields from the list.",
      grants.root,
    ),
    more,
  );

  const nameInput = form.querySelector<HTMLInputElement>('input[name="name"]')!,
    idInput = id.querySelector("input")!;
  if (!saved)
    nameInput.addEventListener("input", () => {
      const text = nameInput.value.trim();
      idInput.placeholder = text ? freeId(text, context.takenIds()) : "emberkin";
    });

  function read(): Species {
    const data = new FormData(form);
    const name = formText(data, "name").trim();
    const equal = formValues(data, "speedsEqual");
    const speeds: Partial<Record<MovementMode, Movement>> = {};
    for (const mode of movementModes) {
      const feet = formNumber(data, `speeds.${mode}`);
      if (equal.includes(mode)) speeds[mode] = "speed";
      else if (feet !== undefined) speeds[mode] = feet;
    }
    const granted = grants.read() as VocabularyValue | undefined;
    const value: Species = {
      id: saved ? initial.id : formText(data, "id").trim() || freeId(name, context.takenIds()),
      schemaVersion: 1,
      name,
      creatureType: formText(data, "creatureType") as CreatureType,
      sizes: formValues(data, "sizes") as CreatureSize[],
      speed: formNumber(data, "speed") ?? 0,
      speeds,
      darkvision: formNumber(data, "darkvision") ?? 0,
      resistances: formValues(data, "resistances") as DamageType[],
      traits: traits.read(),
      lineages: readLineages(),
      ...(granted === undefined ? {} : { grants: granted }),
      text: formText(data, "text"),
      updatedAt: Date.now(),
    };
    snapshot = value;
    return value;
  }

  form.append(preview);
  function update(): void {
    // Changes while the form is being built are previewed once it is complete.
    if (!form.contains(preview)) return;
    const species = read();
    const named = { ...species, name: species.name || t("New species") };
    const failure = speciesProblem({
      ...named,
      id: species.id || "species",
    });
    preview.replaceChildren(
      element(document, "h3", "", t("As published")),
      element(document, "p", "hb-preview-name", named.name),
    );
    if (failure) preview.append(messageBlock(document, problemText(t, failure), "alert"));
    const granted = Object.keys(species.grants ?? {}).map((field) =>
      t(fieldLabel("Grants", field)),
    );
    if (granted.length > 0) {
      const list = element(document, "ul", "hb-effect-summary");
      for (const line of granted) list.append(element(document, "li", "", line));
      preview.append(list);
    }
    preview.append(markdown(document, String(flattenSpecies(named).record["text"])));
  }
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
  return { read };
}
