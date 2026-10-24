// A form for any value of the Engine's grants vocabulary, drawn from its JSON
// Schema (src/schema.ts) with the words in src/vocabulary.ts. An object shows
// its required fields and the optional ones it holds, and "Add field" offers
// the rest, so every grant the Engine knows is editable without code of its
// own. Controls keep what was typed even when it is invalid: schemaProblem
// names the first problem where the draft is checked.
import type { Translator } from "./catalogs.js";
import {
  actionButton,
  checkField,
  chipsField,
  element,
  numberField,
  option,
  selectField,
  textArea,
  textField,
} from "./fields.js";
import type { References } from "./references.js";
import { deref, emptyValue, refName, schemaProblem, typesOf, type SchemaNode } from "./schema.js";
import {
  addLabel,
  branchLabel,
  branchValueLabel,
  entryLabel,
  fieldHint,
  fieldLabel,
  fieldOffer,
  fieldOrder,
  grantGroups,
  isProse,
  keyOffer,
  mapLabels,
  switchOf,
  template,
  type GrantSubject,
  type Offer,
  type Source,
} from "./vocabulary.js";

export type KeySource = Exclude<Source, "spell" | "class">;
export interface FormContext {
  readonly document: Document;
  readonly t: Translator;
  /** Spells and classes for pickers; undefined types ids instead. */
  readonly references: References | undefined;
  /** Keys this subclass declares, offered where a field names one. */
  readonly keys: (source: KeySource) => readonly string[];
  /** Entries were added or removed, which no input event reports. */
  readonly changed: () => void;
  /** Controls were replaced; the host enhances the new ones. */
  readonly restructured: () => void;
  /** Whose grants these are, which decides how the fields are grouped. */
  readonly subject: GrantSubject;
}
export interface ValueEditor {
  readonly root: HTMLElement;
  /** The value as entered; undefined leaves an optional field out. */
  read(): unknown;
}
/** The grants object of a record. */
export const grantsNode: SchemaNode = { $ref: "#/$defs/grants" };

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

interface Place {
  /** The definition, or inline path, the field belongs to; it picks the words. */
  readonly owner: string;
  readonly field: string;
  /** Where the value sits, as problems name it; controls are named by it. */
  readonly path: string;
  readonly required: boolean;
  /** The object holding the field, for offers that depend on a sibling. */
  readonly siblings: Readonly<Json>;
  /** Replaces the field's label, as list entries and map values do. */
  readonly label?: string;
  readonly hint?: string;
  /** Removes an optional field or a list entry. */
  readonly remove?: () => void;
  /** A list's new entry, when the vocabulary's template does not fit. */
  readonly start?: () => unknown;
  /** A table cell: every column shows, so an optional field may stay unset. */
  readonly cell?: boolean;
}
export interface EditorOptions {
  /** Where the value sits, as problems name it, such as "features[0].grants". */
  readonly path: string;
  readonly label: string;
  readonly hint?: string;
  readonly required?: boolean;
  /** A list's new entry. */
  readonly start?: () => unknown;
}

/** An editor for `value` against `node`. */
export function schemaEditor(
  context: FormContext,
  node: SchemaNode,
  value: unknown,
  options: EditorOptions,
): ValueEditor {
  return editorFor(context, node, value, {
    owner: "",
    field: options.path.slice(options.path.lastIndexOf(".") + 1),
    path: options.path,
    required: options.required ?? false,
    siblings: {},
    label: options.label,
    ...(options.hint ? { hint: options.hint } : {}),
    ...(options.start ? { start: options.start } : {}),
  });
}

