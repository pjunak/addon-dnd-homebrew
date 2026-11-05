// Form controls marked for ui.controls.v1; the host styles and enhances them.

let fieldSequence = 0;
function fieldId(): string {
  fieldSequence += 1;
  return `hb-field-${fieldSequence}`;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className = "",
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function help(document: Document, text: string): HTMLElement {
  const node = element(document, "small", "hb-hint", text);
  node.dataset["uiHelp"] = "";
  return node;
}
export function option(document: Document, value: string, label: string): HTMLOptionElement {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}
function field(document: Document, name: string): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.dataset["uiField"] = "";
  wrapper.dataset["uiKey"] = name;
  return wrapper;
}
export function textField(
  document: Document,
  label: string,
  name: string,
  value: string,
  options: {
    readonly maxLength?: number;
    readonly placeholder?: string;
    readonly readOnly?: boolean;
    readonly hint?: string;
    /** Values the browser offers while typing; any other text stays allowed. */
    readonly suggestions?: readonly string[];
  } = {},
): HTMLLabelElement {
  const wrapper = field(document, name);
  const input = document.createElement("input");
  input.name = name;
  input.value = value;
  if (options.maxLength !== undefined) input.maxLength = options.maxLength;
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.readOnly) input.readOnly = true;
  wrapper.append(element(document, "span", "", label), input);
  if (options.suggestions) {
    const list = document.createElement("datalist");
    list.id = fieldId();
    input.setAttribute("list", list.id);
    for (const suggestion of options.suggestions) list.append(option(document, suggestion, ""));
    wrapper.append(list);
  }
  if (options.hint) wrapper.append(help(document, options.hint));
  return wrapper;
}
/** A number input; `undefined` leaves it empty, and `step: "any"` allows fractions. */
export function numberField(
  document: Document,
  label: string,
  name: string,
  value: number | undefined,
  limits: {
    readonly min: number;
    readonly max: number;
    readonly step?: string;
    readonly placeholder?: string;
    readonly hint?: string;
  } = { min: -100000, max: 100000 },
): HTMLLabelElement {
  const wrapper = field(document, name);
  const input = document.createElement("input");
  input.type = "number";
  input.name = name;
  input.step = limits.step ?? "1";
  input.min = String(limits.min);
  input.max = String(limits.max);
  input.value = value === undefined ? "" : String(value);
  if (limits.placeholder) input.placeholder = limits.placeholder;
  wrapper.append(element(document, "span", "", label), input);
  if (limits.hint) wrapper.append(help(document, limits.hint));
  return wrapper;
}
/** A typed number, or undefined for an empty field; validation names bad values. */
export function formNumber(data: FormData, name: string): number | undefined {
  const text = formText(data, name).trim();
  return text === "" ? undefined : Number(text);
}
export function textArea(
  document: Document,
  label: string,
  name: string,
  value: string,
  rows: number,
  maxLength?: number,
  hint?: string,
): HTMLLabelElement {
  const wrapper = field(document, name);
  const input = document.createElement("textarea");
  input.name = name;
  input.value = value;
  input.rows = rows;
  if (maxLength !== undefined) input.maxLength = maxLength;
  wrapper.append(element(document, "span", "", label), input);
  if (hint) wrapper.append(help(document, hint));
  return wrapper;
}
export function selectField(
  document: Document,
  label: string,
  name: string,
  value: string,
  options: readonly (readonly [string, string, string?])[],
  hint?: string,
): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.dataset["uiField"] = "";
  wrapper.dataset["uiKey"] = name;
  const text = document.createElement("label");
  text.textContent = label;
  const input = document.createElement("select");
  input.id = fieldId();
  text.htmlFor = input.id;
  input.name = name;
  if (options.length >= 12) input.dataset["ui"] = "combobox";
  for (const [optionValue, optionLabel, details] of options) {
    const entry = option(document, optionValue, optionLabel);
    entry.selected = optionValue === value;
    if (details) entry.title = details;
    input.append(entry);
  }
  wrapper.append(text, input);
  if (hint) wrapper.append(help(document, hint));
  return wrapper;
}
export function checkField(
  document: Document,
  label: string,
  name: string,
  checked: boolean,
  hint?: string,
): HTMLLabelElement {
  const wrapper = field(document, name);
  wrapper.classList.add("hb-check");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.checked = checked;
  wrapper.append(input, element(document, "span", "", label));
  if (hint) wrapper.append(help(document, hint));
  return wrapper;
}
/** A multi-select of fixed choices, rendered as host chips; a third entry is the option's details. */
export function chipsField(
  document: Document,
  label: string,
  name: string,
  selected: readonly string[],
  options: readonly (readonly [string, string, string?])[],
  hint?: string,
): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.dataset["uiField"] = "";
  wrapper.dataset["uiKey"] = name;
  const text = document.createElement("label");
  text.textContent = label;
  const input = document.createElement("select");
  input.id = fieldId();
  text.htmlFor = input.id;
  input.name = name;
  input.multiple = true;
  input.dataset["ui"] = "chips";
  for (const [value, optionLabel, details] of options) {
    const entry = option(document, value, optionLabel);
    entry.selected = selected.includes(value);
    if (details) entry.title = details;
    entry.dataset["uiKeywords"] = value;
    input.append(entry);
  }
  wrapper.append(text, input);
  if (hint) wrapper.append(help(document, hint));
  return wrapper;
}
/**
 * Ids picked from `known` as searchable chips, or typed and comma-separated
 * when no list is available. Saved ids missing from the list stay selected.
 */
