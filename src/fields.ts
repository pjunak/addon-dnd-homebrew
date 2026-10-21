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
export function numberField(
  document: Document,
  label: string,
  name: string,
  value: number,
  limits: { readonly min: number; readonly max: number } = { min: -100000, max: 100000 },
): HTMLLabelElement {
  const wrapper = field(document, name);
  const input = document.createElement("input");
  input.type = "number";
  input.name = name;
  input.step = "1";
  input.min = String(limits.min);
  input.max = String(limits.max);
  input.value = String(value);
  wrapper.append(element(document, "span", "", label), input);
  return wrapper;
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
  options: readonly (readonly [string, string])[],
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
  for (const [optionValue, optionLabel] of options) {
    const entry = option(document, optionValue, optionLabel);
    entry.selected = optionValue === value;
    input.append(entry);
  }
  wrapper.append(text, input);
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
/** A multi-select of fixed choices, rendered as host chips. */
export function chipsField(
  document: Document,
  label: string,
  name: string,
  selected: readonly string[],
  options: readonly (readonly [string, string])[],
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
  for (const [value, optionLabel] of options) {
    const entry = option(document, value, optionLabel);
    entry.selected = selected.includes(value);
    input.append(entry);
  }
  wrapper.append(text, input);
  return wrapper;
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
  variant: "" | "primary" | "danger" = "",
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