function editorFor(
  context: FormContext,
  node: SchemaNode,
  value: unknown,
  place: Place,
): ValueEditor {
  const schema = deref(node);
  if (schema.const !== undefined) return constant(context, schema.const);
  if (schema.oneOf)
    return textOrList(schema)
      ? tokens(context, value, place, "one")
      : variants(context, schema, value, place);
  const types = typesOf(schema);
  if (types.length > 1) return text(context, value, place, true);
  switch (types[0] ?? "string") {
    case "object":
      return schema.properties
        ? group(context, node, schema, value, place)
        : map(context, schema, value, place);
    case "array":
      return list(context, schema, value, place);
    case "boolean":
      return check(context, value, place);
    case "integer":
    case "number":
      return number(context, types[0]!, value, place);
    default:
      return text(context, value, place, false);
  }
}

// --- Words ---------------------------------------------------------------------

function ownerName(node: SchemaNode, fallback: string): string {
  const name = refName(node);
  if (name === "grants" || name === "Grants") return "Grants";
  return name ?? deref(node).title ?? fallback;
}
/** The words owner of a node's own fields. */
function ownerOf(node: SchemaNode, place: Place): string {
  return ownerName(node, place.owner ? `${place.owner}.${place.field}` : place.field);
}
function labelOf(context: FormContext, place: Place): string {
  return place.label ?? context.t(fieldLabel(place.owner, place.field));
}
function hintOf(context: FormContext, place: Place): string | undefined {
  if (place.hint) return place.hint;
  const hint = place.label === undefined ? fieldHint(place.owner, place.field) : undefined;
  return hint === undefined ? undefined : context.t(hint);
}
const childPath = (path: string, key: string | number): string =>
  typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key;

interface Choices {
  /** Only `options` are allowed: a select or chips. */
  readonly closed: boolean;
  readonly options: readonly (readonly [string, string, string?])[];
  /** Values a typed field suggests. */
  readonly suggestions: readonly string[];
}
/** What a field offers; values outside a closed list stay selectable. */
function choicesFor(
  context: FormContext,
  offer: Offer | undefined,
  current: readonly string[],
): Choices {
  const keep = (options: readonly (readonly [string, string, string?])[]): Choices => ({
    closed: true,
    options: [
      ...options,
      ...current
        .filter((value) => value !== "" && !options.some(([known]) => known === value))
        .map((value) => [value, value] as const),
    ],
    suggestions: [],
  });
  if (!offer) return { closed: false, options: [], suggestions: [] };
  if (offer.source === "spell" || offer.source === "class") {
    const known = context.references?.[offer.source === "spell" ? "spells" : "classes"];
    return known
      ? keep(known.map((entry) => [entry.id, entry.name, entry.detail] as const))
      : { closed: false, options: [], suggestions: [] };
  }
  if (offer.source) return { closed: false, options: [], suggestions: context.keys(offer.source) };
  const options = (offer.values ?? []).map(([value, label]) => [value, context.t(label)] as const);
  return offer.closed
    ? keep(options)
    : { closed: false, options, suggestions: options.map(([value]) => value) };
}

// --- Controls ------------------------------------------------------------------

