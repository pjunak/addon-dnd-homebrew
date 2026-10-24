import type { Translator } from "./catalogs.js";
import {
  checkField,
  element,
  formText,
  idsField,
  numberField,
  selectField,
  textField,
} from "./fields.js";
import { maxWeight, type AttunementRequirement, type Container, type Item } from "./model.js";
import { pickerOptions, type References } from "./references.js";

type Who = "" | "spellcaster" | "classes" | "text";

/** The classes of a requirement with their minimum levels, in order. */
function classLevels(requirement: AttunementRequirement | undefined): Map<string, number> {
  const entries =
    requirement === undefined
      ? []
      : "classes" in requirement
        ? [requirement.classes]
        : "any" in requirement
          ? requirement.any.map((entry) => entry.classes)
          : [];
  return new Map(entries.flatMap((entry) => Object.entries(entry)));
}

export interface AttunementFields {
  readonly root: HTMLElement;
  /** Shows the requirement only while the item requires attunement. */
  show(attuned: boolean): void;
}

/**
 * Who may attune. The controls for one choice are shown only while it
 * applies; reading takes the form's current values.
 */
export function attunementFields(
  document: Document,
  t: Translator,
  item: Item,
  references?: References,
): AttunementFields {
  const root = element(document, "div", "hb-attunement");
  const requirement = item.attunementPrerequisites;
  const who: Who =
    requirement === undefined
      ? ""
      : "spellcaster" in requirement
        ? "spellcaster"
        : "text" in requirement
          ? "text"
          : "classes";
  const whoField = selectField(document, t("Who can attune"), "requirement", who, [
    ["", t("Anyone")],
    ["spellcaster", t("A spellcaster")],
    ["classes", t("Members of these classes")],
    ["text", t("Described in words; the DM confirms it")],
  ]);
  const classes = idsField(
    document,
    t("Classes"),
    "requirementClasses",
    [...classLevels(requirement).keys()],
    references && pickerOptions(references.classes),
    { placeholder: "cleric, paladin", hint: t("Class ids, separated by commas.") },
  );
  const words = textField(
    document,
    t("Requirement"),
    "requirementText",
    requirement && "text" in requirement ? requirement.text : "",
    {
      maxLength: 300,
      placeholder: t("a Dwarf"),
      hint: t('Read after "Requires Attunement by".'),
    },
  );
  const showChoice = (): void => {
    const chosen = whoField.querySelector("select")!.value as Who;
    classes.hidden = chosen !== "classes";
    words.hidden = chosen !== "text";
  };
  // The form's own change listener marks the draft dirty and redraws the preview.
  whoField.querySelector("select")!.addEventListener("change", showChoice);
  root.append(whoField, classes, words);
  showChoice();
  return {
    root,
    show(attuned) {
      root.hidden = !attuned;
    },
  };
}

/** What the item holds; the capacity shows only for a container. */
export function containerFields(document: Document, t: Translator, item: Item): HTMLElement {
  const root = element(document, "div", "hb-container");
  const container = item.container;
  const holds = checkField(
    document,
    t("Holds other items"),
    "container",
    container !== undefined,
    t("A container's contents count toward its holder's load unless they weigh nothing."),
  );
  const capacity = numberField(
    document,
    t("Capacity (lb)"),
    "containerCapacity",
    container?.capacityLb,
    {
      min: 0,
      max: maxWeight,
      step: "any",
    },
  );
  const weightless = checkField(
    document,
    t("Its contents weigh nothing"),
    "containerWeightless",
    container?.weightless === true,
  );
  const details = element(document, "div", "hb-row");
  details.append(capacity, weightless);
  const show = (): void => {
    details.hidden = !holds.querySelector("input")!.checked;
  };
  holds.querySelector("input")!.addEventListener("change", show);
  root.append(holds, details);
  show();
  return root;
}

/** The requirement and container as entered; validation happens where the item is checked. */
export function readCarrying(
  data: FormData,
  original: Item | undefined,
): { attunementPrerequisites?: AttunementRequirement; container?: Container } {
  const levels = classLevels(original?.attunementPrerequisites);
  let attunementPrerequisites: AttunementRequirement | undefined;
  switch (formText(data, "requirement")) {
    case "spellcaster":
      attunementPrerequisites = { spellcaster: true };
      break;
    case "text":
      attunementPrerequisites = { text: formText(data, "requirementText").trim() };
      break;
    case "classes": {
      // A saved minimum level survives editing the list; new classes need level 1.
      // A picker sends one value per class; a typed list sends one comma-separated value.
      const ids = [
        ...new Set(
          data
            .getAll("requirementClasses")
            .flatMap((entry) => (typeof entry === "string" ? entry.split(",") : []))
            .map((id) => id.trim().toLowerCase())
            .filter((id) => id !== ""),
        ),
      ].map((id) => ({ [id]: levels.get(id) ?? 1 }));
      attunementPrerequisites =
        ids.length <= 1 ? { classes: ids[0] ?? {} } : { any: ids.map((classes) => ({ classes })) };
      break;
    }
  }
  let container: Container | undefined;
  if (data.get("container") !== null) {
    const capacity = formText(data, "containerCapacity").trim();
    container = {
      ...(capacity === "" ? {} : { capacityLb: Number(capacity) }),
      ...(data.get("containerWeightless") !== null ? { weightless: true as const } : {}),
    };
  }
  return {
    ...(attunementPrerequisites ? { attunementPrerequisites } : {}),
    ...(container ? { container } : {}),
  };
}
