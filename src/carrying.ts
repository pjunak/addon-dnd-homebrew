import type { Translator } from "./catalogs.js";
import { checkField, element, formText, numberField, selectField, textField } from "./fields.js";
import { maxWeight, type AttunementRequirement, type Container, type Item } from "./model.js";

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

/**
 * Who may attune and what the item holds. The controls for one choice are
 * shown only while it applies; reading takes the form's current values.
 */
export function carryingFields(document: Document, t: Translator, item: Item): HTMLFieldSetElement {
  const fieldset = element(document, "fieldset", "hb-effects-fieldset");
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
  const classes = textField(
    document,
    t("Classes"),
    "requirementClasses",
    [...classLevels(requirement).keys()].join(", "),
    { maxLength: 1300, placeholder: "cleric, paladin", hint: t("Class ids, separated by commas.") },
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
  const container = item.container;
  const holds = checkField(document, t("Holds other items"), "container", container !== undefined);
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
  const show = (): void => {
    const chosen = whoField.querySelector("select")!.value as Who;
    classes.hidden = chosen !== "classes";
    words.hidden = chosen !== "text";
    capacity.hidden = weightless.hidden = !holds.querySelector("input")!.checked;
  };
  // The form's own change listener marks the draft dirty and redraws the preview.
  whoField.querySelector("select")!.addEventListener("change", show);
  holds.querySelector("input")!.addEventListener("change", show);
  fieldset.append(
    element(document, "legend", "", t("Attunement and storage")),
    element(
      document,
      "p",
      "hb-hint",
      t(
        "Who can attune applies when the item requires attunement. A container's contents count toward its holder's load unless they weigh nothing.",
      ),
    ),
    whoField,
    classes,
    words,
    holds,
    capacity,
    weightless,
  );
  show();
  return fieldset;
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
      const ids = [
        ...new Set(
          formText(data, "requirementClasses")
            .split(",")
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