function control<T extends HTMLElement>(root: HTMLElement): T {
  return root.querySelector("input, select, textarea") as T;
}
/** Adds the Remove button of an optional field or a list entry. */
function removable(context: FormContext, root: HTMLElement, place: Place): HTMLElement {
  if (!place.remove) return root;
  // The button sits on the label line or in the legend, so nested fields
  // keep their full width.
  const button = removeButton(context, labelOf(context, place), place.remove);
  const legend = root instanceof HTMLFieldSetElement ? root.querySelector(":scope > legend") : null;
  if (legend) {
    legend.append(button);
    return root;
  }
  const row = element(context.document, "div", "hb-schema-field");
  row.append(root, button);
  return row;
}
function removeButton(context: FormContext, name: string, remove: () => void): HTMLButtonElement {
  const button = actionButton(context.document, context.t("Remove"), remove);
  button.classList.add("hb-schema-remove");
  button.dataset["uiVariant"] = "quiet";
  button.setAttribute("aria-label", context.t("Remove {name}", { name }));
  return button;
}
function constant(context: FormContext, value: unknown): ValueEditor {
  const root = element(context.document, "span");
  root.hidden = true;
  return { root, read: () => value };
}
/** Text, a select of closed values, or with `numeric` a number or text. */
function text(context: FormContext, value: unknown, place: Place, numeric: boolean): ValueEditor {
  const current = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const choices = choicesFor(context, fieldOffer(place.owner, place.field, place.siblings), [
    current,
  ]);
  const label = labelOf(context, place),
    hint = hintOf(context, place);
  // An optional select can stay unset, as a table cell's must.
  const options = place.required ? choices.options : [["", "—"] as const, ...choices.options];
  const root = choices.closed
    ? selectField(context.document, label, place.path, current, options, hint)
    : textField(context.document, label, place.path, current, {
        maxLength: 500,
        ...(hint ? { hint } : {}),
        ...(choices.suggestions.length > 0 ? { suggestions: choices.suggestions } : {}),
      });
  const input = control<HTMLInputElement | HTMLSelectElement>(root);
  return {
    root,
    read: () => {
      const entered = input.value.trim();
      if (entered === "") return place.required ? "" : undefined;
      return numeric && /^-?\d+(\.\d+)?$/u.test(entered) ? Number(entered) : entered;
    },
  };
}
function number(context: FormContext, type: string, value: unknown, place: Place): ValueEditor {
  const hint = hintOf(context, place);
  const root = numberField(
    context.document,
    labelOf(context, place),
    place.path,
    typeof value === "number" ? value : undefined,
    { min: -10000, max: 10000, step: type === "number" ? "any" : "1", ...(hint ? { hint } : {}) },
  );
  const input = control<HTMLInputElement>(root);
  return {
    root,
    read: () => {
      const entered = input.value.trim();
      // An empty required number stays text, so the check names it.
      if (entered === "") return place.required ? "" : undefined;
      return Number(entered);
    },
  };
}
function check(context: FormContext, value: unknown, place: Place): ValueEditor {
  // An optional cell offers yes, no or unset: false and absent can differ.
  if (place.cell && !place.required) {
    const t = context.t;
    const root = selectField(
      context.document,
      labelOf(context, place),
      place.path,
      typeof value === "boolean" ? String(value) : "",
      [
        ["", "—"],
        ["true", t("Yes")],
        ["false", t("No")],
      ],
    );
    const input = control<HTMLSelectElement>(root);
    return { root, read: () => (input.value === "" ? undefined : input.value === "true") };
  }
  const root = checkField(
    context.document,
    labelOf(context, place),
    place.path,
    value === true,
    hintOf(context, place),
  );
  const input = control<HTMLInputElement>(root);
  return { root, read: () => input.checked };
}

/** A text and a list of texts are one field: comma-separated values. */
function textOrList(schema: SchemaNode): boolean {
  const branches = schema.oneOf ?? [];
  const types = branches.map((branch) => deref(branch));
  return (
    types.length === 2 &&
    types.some((branch) => typesOf(branch)[0] === "string" && branch.const === undefined) &&
    types.some(
      (branch) =>
        typesOf(branch)[0] === "array" && typesOf(deref(branch.items ?? {}))[0] === "string",
    )
  );
}
/**
 * Comma-separated values: "one" reads a single value as text (a field that
 * takes a text or a list), "integer" reads whole numbers.
 */
function tokens(
  context: FormContext,
  value: unknown,
  place: Place,
  kind: "one" | "list" | "integer",
): ValueEditor {
  const values = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string" && value
      ? [value]
      : [];
  const choices =
    kind === "integer"
      ? undefined
      : choicesFor(context, fieldOffer(place.owner, place.field, place.siblings), values);
  const hint = hintOf(context, place);
  const root = textField(context.document, labelOf(context, place), place.path, values.join(", "), {
    maxLength: 2000,
    hint: hint ?? context.t("Separate entries with commas."),
    ...(choices?.suggestions.length
      ? { placeholder: choices.suggestions.slice(0, 3).join(", ") }
      : {}),
  });
  const input = control<HTMLInputElement>(root);
  return {
    root,
    read: () => {
      const entered = input.value
        .split(",")
        .map((token) => token.trim())
        .filter((token) => token !== "");
      if (kind === "one")
        return entered.length === 0
          ? place.required
            ? ""
            : undefined
          : entered.length === 1
            ? entered[0]
            : entered;
      if (entered.length === 0) return place.required ? [] : undefined;
      // A token that is no whole number stays text, so the check names it.
      return kind === "integer"
        ? entered.map((token) => (/^-?\d+$/u.test(token) ? Number(token) : token))
        : entered;
    },
  };
}

