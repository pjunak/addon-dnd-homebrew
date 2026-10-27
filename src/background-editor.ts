// A background's form: the abilities it raises, its origin feat, its skill and
// tool proficiencies, its equipment and text, and its grants. Feats and tools
// are picked from the rules data when it is installed, and typed as ids
// otherwise. Grants use the schema-driven form (src/schema-form.ts), grouped
// for backgrounds.
import { problemText, type Translator } from "./catalogs.js";
import { abilityNames } from "./effects.js";
import {
  chipsField,
  element,
  fieldIds,
  formNumber,
  formText,
  formValues,
  idsField,
  markdown,
  messageBlock,
  numberField,
  selectField,
  textArea,
  textField,
} from "./fields.js";
import {
  abilities,
  backgroundProblem,
  flattenBackground,
  freeId,
  maxEquipmentLine,
  maxMarkdown,
  skillName,
  skills,
  type Ability,
  type Background,
  type Skill,
  type VocabularyValue,
} from "./model.js";
import { pickerOptions, type References } from "./references.js";
import { grantsNode, schemaEditor, type FormContext } from "./schema-form.js";
import { declaredKeys } from "./subclass-editor.js";
import { fieldLabel } from "./vocabulary.js";

export interface BackgroundEditorContext {
  readonly document: Document;
  readonly t: Translator;
  /** Feats (with this campaign's as hb.<id>), tools and spells for pickers. */
  readonly references: References | undefined;
  /** Ids in use, for the id a new draft takes from its name. */
  readonly takenIds: () => ReadonlySet<string>;
  readonly changed: () => void;
  readonly restructured: () => void;
}
export interface BackgroundEditor {
  /** The background as the form holds it; validation happens where it is checked. */
  read(): Background;
}

/** Preset feat choices as typed: "spell-list: wizard, other: value". */
export function featChoicesText(choices: Readonly<Record<string, string>> | undefined): string {
  return Object.entries(choices ?? {})
    .map(([choice, value]) => `${choice}: ${value}`)
    .join(", ");
}
/** The preset feat choices a typed line holds, or undefined for none. */
export function featChoicesOf(text: string): Record<string, string> | undefined {
  const entries = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => {
      const at = part.indexOf(":");
      return at < 0
        ? ([part, ""] as const)
        : ([part.slice(0, at).trim(), part.slice(at + 1).trim()] as const);
    });
  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}

