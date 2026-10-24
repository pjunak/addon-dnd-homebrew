// A spell's form: its level, school and class lists, the printed stat block
// and its text. A concentration spell's duration is typed without the
// printed "Concentration, up to", which the form adds back.
import { problemText, type Translator } from "./catalogs.js";
import {
  checkField,
  chipsField,
  element,
  fieldIds,
  formText,
  formValues,
  idsField,
  markdown,
  messageBlock,
  selectField,
  textArea,
  textField,
} from "./fields.js";
import {
  concentrationPrefix,
  flattenSpell,
  freeId,
  maxMarkdown,
  maxSpellLine,
  spellComponents,
  spellProblem,
  spellSchoolNames,
  type Spell,
  type SpellComponent,
  type SpellSchoolName,
} from "./model.js";
import { pickerOptions, type References } from "./references.js";

const componentLabels: Readonly<Record<SpellComponent, string>> = {
  V: "Verbal (V)",
  S: "Somatic (S)",
  M: "Material (M)",
};

/** The duration as the form shows it: without "Concentration, up to" for a concentration spell. */
export function writtenDuration(spell: Pick<Spell, "concentration" | "duration">): string {
  return spell.concentration && spell.duration.startsWith(concentrationPrefix)
    ? spell.duration.slice(concentrationPrefix.length)
    : spell.duration;
}
/** The printed duration for what the form holds. */
export function durationOf(concentration: boolean, written: string): string {
  const typed = written.trim();
  if (!concentration) return typed;
  return (
    concentrationPrefix +
    (typed.startsWith(concentrationPrefix) ? typed.slice(concentrationPrefix.length) : typed)
  );
}

/** "Cantrip" or "Level 3", as the tree and the level picker show it. */
export function spellLevelLabel(t: Translator, level: number): string {
  return level === 0 ? t("Cantrip") : t("Level {level}", { level });
}

export interface SpellEditorContext {
  readonly document: Document;
  readonly t: Translator;
  readonly references: References | undefined;
  /** Ids in use, for the id a new draft takes from its name. */
  readonly takenIds: () => ReadonlySet<string>;
}
export interface SpellEditor {
  /** The spell as the form holds it; validation happens where it is checked. */
  read(): Spell;
}

/** The spell form; fields go into `main`, and the published preview follows the form. */
export function spellEditor(
  context: SpellEditorContext,
  form: HTMLFormElement,
  main: HTMLElement,
  initial: Spell,
  saved: boolean,
): SpellEditor {
  const { document, t } = context;
  const preview = element(document, "aside", "hb-preview");
  preview.setAttribute("aria-live", "polite");
  const line = (label: string, name: string, value: string, suggestions?: readonly string[]) =>
    textField(document, label, name, value, {
      maxLength: maxSpellLine,
      ...(suggestions ? { suggestions } : {}),
    });

  const identity = element(document, "div", "hb-row hb-identity");
  identity.append(
    textField(document, t("Name"), "name", initial.name, { maxLength: 120 }),
    selectField(
      document,
      t("Level"),
      "level",
      String(initial.level),
      Array.from({ length: 10 }, (_, level) => [String(level), spellLevelLabel(t, level)] as const),
    ),
    selectField(
      document,
      t("School"),
      "school",
      initial.school,
      spellSchoolNames.map((school) => [school, t(school)] as const),
    ),
  );
  const classes = idsField(
    document,
    t("Spell lists"),
    "classes",
    initial.classes,
    context.references && pickerOptions(context.references.classes),
    { placeholder: "wizard, sorcerer", hint: t("Class ids, separated by commas.") },
  );
  const casting = element(document, "div", "hb-row");
  casting.append(
    line(t("Casting time"), "castingTime", initial.castingTime, [
      "Action",
      "Bonus Action",
      "Reaction",
      "1 minute",
      "10 minutes",
      "1 hour",
    ]),
    line(t("Range"), "range", initial.range, ["Self", "Touch", "30 feet", "60 feet", "120 feet"]),
    line(t("Duration"), "duration", writtenDuration(initial), [
      "Instantaneous",
      "1 round",
      "1 minute",
      "10 minutes",
      "1 hour",
      "8 hours",
      "Until dispelled",
    ]),
  );
  const flags = element(document, "div", "hb-row");
  flags.append(
    checkField(
      document,
      t("Concentration"),
      "concentration",
      initial.concentration,
      t('Type the duration without "Concentration, up to"; publishing adds it.'),
    ),
    checkField(
      document,
      t("Ritual"),
      "ritual",
      initial.ritual,
      t("It can also be cast as a ritual."),
    ),
  );
  const components = element(document, "div", "hb-row");
  components.append(
    chipsField(
      document,
      t("Components"),
      "components",
      initial.components,
      spellComponents.map((component) => [component, t(componentLabels[component])] as const),
    ),
    line(t("Material"), "material", initial.material),
  );

  const more = element(document, "details", "hb-defaults");
  const id = textField(document, t("Id"), "id", initial.id, {
    maxLength: 64,
    readOnly: saved,
    placeholder: "ember-lance",
    hint: saved
      ? t("Used in saved characters; it cannot change after the first save.")
      : t(
          "Leave it empty to make one from the name. Saved characters use it, so it cannot change after the first save.",
        ),
  });
  more.append(element(document, "summary", "", t("Id")), id);

  main.append(
    identity,
    classes,
    element(
      document,
      "p",
      "hb-hint",
      t(
        "Characters of these classes can learn or prepare it. A subclass or feat can also grant it by its id, hb.<id>.",
      ),
    ),
    casting,
    flags,
    components,
    textArea(
      document,
      t("Description"),
      "text",
      initial.text,
      8,
      maxMarkdown,
      t("What the spell does, as players read it; the stat block above is added when published."),
    ),
    more,
  );

  const nameInput = form.querySelector<HTMLInputElement>('input[name="name"]')!,
    idInput = id.querySelector("input")!;
  if (!saved)
    nameInput.addEventListener("input", () => {
      const text = nameInput.value.trim();
      idInput.placeholder = text ? freeId(text, context.takenIds()) : "ember-lance";
    });

  function read(): Spell {
    const data = new FormData(form);
    const name = formText(data, "name").trim();
    const concentration = data.get("concentration") !== null;
    const picked = formValues(data, "components");
    return {
      id: saved ? initial.id : formText(data, "id").trim() || freeId(name, context.takenIds()),
      schemaVersion: 1,
      name,
      level: Number(formText(data, "level")),
      school: formText(data, "school") as SpellSchoolName,
      classes: fieldIds(form, "classes"),
      ritual: data.get("ritual") !== null,
      concentration,
      castingTime: formText(data, "castingTime").trim(),
      range: formText(data, "range").trim(),
      components: spellComponents.filter((component) => picked.includes(component)),
      material: formText(data, "material").trim(),
      duration: durationOf(concentration, formText(data, "duration")),
      text: formText(data, "text"),
      updatedAt: Date.now(),
    };
  }

  form.append(preview);
  function update(): void {
    const spell = read();
    const published = flattenSpell({ ...spell, name: spell.name || t("New spell") });
    const failure = spellProblem({
      ...spell,
      id: spell.id || "spell",
      name: spell.name || "spell",
    });
    preview.replaceChildren(
      element(document, "h3", "", t("As published")),
      element(document, "p", "hb-preview-name", published.record.name),
    );
    if (failure) preview.append(messageBlock(document, problemText(t, failure), "alert"));
    preview.append(markdown(document, published.record.text));
  }
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
  return { read };
}