// --- Lists ---------------------------------------------------------------------

function list(context: FormContext, schema: SchemaNode, value: unknown, place: Place): ValueEditor {
  const items = schema.items ?? {};
  const item = deref(items);
  const type = item.oneOf || item.const !== undefined ? undefined : typesOf(item)[0];
  const empty = (): unknown => (place.required ? [] : undefined);
  if (type === "integer" || type === "number") return tokens(context, value, place, "integer");
  if (type !== "string")
    return flat(item) ? table(context, items, value, place) : entries(context, items, value, place);
  const values = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
  const label = labelOf(context, place),
    hint = hintOf(context, place);
  if (isProse(place.owner, place.field)) {
    const root = textArea(
      context.document,
      label,
      place.path,
      values.join("\n"),
      3,
      undefined,
      hint ?? context.t("One entry per line."),
    );
    const input = control<HTMLTextAreaElement>(root);
    return {
      root,
      read: () => {
        const lines = input.value
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "");
        return lines.length > 0 ? lines : empty();
      },
    };
  }
  const choices = choicesFor(context, fieldOffer(place.owner, place.field, place.siblings), values);
  if (!choices.closed) return tokens(context, value, place, "list");
  const root = chipsField(context.document, label, place.path, values, choices.options, hint);
  const input = control<HTMLSelectElement>(root);
  return {
    root,
    read: () => {
      const selected = [...input.selectedOptions].map((entry) => entry.value);
      return selected.length > 0 ? selected : empty();
    },
  };
}
/** Objects of at most six plain fields edit as table rows. */
function flat(item: SchemaNode): boolean {
  const fields = Object.values(item.properties ?? {});
  return (
    typesOf(item)[0] === "object" &&
    fields.length > 0 &&
    fields.length <= 6 &&
    fields.every((field) => {
      const schema = deref(field);
      if (schema.oneOf || schema.properties || schema.const !== undefined) return false;
      const types = typesOf(schema);
      if (types[0] === "array") return typesOf(deref(schema.items ?? {}))[0] === "integer";
      return types.length > 0 && types.every((type) => type !== "object" && type !== "array");
    })
  );
}
/** A new entry of a list: the vocabulary's template, or the schema's minimum. */
function newEntry(items: SchemaNode, owner: string, previous: unknown): unknown {
  // A table row continues from the row above it, one level on.
  if (isObject(previous) && typeof previous["level"] === "number")
    return { ...clone(previous), level: Math.min(20, previous["level"] + 1) };
  const start = template(owner);
  return start ? clone(start) : emptyValue(items);
}
function entryTitle(context: FormContext, owner: string, index: number, entry: unknown): string {
  const title = `${context.t(entryLabel(owner))} ${index + 1}`;
  const name = isObject(entry)
    ? [entry["name"], entry["id"], entry["key"]].find(
        (part) => typeof part === "string" && part !== "",
      )
    : undefined;
  return typeof name === "string" ? `${title}: ${name}` : title;
}
/** A fieldset with the label and hint of `place`. */
function frame(context: FormContext, place: Place, className: string): HTMLFieldSetElement {
  const root = element(context.document, "fieldset", `hb-schema-group ${className}`);
  root.append(element(context.document, "legend", "", labelOf(context, place)));
  const hint = hintOf(context, place);
  if (hint) root.append(element(context.document, "p", "hb-hint", hint));
  return root;
}
/** Rebuilds a list's rows after an entry is added or removed. */
function restructure(context: FormContext, render: () => void): void {
  render();
  context.changed();
  context.restructured();
}
function entries(
  context: FormContext,
  items: SchemaNode,
  value: unknown,
  place: Place,
): ValueEditor {
  const owner = ownerOf(items, place);
  const root = frame(context, place, "hb-schema-list");
  const body = element(context.document, "div", "hb-schema-entries");
  let editors: ValueEditor[] = [];
  const current = (): unknown[] => editors.map((editor) => editor.read());
  const render = (values: readonly unknown[]): void => {
    body.replaceChildren();
    editors = values.map((entry, index) => {
      const entryPlace: Place = {
        owner: place.owner,
        field: place.field,
        path: childPath(place.path, index),
        required: true,
        siblings: {},
        label: entryTitle(context, owner, index, entry),
        remove: () => {
          const next = current();
          next.splice(index, 1);
          restructure(context, () => render(next));
        },
      };
      const editor = editorFor(context, items, entry, entryPlace);
      body.append(removable(context, editor.root, entryPlace));
      return editor;
    });
  };
  render(Array.isArray(value) ? value : []);
  root.append(
    body,
    actionButton(context.document, context.t(addLabel(owner)), () => {
      const next = current();
      next.push(place.start?.() ?? newEntry(items, owner, undefined));
      restructure(context, () => render(next));
      focusLast(body);
    }),
  );
  return {
    root,
    read: () => {
      const values = current();
      return values.length === 0 && !place.required ? undefined : values;
    },
  };
}
function table(context: FormContext, items: SchemaNode, value: unknown, place: Place): ValueEditor {
  const { document, t } = context;
  const owner = ownerOf(items, place);
  const schema = deref(items);
  const properties = schema.properties ?? {};
  const fields = fieldOrder(owner, Object.keys(properties));
  const required = new Set(schema.required ?? []);
  const root = frame(context, place, "hb-schema-list");
  const scroller = element(document, "div", "hb-schema-scroll");
  const grid = element(document, "table", "hb-schema-table");
  const head = element(document, "tr");
  for (const field of fields) head.append(element(document, "th", "", t(fieldLabel(owner, field))));
  head.append(element(document, "th"));
  const header = element(document, "thead");
  header.append(head);
  const body = element(document, "tbody");
  grid.append(header, body);
  scroller.append(grid);
  let rows: Map<string, ValueEditor>[] = [];
  const readRow = (row: Map<string, ValueEditor>): Json => {
    const result: Json = {};
    for (const [field, editor] of row) {
      const entry = editor.read();
      if (entry !== undefined) result[field] = entry;
    }
    return result;
  };
  const current = (): Json[] => rows.map(readRow);
  const render = (values: readonly unknown[]): void => {
    body.replaceChildren();
    rows = values.map((entry, index) => {
      const cells = isObject(entry) ? entry : {};
      const row = element(document, "tr");
      const editors = new Map<string, ValueEditor>();
      for (const field of fields) {
        const editor = editorFor(context, properties[field]!, cells[field], {
          owner,
          field,
          path: childPath(childPath(place.path, index), field),
          required: required.has(field),
          siblings: cells,
          label: t(fieldLabel(owner, field)),
          cell: true,
        });
        const cell = element(document, "td");
        cell.append(editor.root);
        row.append(cell);
        editors.set(field, editor);
      }
      const cell = element(document, "td");
      cell.append(
        removeButton(context, entryTitle(context, owner, index, entry), () => {
          const next = current();
          next.splice(index, 1);
          restructure(context, () => render(next));
        }),
      );
      row.append(cell);
      body.append(row);
      return editors;
    });
  };
  render(Array.isArray(value) ? value : []);
  root.append(
    scroller,
    actionButton(document, t(addLabel(owner)), () => {
      const next: unknown[] = current();
      next.push(newEntry(items, owner, next.at(-1)));
      restructure(context, () => render(next));
      focusLast(body);
    }),
  );
  return {
    root,
    read: () => {
      const values = current();
      return values.length === 0 && !place.required ? undefined : values;
    },
  };
}
/** Moves to the entry just added. */
function focusLast(body: HTMLElement): void {
  body.lastElementChild?.querySelector<HTMLElement>("input, select, textarea")?.focus();
}