/** The background form; fields go into `main`, and the published preview follows the form. */
export function backgroundEditor(
  context: BackgroundEditorContext,
  form: HTMLFormElement,
  main: HTMLElement,
  initial: Background,
  saved: boolean,
): BackgroundEditor {
  const { document, t } = context;
  let snapshot: VocabularyValue | undefined = initial.grants;
  const preview = element(document, "aside", "hb-preview");
  preview.setAttribute("aria-live", "polite");
  const formContext: FormContext = {
    document,
    t,
    references: context.references,
    keys: (source) => declaredKeys(snapshot ? { grants: snapshot } : {}, source),
    changed: () => {
      context.changed();
      update();
    },
    restructured: context.restructured,
    subject: "background",
  };
  const grants = schemaEditor(formContext, grantsNode, initial.grants, {
    path: "grants",
    label: t("Grants"),
  });

  // Origin feats from the rules data and this campaign; a feat the list lacks stays selectable.
  const originFeats = context.references?.feats.filter((feat) => feat.category === "origin");
  const featField = originFeats
    ? selectField(
        document,
        t("Origin feat"),
        "originFeat",
        initial.originFeat,
        [
          ["", t("None")],
          ...originFeats.map((feat) => [feat.id, feat.name] as const),
          ...(initial.originFeat && !originFeats.some((feat) => feat.id === initial.originFeat)
            ? [[initial.originFeat, initial.originFeat] as const]
            : []),
        ],
        t("The origin feat a character gains at level 1."),
      )
    : textField(document, t("Origin feat"), "originFeat", initial.originFeat, {
        maxLength: 67,
        placeholder: "magic-initiate",
        hint: t("The feat's id, or hb.<id> for this campaign's own; empty for none."),
      });
  if (originFeats && originFeats.length >= 12)
    featField.querySelector("select")!.dataset["ui"] = "combobox";

  const proficiencies = element(document, "div", "hb-row");
  proficiencies.append(
    chipsField(
      document,
      t("Skill proficiencies"),
      "skillProficiencies",
      initial.skillProficiencies,
      skills.map((skill) => [skill, t(skillName(skill))] as const),
    ),
    idsField(
      document,
      t("Tool proficiency"),
      "tools",
      initial.tools,
      context.references && pickerOptions(context.references.tools),
      { placeholder: "tinkers-tools", hint: t("Tool ids, separated by commas.") },
    ),
  );

  const more = element(document, "details", "hb-defaults");
  const id = textField(document, t("Id"), "id", initial.id, {
    maxLength: 64,
    readOnly: saved,
    placeholder: "lamplighter",
    hint: saved
      ? t("Used in saved characters; it cannot change after the first save.")
      : t(
          "Leave it empty to make one from the name. Saved characters use it, so it cannot change after the first save.",
        ),
  });
  more.append(element(document, "summary", "", t("Id")), id);

  const mechanics = element(document, "fieldset", "hb-effects-fieldset");
  mechanics.append(
    element(document, "legend", "", t("What it grants on the sheet")),
    element(
      document,
      "p",
      "hb-hint",
      t(
        "Anything beyond the fields above, such as a language or a resistance. Add fields from the list.",
      ),
    ),
    grants.root,
  );

  main.append(
    textField(document, t("Name"), "name", initial.name, { maxLength: 120 }),
    chipsField(
      document,
      t("Ability scores"),
      "abilityScores",
      initial.abilityScores,
      abilities.map((ability) => [ability, t(abilityNames[ability]!)] as const),
      t("Three abilities; the player adds +2 to one and +1 to another, or +1 to all three."),
    ),
    featField,
    textField(
      document,
      t("Feat choices"),
      "originFeatChoices",
      featChoicesText(initial.originFeatChoices),
      {
        maxLength: 1000,
        placeholder: "spell-list: wizard",
        hint: t(
          "Choices the background makes for its feat, as choice: value, separated by commas. Leave it empty to let the player choose.",
        ),
      },
    ),
    proficiencies,
    numberField(document, t("Tools the player picks"), "toolPicks", initial.toolPicks, {
      min: 1,
      max: 3,
      hint: t("With several tools listed, how many the player picks; one tool is given outright."),
    }),
    textField(document, t("Equipment"), "equipment", initial.equipment, {
      maxLength: maxEquipmentLine,
      placeholder: "Choose A or B: (A) Lantern, Traveler's Clothes, 12 GP; or (B) 50 GP",
    }),
    textArea(
      document,
      t("Description"),
      "text",
      initial.text,
      6,
      maxMarkdown,
      t(
        "The background as players read it; its abilities, feat, proficiencies and equipment are added when published.",
      ),
    ),
    mechanics,
    more,
  );

  const nameInput = form.querySelector<HTMLInputElement>('input[name="name"]')!,
    idInput = id.querySelector("input")!;
  if (!saved)
    nameInput.addEventListener("input", () => {
      const text = nameInput.value.trim();
      idInput.placeholder = text ? freeId(text, context.takenIds()) : "lamplighter";
    });

  function read(): Background {
    const data = new FormData(form);
    const name = formText(data, "name").trim();
    const choices = featChoicesOf(formText(data, "originFeatChoices"));
    const granted = grants.read() as VocabularyValue | undefined;
    snapshot = granted;
    return {
      id: saved ? initial.id : formText(data, "id").trim() || freeId(name, context.takenIds()),
      schemaVersion: 1,
      name,
      abilityScores: formValues(data, "abilityScores") as Ability[],
      originFeat: formText(data, "originFeat").trim(),
      ...(choices === undefined ? {} : { originFeatChoices: choices }),
      skillProficiencies: formValues(data, "skillProficiencies") as Skill[],
      tools: fieldIds(form, "tools"),
      toolPicks: formNumber(data, "toolPicks") ?? 1,
      equipment: formText(data, "equipment").trim(),
      ...(granted === undefined ? {} : { grants: granted }),
      text: formText(data, "text"),
      updatedAt: Date.now(),
    };
  }

  form.append(preview);
  function update(): void {
    // Changes while the form is being built are previewed once it is complete.
    if (!form.contains(preview)) return;
    const background = read();
    const named = { ...background, name: background.name || t("New background") };
    const failure = backgroundProblem({ ...named, id: background.id || "background" });
    preview.replaceChildren(
      element(document, "h3", "", t("As published")),
      element(document, "p", "hb-preview-name", named.name),
    );
    if (failure) preview.append(messageBlock(document, problemText(t, failure), "alert"));
    const granted = Object.keys(background.grants ?? {}).map((field) =>
      t(fieldLabel("Grants", field)),
    );
    if (granted.length > 0) {
      const list = element(document, "ul", "hb-effect-summary");
      for (const line of granted) list.append(element(document, "li", "", line));
      preview.append(list);
    }
    preview.append(markdown(document, String(flattenBackground(named).record["text"])));
  }
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
  return { read };
}