export function idsField(
  document: Document,
  label: string,
  name: string,
  ids: readonly string[],
  known: readonly (readonly [string, string, string?])[] | undefined,
  typed: { readonly placeholder?: string; readonly hint?: string },
): HTMLElement {
  if (!known)
    return textField(document, label, name, ids.join(", "), { maxLength: 1300, ...typed });
  const missing = ids
    .filter((id) => !known.some(([value]) => value === id))
    .map((id) => [id, id] as const);
  return chipsField(document, label, name, ids, [...known, ...missing]);
}
/** The ids an idsField holds, whichever form it took. */
export function fieldIds(root: ParentNode, name: string): string[] {
  const control = root.querySelector(`[name="${name}"]`);
  const values =
    control instanceof HTMLSelectElement
      ? [...control.selectedOptions].map((entry) => entry.value)
      : control instanceof HTMLInputElement
        ? control.value.split(",")
        : [];
  return [...new Set(values.map((id) => id.trim().toLowerCase()).filter((id) => id !== ""))];
}
export function messageBlock(
  document: Document,
  message: string,
  role: "status" | "alert",
): HTMLElement {
  const block = element(document, "div", `hb-message ${role}`, message);
  block.setAttribute("role", role);
  block.dataset["uiState"] = role === "alert" ? "error" : "info";
  return block;
}
export function actionButton(
  document: Document,
  label: string,
  action: () => void,
  variant: "" | "primary" | "danger" | "quiet" = "",
): HTMLButtonElement {
  const button = element(document, "button", "", label);
  button.type = "button";
  if (variant) button.dataset["uiVariant"] = variant;
  button.addEventListener("click", action);
  return button;
}
export function badge(
  document: Document,
  text: string,
  tone: "" | "muted" | "warn" | "accent" = "",
): HTMLElement {
  return element(document, "span", `hb-badge${tone ? ` ${tone}` : ""}`, text);
}
export function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}
export function formValues(data: FormData, name: string): string[] {
  return data.getAll(name).filter((value): value is string => typeof value === "string");
}
/** Comma-separated tags, lowercased and without repeats. */
export function splitTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag !== ""),
    ),
  ];
}
/** Prose goes to the host component; this package never parses HTML. */
export function markdown(document: Document, source: string): HTMLElement {
  const node = document.createElement("codex-addon-markdown") as HTMLElement & { source: string };
  node.source = source;
  return node;
}
export function configureDialog(dialog: HTMLDialogElement, close: () => void): void {
  dialog.dataset["uiDialog"] = "";
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
}
/**
 * Two to five short choices as joined buttons (the host's `choices` style):
 * radios for one choice, or checkboxes when `multiple` lets several be picked.
 */
export function choiceField(
  document: Document,
  label: string,
  name: string,
  selected: string | readonly string[],
  options: readonly (readonly [string, string, string?])[],
  hint?: string,
): HTMLFieldSetElement {
  const multiple = typeof selected !== "string";
  const wrapper = element(document, "fieldset", "hb-choices");
  wrapper.dataset["ui"] = "choices";
  wrapper.dataset["uiKey"] = name;
  wrapper.append(element(document, "legend", "", label));
  for (const [value, optionLabel, details] of options) {
    const choice = document.createElement("label");
    const input = document.createElement("input");
    input.type = multiple ? "checkbox" : "radio";
    input.name = name;
    input.value = value;
    input.checked = multiple ? selected.includes(value) : selected === value;
    choice.append(input, document.createTextNode(optionLabel));
    if (details) choice.title = details;
    wrapper.append(choice);
  }
  if (hint) wrapper.append(help(document, hint));
  return wrapper;
}
/** The value of a choice field's checked radio. */
export function choiceValue(root: ParentNode, name: string): string {
  return root.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? "";
}
/**
 * Fields shown because of a choice above them; `because` names that choice,
 * for example "Because it requires attunement".
 */
export function dependentGroup(
  document: Document,
  because: string,
  ...children: HTMLElement[]
): HTMLElement {
  const group = element(document, "div", "hb-depends");
  group.append(element(document, "p", "hb-depends-why", `↳ ${because}`), ...children);
  return group;
}
/**
 * The host's Markdown writer (`ui.markdown-editor`). Its named source field
 * keeps FormData reading it, and each change reaches the form as an input event.
 */
export function markdownField(
  document: Document,
  label: string,
  name: string,
  value: string,
  maxLength: number,
  hint?: string,
): HTMLElement {
  const wrapper = element(document, "div", "hb-writer");
  const writer = document.createElement("codex-addon-markdown-editor") as HTMLElement & {
    value: string;
    name: string;
    label: string;
    maximumLength: number;
  };
  writer.name = name;
  writer.label = label;
  writer.maximumLength = maxLength;
  writer.value = value;
  writer.addEventListener("markdown-change", () =>
    wrapper.dispatchEvent(new Event("input", { bubbles: true })),
  );
  wrapper.append(element(document, "span", "hb-writer-label", label), writer);
  if (hint) wrapper.append(help(document, hint));
  return wrapper;
}
/** Marks a field for the form's Settings panel (visibility, id, tags and the like). */
export function setting<T extends HTMLElement>(field: T): T {
  field.dataset["hbSetting"] = "";
  return field;
}
/** A form section the section bar links to; `label` is its heading. */
export function formSection(
  document: Document,
  label: string,
  ...children: HTMLElement[]
): HTMLElement {
  const section = element(document, "section", "hb-section");
  section.dataset["hbSection"] = label;
  section.append(element(document, "h3", "hb-section-head", label), ...children);
  return section;
}