// --- Maps and alternatives -------------------------------------------------------

function map(context: FormContext, schema: SchemaNode, value: unknown, place: Place): ValueEditor {
  const { document, t } = context;
  const values: SchemaNode = isObject(schema.additionalProperties)
    ? schema.additionalProperties
    : {};
  const [keyLabel, valueLabel] = mapLabels(place.field);
  const initial = isObject(value) ? Object.entries(value) : [];
  const keys = choicesFor(
    context,
    keyOffer(place.owner, place.field),
    initial.map(([key]) => key),
  );
  const root = frame(context, place, "hb-schema-map");
  const body = element(document, "div", "hb-schema-entries");
  let rows: { readonly key: () => string; readonly editor: ValueEditor }[] = [];
  const current = (): [string, unknown][] => rows.map((row) => [row.key(), row.editor.read()]);
  const render = (pairs: readonly (readonly [string, unknown])[]): void => {
    body.replaceChildren();
    rows = pairs.map(([key, entry], index) => {
      const row = element(document, "div", "hb-schema-pair");
      const name = `${place.path}#key-${index}`;
      const keyField = keys.closed
        ? selectField(document, t(keyLabel), name, key, keys.options)
        : textField(document, t(keyLabel), name, key, {
            maxLength: 64,
            ...(keys.suggestions.length > 0 ? { suggestions: keys.suggestions } : {}),
          });
      const input = control<HTMLInputElement | HTMLSelectElement>(keyField);
      const editor = editorFor(context, values, entry, {
        owner: place.owner,
        field: place.field,
        path: childPath(place.path, key || String(index)),
        required: true,
        siblings: {},
        label: t(valueLabel),
      });
      row.append(
        keyField,
        editor.root,
        removeButton(context, key || t(keyLabel), () => {
          const next = current();
          next.splice(index, 1);
          restructure(context, () => render(next));
        }),
      );
      body.append(row);
      return { key: () => input.value.trim(), editor };
    });
  };
  render(initial);
  root.append(
    body,
    actionButton(document, t("Add entry"), () => {
      const next = current();
      const used = new Set(next.map(([key]) => key));
      const offered = keys.closed ? keys.options.map(([key]) => key) : keys.suggestions;
      next.push([offered.find((key) => !used.has(key)) ?? "", emptyValue(values)]);
      restructure(context, () => render(next));
      focusLast(body);
    }),
  );
  return {
    root,
    read: () => {
      const result: Json = {};
      for (const [key, entry] of current()) if (key !== "") result[key] = entry;
      return Object.keys(result).length === 0 && !place.required ? undefined : result;
    },
  };
}
function branchName(branch: SchemaNode): string {
  const schema = deref(branch);
  if (schema.const !== undefined)
    return typeof schema.const === "string" ? schema.const : JSON.stringify(schema.const);
  switch (typesOf(schema)[0] ?? "") {
    case "string":
      return "Text";
    case "integer":
    case "number":
      return "Number";
    case "array":
      return "List";
    case "object":
      return "Fields";
    default:
      return "Value";
  }
}
/** The value a newly chosen alternative starts from, kept where it fits. */
function convert(previous: unknown, branch: SchemaNode): unknown {
  if (!schemaProblem(branch, previous, "")) return previous;
  const schema = deref(branch);
  if (typeof previous === "string" && previous !== "" && schema.required?.includes("key"))
    return { ...(emptyValue(branch) as Json), key: previous };
  if (isObject(previous) && typeof previous["key"] === "string" && typesOf(schema)[0] === "string")
    return previous["key"];
  return emptyValue(branch);
}
/** A field that allows several forms: a choice of form, then its control. */
function variants(
  context: FormContext,
  schema: SchemaNode,
  value: unknown,
  place: Place,
): ValueEditor {
  const { document, t } = context;
  const branches = schema.oneOf ?? [];
  const fits = branches.findIndex((branch) => !schemaProblem(branch, value, ""));
  let index = Math.max(0, fits);
  const labels = branches.map((branch, position) =>
    t(branchLabel(place.owner, place.field, position) ?? branchName(branch)),
  );
  const root = element(document, "div", "hb-schema-variant");
  const choice = selectField(
    document,
    labelOf(context, place),
    `${place.path}#form`,
    String(index),
    labels.map((label, position) => [String(position), label] as const),
    hintOf(context, place),
  );
  const select = control<HTMLSelectElement>(choice);
  const slot = element(document, "div", "hb-schema-branch");
  let inner: ValueEditor;
  const show = (branchValue: unknown): void => {
    const branch = branches[index]!;
    const scalar = !["object", "array"].includes(typesOf(deref(branch))[0] ?? "");
    inner = editorFor(context, branch, branchValue, {
      owner: place.owner,
      field: place.field,
      path: place.path,
      required: true,
      siblings: place.siblings,
      label: scalar ? t(branchValueLabel(place.field)) : labels[index]!,
    });
    slot.replaceChildren(inner.root);
  };
  show(value);
  select.addEventListener("change", () => {
    const previous = inner.read();
    index = Number(select.value);
    show(convert(previous, branches[index]!));
    context.restructured();
  });
  root.append(choice, slot);
  return { root, read: () => inner.read() };
}

