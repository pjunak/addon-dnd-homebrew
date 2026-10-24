// A feat's form: what it is, its prerequisite, its text and its grants. The
// prerequisite form covers the printed patterns; a prerequisite from a file
// that it cannot show is kept as it is. Grants use the schema-driven form
// (src/schema-form.ts) over the Engine's vocabulary, grouped for feats.
import { problemText, type Translator } from "./catalogs.js";
import { abilityNames } from "./effects.js";
import {
  actionButton,
  checkField,
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
import {
  abilities,
  armorTrainings,
  featCategories,
  featProblem,
  fightingStyleFeatures,
  flattenFeat,
  freeId,
  isRecord,
  maxMarkdown,
  prerequisiteWords,
  weaponTrainings,
  type Ability,
  type Feat,
  type FeatCategory,
  type Prerequisite,
  type Repeatable,
  type VocabularyValue,
} from "./model.js";
import type { References } from "./references.js";
import { grantsNode, schemaEditor, type FormContext } from "./schema-form.js";
import { declaredKeys } from "./subclass-editor.js";
import { fieldLabel } from "./vocabulary.js";

export const featCategoryLabels: Readonly<Record<FeatCategory, string>> = {
  origin: "Origin",
  general: "General",
  fightingStyle: "Fighting Style",
  epicBoon: "Epic Boon",
};

/** The prerequisite the form shows: each part optional, abilities any one of them. */
export interface SimplePrerequisite {
  readonly level?: number;
  readonly abilities: readonly Ability[];
  readonly score: number;
  readonly casting: "" | "spellcaster" | "spellcastingFeature";
  readonly armorTraining: "" | (typeof armorTrainings)[number];
  readonly weaponTraining: "" | (typeof weaponTrainings)[number];
  readonly fightingStyle: boolean;
}
const noPrerequisite: SimplePrerequisite = {
  abilities: [],
  score: 13,
  casting: "",
  armorTraining: "",
  weaponTraining: "",
  fightingStyle: false,
};

/** The Engine's prerequisite for the form's values. */
export function prerequisiteOf(form: SimplePrerequisite): Prerequisite {
  const result: Record<string, unknown> = {};
  if (form.level !== undefined) result["level"] = form.level;
  const groups: Prerequisite[][] = [];
  if (form.abilities.length === 1) result["abilities"] = { [form.abilities[0]!]: form.score };
  else if (form.abilities.length > 1)
    groups.push(form.abilities.map((ability) => ({ abilities: { [ability]: form.score } })));
  if (form.casting) result[form.casting] = true;
  if (form.armorTraining) result["armorTraining"] = form.armorTraining;
  if (form.weaponTraining) result["weaponTraining"] = form.weaponTraining;
  if (form.fightingStyle) groups.push(fightingStyleFeatures.map((feature) => ({ feature })));
  if (groups.length === 1) result["any"] = groups[0];
  else if (groups.length > 1) result["all"] = groups.map((any) => ({ any }));
  return result;
}

/**
 * The form's values for a prerequisite, or undefined when the form cannot
 * show it. Printed feats repeat the level in each "any" branch; a level every
 * branch shares is read as the feat's own.
 */
export function simplePrerequisite(value: Prerequisite): SimplePrerequisite | undefined {
  const rest: Record<string, unknown> = { ...value };
  const groups: unknown[] = [];
  if (rest["any"] !== undefined) groups.push(rest["any"]);
  if (Array.isArray(rest["all"])) {
    for (const entry of rest["all"]) {
      if (!isRecord(entry) || Object.keys(entry).length !== 1 || !Array.isArray(entry["any"]))
        return undefined;
      groups.push(entry["any"]);
    }
  } else if (rest["all"] !== undefined) return undefined;
  delete rest["any"];
  delete rest["all"];
  let form: { -readonly [K in keyof SimplePrerequisite]: SimplePrerequisite[K] } = {
    ...noPrerequisite,
  };
  for (const group of groups) {
    if (!Array.isArray(group) || group.length === 0 || !group.every(isRecord)) return undefined;
    const branches = group as Record<string, unknown>[];
    if (
      branches.length === fightingStyleFeatures.length &&
      branches.every(
        (branch, index) =>
          Object.keys(branch).length === 1 && branch["feature"] === fightingStyleFeatures[index],
      ) &&
      !form.fightingStyle
    ) {
      form.fightingStyle = true;
      continue;
    }
    const level = branches[0]!["level"];
    const picked = branches.map((branch) => {
      const scores = branch["abilities"];
      return isRecord(scores) &&
        Object.keys(scores).length === 1 &&
        Object.keys(branch).length === (level === undefined ? 1 : 2) &&
        branch["level"] === level
        ? Object.entries(scores)[0]!
        : undefined;
    });
    if (
      form.abilities.length > 0 ||
      picked.some((entry) => entry === undefined) ||
      !picked.every((entry) => entry![1] === picked[0]![1]) ||
      (level !== undefined && rest["level"] !== undefined && rest["level"] !== level)
    )
      return undefined;
    form.abilities = picked.map((entry) => entry![0] as Ability);
    form.score = picked[0]![1] as number;
    if (level !== undefined) rest["level"] = level;
  }
  for (const [key, entry] of Object.entries(rest)) {
    switch (key) {
      case "level":
        form.level = entry as number;
        break;
      case "abilities": {
        if (!isRecord(entry) || Object.keys(entry).length !== 1 || form.abilities.length > 0)
          return undefined;
        const [ability, score] = Object.entries(entry)[0]!;
        form = { ...form, abilities: [ability as Ability], score: score as number };
        break;
      }
      case "spellcaster":
      case "spellcastingFeature":
        if (entry !== true || form.casting) return undefined;
        form.casting = key;
        break;
      case "armorTraining":
        form.armorTraining = entry as SimplePrerequisite["armorTraining"];
        break;
      case "weaponTraining":
        form.weaponTraining = entry as SimplePrerequisite["weaponTraining"];
        break;
      default:
        return undefined;
    }
  }
  return form;
}

type TemplateFields = Pick<Feat, "category" | "prerequisites" | "repeatable"> &
  Partial<Pick<Feat, "grants" | "text">>;
/** A kind of feat a new draft can start from; its words are English. */
export interface FeatTemplate {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly feat: TemplateFields;
}
const anyAbility = { choose: 1, amount: 1, from: [...abilities] };
export const featTemplates: readonly FeatTemplate[] = [
  {
    id: "origin",
    label: "Origin feat",
    hint: "Taken at level 1 through a background; no prerequisite.",
    feat: { category: "origin", prerequisites: {}, repeatable: false },
  },
  {
    id: "general",
    label: "General feat",
    hint: "Level 4 or higher, with +1 to one ability score.",
    feat: {
      category: "general",
      prerequisites: { level: 4 },
      repeatable: false,
      grants: { abilityScoreIncrease: anyAbility },
    },
  },
  {
    id: "fighting-style",
    label: "Fighting style",
    hint: "Taken with a Fighting Style feature.",
    feat: {
      category: "fightingStyle",
      prerequisites: { any: fightingStyleFeatures.map((feature) => ({ feature })) },
      repeatable: false,
    },
  },
  {
    id: "epic-boon",
    label: "Epic boon",
    hint: "Level 19 or higher, with +1 to one ability score, up to 30.",
    feat: {
      category: "epicBoon",
      prerequisites: { level: 19 },
      repeatable: false,
      grants: { abilityScoreIncrease: { ...anyAbility, cap: 30 } },
    },
  },
];

/** A new draft shaped by `template`, keeping its name, id and written text. */
export function featFromTemplate(template: FeatTemplate, draft: Feat): Feat {
  const { grants: _grants, ...rest } = draft;
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  return {
    ...rest,
    category: template.feat.category,
    prerequisites: copy(template.feat.prerequisites),
    repeatable: template.feat.repeatable,
    ...(template.feat.grants ? { grants: copy(template.feat.grants) } : {}),
  };
}

export interface FeatEditorContext {
  readonly document: Document;
  readonly t: Translator;
  readonly references: References | undefined;
  /** Ids in use, for the id a new draft takes from its name. */
  readonly takenIds: () => ReadonlySet<string>;
  readonly changed: () => void;
  readonly restructured: () => void;
  /** Opens a new draft again as `feat`; only for new drafts. */
  readonly restart?: (feat: Feat) => void;
}
export interface FeatEditor {
  /** The feat as the form holds it; validation happens where it is checked. */
  read(): Feat;
}

/** The feat form; fields go into `main`, and the published preview follows the form. */
export function featEditor(
  context: FeatEditorContext,
  form: HTMLFormElement,
  main: HTMLElement,
  initial: Feat,
  saved: boolean,
): FeatEditor {
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
    subject: "feat",
  };
  const grants = schemaEditor(formContext, grantsNode, initial.grants, {
    path: "grants",
    label: t("Grants"),
  });

  if (!saved && context.restart) {
    const bar = element(document, "div", "hb-templates");
    bar.append(element(document, "span", "hb-templates-label", t("Start from")));
    for (const template of featTemplates) {
      const button = actionButton(
        document,
        t(template.label),
        () => context.restart?.(featFromTemplate(template, read())),
        "quiet",
      );
      button.title = t(template.hint);
      bar.append(button);
    }
    main.append(bar);
  }

  const identity = element(document, "div", "hb-row hb-identity");
  identity.append(
    textField(document, t("Name"), "name", initial.name, { maxLength: 120 }),
    selectField(
      document,
      t("Category"),
      "category",
      initial.category,
      featCategories.map((category) => [category, t(featCategoryLabels[category])] as const),
      t(
        "Where the Builder offers it: backgrounds, ability score levels, fighting styles or level 19.",
      ),
    ),
  );

  // The prerequisite: the simple form, or a file's prerequisite kept as it is.
  const prerequisite = element(document, "fieldset", "hb-effects-fieldset");
  let kept: Prerequisite | undefined;
  const renderPrerequisite = (value: Prerequisite): void => {
    const simple = simplePrerequisite(value);
    kept = simple ? undefined : value;
    prerequisite.replaceChildren(element(document, "legend", "", t("Prerequisite")));
    if (!simple) {
      prerequisite.append(
        element(
          document,
          "p",
          "hb-hint",
          t("From a file, kept as it is: {words}", { words: prerequisiteWords(value) }),
        ),
        actionButton(document, t("Replace with a simple prerequisite"), () => {
          renderPrerequisite({});
          context.changed();
          context.restructured();
          update();
        }),
      );
      return;
    }
    const scores = element(document, "div", "hb-row");
    scores.append(
      numberField(document, t("Level at least"), "prereqLevel", simple.level, {
        min: 1,
        max: 20,
        placeholder: t("Any"),
      }),
      numberField(document, t("Ability score at least"), "prereqScore", simple.score, {
        min: 1,
        max: 30,
      }),
    );
    const training = element(document, "div", "hb-row");
    training.append(
      selectField(document, t("Spellcasting"), "prereqCasting", simple.casting, [
        ["", t("Not needed")],
        ["spellcaster", t("Can cast at least one spell")],
        ["spellcastingFeature", t("A Spellcasting or Pact Magic feature")],
      ]),
      selectField(document, t("Armor training"), "prereqArmor", simple.armorTraining, [
        ["", t("Not needed")],
        ...armorTrainings.map((value) => [value, t(trainingLabels[value]!)] as const),
      ]),
      selectField(document, t("Weapon training"), "prereqWeapon", simple.weaponTraining, [
        ["", t("Not needed")],
        ...weaponTrainings.map((value) => [value, t(trainingLabels[value]!)] as const),
      ]),
    );
    prerequisite.append(
      element(
        document,
        "p",
        "hb-hint",
        t("Leave everything empty for a feat anyone can take. Sheets check it in the Builder."),
      ),
      scores,
      chipsField(
        document,
        t("In one of these abilities"),
        "prereqAbilities",
        simple.abilities,
        abilities.map((ability) => [ability, t(abilityNames[ability]!)] as const),
        t("With several, any one of them is enough."),
      ),
      training,
      checkField(
        document,
        t("Requires a Fighting Style feature"),
        "prereqFightingStyle",
        simple.fightingStyle,
      ),
    );
  };
  renderPrerequisite(initial.prerequisites);

  const repeat = initial.repeatable;
  const repeatField = selectField(
    document,
    t("Can be taken"),
    "repeatable",
    repeat === true ? "always" : repeat === false ? "once" : "choice",
    [
      ["once", t("Once")],
      ["always", t("Any number of times")],
      ...(typeof repeat === "object"
        ? [["choice", t("Once for each value of {choice}", { choice: repeat.choice })] as const]
        : []),
    ],
  );

  const mechanics = element(document, "fieldset", "hb-effects-fieldset");
  mechanics.append(
    element(document, "legend", "", t("What it grants on the sheet")),
    element(
      document,
      "p",
      "hb-hint",
      t(
        "Anything a printed feat grants: an ability score increase, proficiencies, spells, uses, bonuses and more. Add fields from the list.",
      ),
    ),
    grants.root,
  );

  const more = element(document, "details", "hb-defaults");
  const id = textField(document, t("Id"), "id", initial.id, {
    maxLength: 64,
    readOnly: saved,
    placeholder: "storm-touched",
    hint: saved
      ? t("Used in saved characters; it cannot change after the first save.")
      : t(
          "Leave it empty to make one from the name. Saved characters use it, so it cannot change after the first save.",
        ),
  });
  more.append(element(document, "summary", "", t("Id")), id);

  main.append(
    identity,
    prerequisite,
    repeatField,
    textField(document, t("Summary"), "excerpt", initial.excerpt, {
      maxLength: 300,
      hint: t("One line the sheet shows on the feat: numbers, dice and actions."),
    }),
    textArea(
      document,
      t("Description"),
      "text",
      initial.text,
      6,
      maxMarkdown,
      t("The feat as players read it."),
    ),
    mechanics,
    more,
  );

  const nameInput = form.querySelector<HTMLInputElement>('input[name="name"]')!,
    idInput = id.querySelector("input")!;
  if (!saved)
    nameInput.addEventListener("input", () => {
      const text = nameInput.value.trim();
      idInput.placeholder = text ? freeId(text, context.takenIds()) : "storm-touched";
    });

  function read(): Feat {
    const data = new FormData(form);
    const name = formText(data, "name").trim();
    const level = formNumber(data, "prereqLevel");
    const prerequisites =
      kept ??
      prerequisiteOf({
        ...(level === undefined ? {} : { level }),
        abilities: formValues(data, "prereqAbilities") as Ability[],
        score: formNumber(data, "prereqScore") ?? 13,
        casting: formText(data, "prereqCasting") as SimplePrerequisite["casting"],
        armorTraining: formText(data, "prereqArmor") as SimplePrerequisite["armorTraining"],
        weaponTraining: formText(data, "prereqWeapon") as SimplePrerequisite["weaponTraining"],
        fightingStyle: data.get("prereqFightingStyle") !== null,
      });
    const choice = formText(data, "repeatable");
    const repeatable: Repeatable =
      choice === "always"
        ? true
        : choice === "choice" && typeof repeat === "object"
          ? repeat
          : false;
    const granted = grants.read() as VocabularyValue | undefined;
    snapshot = granted;
    return {
      id: saved ? initial.id : formText(data, "id").trim() || freeId(name, context.takenIds()),
      schemaVersion: 1,
      name,
      category: formText(data, "category") as FeatCategory,
      prerequisites,
      repeatable,
      text: formText(data, "text"),
      excerpt: formText(data, "excerpt").trim(),
      ...(granted === undefined ? {} : { grants: granted }),
      updatedAt: Date.now(),
    };
  }

  form.append(preview);
  function update(): void {
    // Changes while the form is being built are previewed once it is complete.
    if (!form.contains(preview)) return;
    const feat = read();
    const published = flattenFeat({ ...feat, name: feat.name || t("New feat") });
    const failure = featProblem({ ...feat, id: feat.id || "feat", name: feat.name || "feat" });
    preview.replaceChildren(
      element(document, "h3", "", t("As published")),
      element(document, "p", "hb-preview-name", String(published.record["name"])),
    );
    if (failure) preview.append(messageBlock(document, problemText(t, failure), "alert"));
    const granted = Object.keys(feat.grants ?? {}).map((field) => t(fieldLabel("Grants", field)));
    if (granted.length > 0) {
      const list = element(document, "ul", "hb-effect-summary");
      for (const line of granted) list.append(element(document, "li", "", line));
      preview.append(list);
    }
    preview.append(markdown(document, String(published.record["text"])));
  }
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
  return { read };
}

const trainingLabels: Readonly<Record<string, string>> = {
  light: "Light armor",
  medium: "Medium armor",
  heavy: "Heavy armor",
  shield: "Shields",
  simple: "Simple weapons",
  martial: "Martial weapons",
};