// --- Objects -------------------------------------------------------------------

let addSequence = 0;
/** The "Add field" select; grants list their fields in the vocabulary's groups. */
function addField(
  context: FormContext,
  owner: string,
  path: string,
  absent: readonly string[],
  add: (field: string) => void,
): HTMLElement {
  const { document, t } = context;
  const wrapper = element(document, "div", "hb-schema-add");
  wrapper.dataset["uiField"] = "";
  wrapper.dataset["uiKey"] = `${path}#add`;
  const label = element(document, "label", "", t("Add field"));
  const select = document.createElement("select");
  addSequence += 1;
  select.id = `hb-schema-add-${addSequence}`;
  label.htmlFor = select.id;
  select.name = `${path}#add`;
  select.append(option(document, "", t("Choose a field…")));
  const entry = (field: string): HTMLOptionElement => {
    const item = option(document, field, t(fieldLabel(owner, field)));
    const hint = fieldHint(owner, field);
    if (hint) item.title = t(hint);
    item.dataset["uiKeywords"] = field;
    return item;
  };
  const sections =
    owner === "Grants"
      ? [
          ...grantGroups(context.subject).map((section) => ({
            label: section.label,
            fields: section.fields.filter((field) => absent.includes(field)),
          })),
          {
            label: "Other",
            fields: absent.filter(
              (field) =>
                !grantGroups(context.subject).some((section) => section.fields.includes(field)),
            ),
          },
        ]
      : [{ label: "", fields: absent }];
  for (const section of sections) {
    if (section.fields.length === 0) continue;
    if (!section.label) {
      select.append(...section.fields.map(entry));
      continue;
    }
    const optgroup = document.createElement("optgroup");
    optgroup.label = t(section.label);
    optgroup.append(...section.fields.map(entry));
    select.append(optgroup);
  }
  if (absent.length >= 12) select.dataset["ui"] = "combobox";
  select.addEventListener("change", () => {
    if (select.value) add(select.value);
  });
  wrapper.append(label, select);
  return wrapper;
}
/** A field just added: switched on, or a list with its first entry. */
function initialValue(node: SchemaNode, owner: string, field: string): unknown {
  const schema = deref(node);
  const type = schema.oneOf ? undefined : typesOf(schema)[0];
  if (type === "boolean") return true;
  if (type === "array") {
    const items = schema.items ?? {};
    if (typesOf(deref(items))[0] === "object" && !deref(items).oneOf)
      return [newEntry(items, ownerName(items, `${owner}.${field}`), undefined)];
  }
  return emptyValue(node);
}
function grantOrder(
  properties: Readonly<Record<string, SchemaNode>>,
  subject: GrantSubject,
): string[] {
  const grouped = grantGroups(subject)
    .flatMap((section) => section.fields)
    .filter((field) => field in properties);
  return [...grouped, ...Object.keys(properties).filter((field) => !grouped.includes(field))];
}
function group(
  context: FormContext,
  node: SchemaNode,
  schema: SchemaNode,
  value: unknown,
  place: Place,
): ValueEditor {
  const { document, t } = context;
  const owner = ownerOf(node, place);
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const order =
    owner === "Grants"
      ? grantOrder(properties, context.subject)
      : fieldOrder(owner, Object.keys(properties));
  const decider = switchOf(owner);
  let state: Json = isObject(value) ? { ...value } : {};
  const present = new Set([...required, ...Object.keys(state)]);
  const root = frame(context, place, "");
  const body = element(document, "div", "hb-schema-fields");
  root.append(body);
  let editors = new Map<string, ValueEditor>();
  const fieldsInOrder = (): string[] => [
    ...order.filter((field) => present.has(field)),
    ...[...present].filter((field) => !(field in properties)),
  ];
  const read = (): Json => {
    const result: Json = {};
    for (const field of fieldsInOrder()) {
      const editor = editors.get(field);
      // A field outside the vocabulary is kept, so the check names it.
      const entry = editor ? editor.read() : state[field];
      if (entry !== undefined) result[field] = entry;
    }
    return result;
  };
  const rebuild = (next: Json): void => {
    state = next;
    present.clear();
    for (const field of [...required, ...Object.keys(next)]) present.add(field);
    restructure(context, render);
  };
  const render = (): void => {
    editors = new Map();
    body.replaceChildren();
    const applies = decider?.fields(state[decider.field]);
    for (const field of fieldsInOrder()) {
      const fieldPlace: Place = {
        owner,
        field,
        path: childPath(place.path, field),
        required: required.has(field),
        siblings: state,
        ...(required.has(field)
          ? {}
          : {
              remove: () => {
                const next = read();
                delete next[field];
                rebuild(next);
              },
            }),
      };
      const property = properties[field];
      if (!property) {
        const note = element(
          document,
          "p",
          "hb-hint",
          t("{field} is not part of the grants vocabulary; remove it.", { field }),
        );
        body.append(removable(context, note, fieldPlace));
        continue;
      }
      const editor = editorFor(context, property, state[field], fieldPlace);
      editors.set(field, editor);
      body.append(removable(context, editor.root, fieldPlace));
      if (decider && field === decider.field)
        control<HTMLElement>(editor.root).addEventListener("change", () => {
          const current = read(),
            chosen = current[decider.field];
          const keep = decider.fields(chosen);
          const next: Json = {};
          for (const [key, entry] of Object.entries(current))
            if (key === decider.field || required.has(key) || !keep || keep.includes(key))
              next[key] = entry;
          rebuild({ ...next, ...decider.start(chosen) });
        });
    }
    const absent = order.filter(
      (field) => !present.has(field) && (!applies || applies.includes(field)),
    );
    if (absent.length > 0)
      body.append(
        addField(context, owner, place.path, absent, (field) => {
          const next = read();
          next[field] = initialValue(properties[field]!, owner, field);
          rebuild(next);
          body
            .querySelector<HTMLElement>(`[name^="${CSS.escape(childPath(place.path, field))}"]`)
            ?.focus();
        }),
      );
  };
  render();
  return {
    root,
    read: () => {
      const result = read();
      return Object.keys(result).length === 0 && !place.required ? undefined : result;
    },
  };
}
