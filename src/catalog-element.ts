import { hostLocale, problemText, translator, type Translator } from "./catalogs.js";
import { confirmDialog, openDialog } from "./dialogs.js";
import { downloadFile } from "./download.js";
import { describeEffect, effectsEditor, type EffectsEditor } from "./effects.js";
import { describeGrants, grantsEditor, type GrantsEditor } from "./grants.js";
import {
  actionButton,
  badge,
  checkField,
  chipsField,
  element,
  formText,
  formValues,
  markdown,
  messageBlock,
  selectField,
  textArea,
  textField,
} from "./fields.js";
import { fold } from "./gallery-model.js";
import { parseImportCommit, parseImportPreview, type ImportPreview } from "./import-review.js";
import { LiveRefresh } from "./live-refresh.js";
import {
  bodyPlacements,
  canonical,
  classProblem,
  collections,
  compare,
  exportDocument,
  flatten,
  freeId,
  HomebrewError,
  importFormat,
  itemProblem,
  maxConditionSummary,
  maxMarkdown,
  newClass,
  newItem,
  planImport,
  planPublish,
  rarities,
  slug,
  type BodyPlacement,
  type Item,
  type ItemClass,
  type Mechanics,
  type Overrides,
  type Problem,
  type Rarity,
  type Stored,
} from "./model.js";
import type { Drafts, PublishedState } from "./repository.js";
import { runtimeFor, type HomebrewRuntime } from "./runtime.js";
import type { ContributionContext } from "./sdk.js";

export const catalogElementTag = "dnd-homebrew-catalog";

type Selection =
  | { readonly kind: "class"; readonly id: string }
  | { readonly kind: "item"; readonly id: string }
  | { readonly kind: "new-class" }
  /** `template` prefills the editor, as Duplicate does. */
  | { readonly kind: "new-item"; readonly classId: string; readonly template?: Item };

/** Common item types, offered as suggestions; any one-line type is allowed. */
const itemTypes = [
  "Wondrous Item",
  "Armor",
  "Weapon",
  "Ring",
  "Rod",
  "Staff",
  "Wand",
  "Potion",
  "Scroll",
  "Ammunition",
] as const;

export function defineCatalogElement(generation?: string): string {
  const tag = generation ? `${catalogElementTag}-${generation}` : catalogElementTag;
  if (customElements.get(tag)) return tag;
  class CatalogElement extends HTMLElement {
    #contribution: ContributionContext | undefined;
    #runtime: HomebrewRuntime | undefined;
    #controls: ReturnType<HomebrewRuntime["ui"]["enhance"]> | undefined;
    #connection: AbortController | undefined;
    #refresh: LiveRefresh | undefined;
    #drafts: Drafts | undefined;
    #published: PublishedState | undefined;
    #selection: Selection | undefined;
    #query = "";
    #dirty = false;
    #busy = false;
    #message: { text: string; kind: "status" | "alert" } | undefined;
    #editorMessage: { text: string; kind: "status" | "alert" } | undefined;
    #effects: EffectsEditor | undefined;
    #grants: GrantsEditor | undefined;
    readonly #header = document.createElement("div");
    readonly #tree = document.createElement("nav");
    readonly #editor = document.createElement("section");
    readonly #fileInput = document.createElement("input");

    set codexContribution(value: ContributionContext) {
      const previous = this.#contribution;
      this.#contribution = value;
      if (!this.isConnected) return;
      if (previous?.addon.generation !== value.addon.generation) this.#connect();
      else if (hostLocale(previous.host) !== hostLocale(value.host)) this.#renderAll(true);
    }
    get #t(): Translator {
      return translator(hostLocale(this.#contribution?.host));
    }
    connectedCallback(): void {
      this.classList.add("dnd-homebrew", "hb-shell");
      this.#tree.className = "hb-tree";
      this.#editor.className = "hb-editor";
      this.#fileInput.type = "file";
      this.#fileInput.accept = ".json,application/json";
      this.#fileInput.hidden = true;
      this.#fileInput.addEventListener("change", () => {
        const file = this.#fileInput.files?.[0];
        this.#fileInput.value = "";
        if (file) void this.#import(file);
      });
      const layout = element(document, "div", "hb-layout");
      layout.append(this.#tree, this.#editor);
      this.replaceChildren(this.#header, layout, this.#fileInput);
      this.#connect();
    }
    disconnectedCallback(): void {
      this.#connection?.abort();
      this.#connection = undefined;
      this.#refresh?.dispose();
      this.#refresh = undefined;
      this.#controls?.dispose();
      this.#controls = undefined;
      this.#runtime = undefined;
      this.#contribution?.edits.set({ dirty: false, saving: false });
    }

    #signal(): AbortSignal {
      return AbortSignal.any([
        this.#connection?.signal ?? AbortSignal.abort(),
        this.#runtime?.signal ?? AbortSignal.abort(),
        this.#contribution?.signal ?? AbortSignal.abort(),
      ]);
    }
    #connect(): void {
      this.#connection?.abort();
      this.#refresh?.dispose();
      this.#controls?.dispose();
      const contribution = this.#contribution,
        runtime = contribution && runtimeFor(contribution.addon.generation);
      this.#runtime = runtime;
      if (!runtime || runtime.signal.aborted) {
        this.#message = {
          text: "This page belongs to an add-on version that is no longer active. Reload the page.",
          kind: "alert",
        };
        this.#renderHeader();
        return;
      }
      this.#connection = new AbortController();
      this.#controls = runtime.ui.enhance(this);
      this.#refresh = new LiveRefresh(
        () => !this.#dirty && !this.#busy,
        () => void this.#load(),
      );
      runtime.repository.subscribe(() => this.#refresh?.invalidate(), this.#signal());
      this.#message = { text: "Loading homebrew items…", kind: "status" };
      this.#renderHeader();
      void this.#load();
    }
    async #load(): Promise<void> {
      const runtime = this.#runtime;
      if (!runtime) return;
      this.#refresh?.consume();
      const signal = this.#signal();
      try {
        const [drafts, published] = await Promise.all([
          runtime.repository.drafts(signal),
          runtime.repository.published(signal, true),
        ]);
        if (signal.aborted || this.#runtime !== runtime) return;
        this.#drafts = drafts;
        this.#published = published;
        if (this.#message?.text === "Loading homebrew items…") this.#message = undefined;
        // A selected draft that is gone leaves the editor; a new one stays open.
        const selection = this.#selection;
        if (selection && "id" in selection && !this.#selected()) this.#selection = undefined;
        this.#renderAll(!this.#dirty);
      } catch (error) {
        if (signal.aborted) return;
        this.#message = {
          text: messageOf(error, "Homebrew items could not be loaded. Reload to try again."),
          kind: "alert",
        };
        this.#renderHeader();
      }
    }

    // --- Rendering ---------------------------------------------------------

    #renderAll(editor: boolean): void {
      this.#renderHeader();
      this.#renderTree();
      if (editor) this.#renderEditor();
      this.#controls?.refresh();
    }
    #renderHeader(): void {
      const t = this.#t;
      const title = element(document, "div", "hb-title");
      title.append(
        element(document, "h1", "", t("Homebrew Items")),
        element(
          document,
          "p",
          "",
          t("Create item classes and items, then publish them to use them on character sheets."),
        ),
      );
      const actions = element(document, "div", "hb-actions");
      actions.dataset["uiActions"] = "";
      const ready = this.#drafts !== undefined && !this.#busy;
      const pending = this.#pendingChanges();
      const buttons = [
        actionButton(document, t("New class"), () => void this.#select({ kind: "new-class" })),
        actionButton(
          document,
          t("New item"),
          () => void this.#select({ kind: "new-item", classId: this.#currentClassId() }),
        ),
        actionButton(document, t("Import file"), () => this.#fileInput.click()),
        actionButton(document, t("Export"), () => this.#export()),
        actionButton(
          document,
          pending > 0 ? t("Publish changes ({count})", { count: pending }) : t("Publish"),
          () => void this.#publish(),
          "primary",
        ),
      ];
      for (const button of buttons) button.disabled = !ready;
      if (pending === 0) buttons[4]!.disabled = true;
      actions.append(...buttons);
      const top = element(document, "header", "hb-header");
      top.append(title, actions);
      this.#header.replaceChildren(top);
      if (this.#drafts && this.#published) {
        const meta = this.#published.meta;
        const status = [
          meta
            ? t("Published revision {revision}, items: {count}.", {
                revision: meta.value.revision,
                count: meta.value.recordCount,
              })
            : t("Never published."),
          pending > 0
            ? t("Unpublished changes: {count}.", { count: pending })
            : t("Everything is published."),
        ].join(" ");
        this.#header.append(element(document, "p", "hb-status", status));
      }
      if (this.#message)
        this.#header.append(messageBlock(document, t(this.#message.text), this.#message.kind));
      const unreadable = [
        ...(this.#drafts?.unreadable ?? []),
        ...(this.#published?.unreadable ?? []),
      ];
      if (unreadable.length > 0) {
        const block = messageBlock(document, t("Some stored drafts could not be read:"), "alert");
        const list = element(document, "ul");
        for (const entry of unreadable.slice(0, 20))
          list.append(
            element(document, "li", "", `${entry.collection}/${entry.key}: ${entry.message}`),
          );
        block.append(list);
        this.#header.append(block);
      }
    }
    #renderTree(): void {
      const t = this.#t;
      this.#tree.setAttribute("aria-label", t("Homebrew Items"));
      const search = element(document, "input");
      search.type = "search";
      search.dataset["ui"] = "search";
      search.dataset["uiKey"] = "tree-search";
      search.placeholder = t("Search items");
      search.setAttribute("aria-label", t("Search items"));
      search.value = this.#query;
      search.addEventListener("input", () => {
        this.#query = search.value;
        this.#renderTreeGroups();
      });
      const groups = element(document, "div", "hb-tree-groups");
      this.#tree.replaceChildren(search, groups);
      this.#renderTreeGroups();
    }
    #renderTreeGroups(): void {
      const t = this.#t;
      const groups = this.#tree.querySelector(".hb-tree-groups");
      if (!groups || !this.#drafts) return;
      groups.replaceChildren();
      const query = fold(this.#query.trim());
      const classes = [...this.#drafts.classes].sort((a, b) =>
        compare(fold(a.value.name), fold(b.value.name)),
      );
      const items = [...this.#drafts.items].sort((a, b) =>
        compare(fold(a.value.name), fold(b.value.name)),
      );
      const matches = (item: Item, itemClass?: ItemClass): boolean =>
        !query ||
        fold(item.name).includes(query) ||
        (itemClass !== undefined && fold(itemClass.name).includes(query));
      if (classes.length === 0 && items.length === 0) {
        groups.append(
          element(
            document,
            "p",
            "hb-hint",
            t("No items yet. Create a class or import a file to begin."),
          ),
        );
        return;
      }
      const group = (
        label: string,
        itemClass: ItemClass | undefined,
        members: readonly Stored<Item>[],
      ): void => {
        const visible = members.filter((entry) => matches(entry.value, itemClass));
        if (query && visible.length === 0 && !(itemClass && fold(itemClass.name).includes(query)))
          return;
        const section = element(document, "section", "hb-group");
        if (itemClass) {
          const head = this.#treeButton(label, { kind: "class", id: itemClass.id });
          head.classList.add("hb-group-head");
          head.append(badge(document, t("Items: {count}", { count: members.length }), "muted"));
          if (!itemClass.playerVisible) head.append(badge(document, t("Hidden"), "muted"));
          section.append(head);
        } else section.append(element(document, "h2", "hb-group-head", label));
        const list = element(document, "ul");
        for (const entry of visible) {
          const button = this.#treeButton(entry.value.name, { kind: "item", id: entry.value.id });
          for (const [text, tone] of this.#itemBadges(entry.value, itemClass))
            button.append(badge(document, t(text), tone));
          const row = element(document, "li");
          row.append(button);
          list.append(row);
        }
        section.append(list);
        groups.append(section);
      };
      for (const entry of classes)
        group(
          entry.value.name,
          entry.value,
          items.filter((item) => item.value.classId === entry.value.id),
        );
      const loose = items.filter(
        (item) =>
          item.value.classId === "" ||
          !classes.some((entry) => entry.value.id === item.value.classId),
      );
      if (loose.length > 0) group(t("Items without a class"), undefined, loose);
    }
    #treeButton(label: string, selection: Selection): HTMLButtonElement {
      const button = element(document, "button", "hb-tree-item");
      button.type = "button";
      button.append(element(document, "span", "hb-tree-name", label));
      const current = this.#selection;
      if (
        current &&
        current.kind === selection.kind &&
        "id" in current &&
        "id" in selection &&
        current.id === selection.id
      )
        button.setAttribute("aria-current", "true");
      button.addEventListener("click", () => void this.#select(selection));
      return button;
    }
    #itemBadges(
      item: Item,
      itemClass: ItemClass | undefined,
    ): [string, "" | "muted" | "warn" | "accent"][] {
      const badges: [string, "" | "muted" | "warn" | "accent"][] = [
        item.characterMechanics === "complete" ? ["Automated", "accent"] : ["Text only", "muted"],
      ];
      if (!(item.playerVisible && (itemClass?.playerVisible ?? true)))
        badges.push(["Hidden", "muted"]);
      if (item.retired) badges.push(["Retired", "warn"]);
      const published = this.#published?.records.get(`hb.${item.id}`);
      if (!published || published.value.withdrawn) badges.push(["Unpublished", "warn"]);
      else if (canonical(published.value) !== canonical(flatten(itemClass, item)))
        badges.push(["Changed", "warn"]);
      return badges;
    }
    #pendingChanges(): number {
      if (!this.#drafts || !this.#published) return 0;
      const plan = planPublish(
        this.#drafts.classes.map((entry) => entry.value),
        this.#drafts.items.map((entry) => entry.value),
        this.#published.records,
        this.#published.meta,
        0,
      );
      return plan.changes.length + plan.problems.length;
    }

    #selected(): Stored<ItemClass> | Stored<Item> | undefined {
      const selection = this.#selection;
      if (!selection || !this.#drafts) return undefined;
      if (selection.kind === "class")
        return this.#drafts.classes.find((entry) => entry.value.id === selection.id);
      if (selection.kind === "item")
        return this.#drafts.items.find((entry) => entry.value.id === selection.id);
      return undefined;
    }
    #currentClassId(): string {
      const selection = this.#selection;
      if (selection?.kind === "class") return selection.id;
      if (selection?.kind === "item")
        return (
          this.#drafts?.items.find((entry) => entry.value.id === selection.id)?.value.classId ?? ""
        );
      if (selection?.kind === "new-item") return selection.classId;
      return "";
    }
    async #select(selection: Selection): Promise<void> {
      if (
        this.#dirty &&
        !(await confirmDialog(
          this,
          this.#t,
          this.#t("Leave unsaved changes?"),
          this.#t("Discard changes"),
        ))
      )
        return;
      this.#selection = selection;
      this.#setDirty(false);
      this.#editorMessage = undefined;
      this.#renderTree();
      this.#renderEditor();
      this.#controls?.refresh();
      this.#editor
        .querySelector<HTMLElement>("input, select, textarea")
        ?.focus({ preventScroll: true });
    }
    #setDirty(dirty: boolean): void {
      this.#dirty = dirty;
      this.#contribution?.edits.set({ dirty, saving: this.#busy });
      if (!dirty) this.#refresh?.wake();
    }
    #setBusy(busy: boolean): void {
      this.#busy = busy;
      this.#contribution?.edits.set({ dirty: this.#dirty, saving: busy });
      for (const button of this.querySelectorAll<HTMLButtonElement>(
        ".hb-header button, .hb-editor-actions button",
      ))
        button.disabled = busy;
      if (!busy) this.#refresh?.wake();
    }

    // --- Editors -----------------------------------------------------------

    #renderEditor(): void {
      const t = this.#t;
      this.#effects = undefined;
      this.#grants = undefined;
      const selection = this.#selection;
      if (!selection || !this.#drafts) {
        this.#editor.replaceChildren(
          element(document, "p", "hb-hint", t("Choose a class or an item to edit it.")),
        );
        return;
      }
      if (selection.kind === "class" || selection.kind === "new-class") {
        const stored =
          selection.kind === "class"
            ? this.#drafts.classes.find((entry) => entry.value.id === selection.id)
            : undefined;
        this.#editor.replaceChildren(this.#classForm(stored));
      } else {
        const stored =
          selection.kind === "item"
            ? this.#drafts.items.find((entry) => entry.value.id === selection.id)
            : undefined;
        this.#editor.replaceChildren(
          selection.kind === "new-item"
            ? this.#itemForm(undefined, selection.classId, selection.template)
            : this.#itemForm(stored, undefined),
        );
      }
    }
    /**
     * The permanent id field. A new draft may leave it empty: the placeholder
     * follows the name and shows the id saving will use.
     */
    #idField(saved: boolean, value: string, example: string): HTMLLabelElement {
      const t = this.#t;
      return textField(document, t("Id"), "id", value, {
        maxLength: 64,
        readOnly: saved,
        placeholder: example,
        hint: saved
          ? t("Used in saved characters; it cannot change after the first save.")
          : t(
              "Leave it empty to make one from the name. Saved characters use it, so it cannot change after the first save.",
            ),
      });
    }
    #previewId(form: HTMLFormElement, taken: () => ReadonlySet<string>): void {
      const name = form.querySelector<HTMLInputElement>('input[name="name"]'),
        id = form.querySelector<HTMLInputElement>('input[name="id"]');
      if (!name || !id || id.readOnly) return;
      const example = id.placeholder;
      const update = (): void => {
        const text = name.value.trim();
        id.placeholder = text ? freeId(text, taken()) : example;
      };
      name.addEventListener("input", update);
      update();
    }
    #classIds(): ReadonlySet<string> {
      return new Set(this.#drafts?.classes.map((entry) => entry.value.id) ?? []);
    }
    /** Item ids in use, including published records whose draft was deleted. */
    #itemIds(): ReadonlySet<string> {
      return new Set([
        ...(this.#drafts?.items.map((entry) => entry.value.id) ?? []),
        ...[...(this.#published?.records.values() ?? [])].map((entry) => entry.value.itemId),
      ]);
    }
    #form(title: string): HTMLFormElement {
      const form = element(document, "form", "hb-form");
      form.noValidate = true;
      form.append(element(document, "h2", "", title));
      form.addEventListener("input", () => this.#setDirty(true));
      form.addEventListener("change", () => this.#setDirty(true));
      if (this.#editorMessage)
        form.append(messageBlock(document, this.#editorMessage.text, this.#editorMessage.kind));
      return form;
    }
    #classForm(stored: Stored<ItemClass> | undefined): HTMLFormElement {
      const t = this.#t;
      const value = stored?.value ?? newClass("", "", Date.now());
      const form = this.#form(stored ? value.name : t("New class"));
      form.append(
        textField(document, t("Name"), "name", value.name, { maxLength: 120 }),
        this.#idField(stored !== undefined, value.id, "elemental-rings"),
        textField(document, t("Name prefix"), "namePrefix", value.namePrefix, {
          maxLength: 60,
          hint: t("Shown before each item's name, for example Elemental Ring: Fire."),
        }),
        textField(document, t("Item type"), "itemType", value.itemType, {
          maxLength: 120,
          suggestions: itemTypes,
        }),
        selectField(
          document,
          t("Rarity"),
          "rarity",
          value.rarity,
          rarities.map((rarity) => [rarity, t(rarity)] as const),
        ),
        checkField(document, t("Requires attunement"), "attunement", value.attunement),
        chipsField(
          document,
          t("Body placements"),
          "bodyPlacements",
          value.bodyPlacements,
          bodyPlacements.map((placement) => [placement, t(placement)] as const),
        ),
        textField(document, t("Tags"), "tags", value.tags.join(", "), {
          hint: t("Lowercase words joined by hyphens, separated by commas."),
        }),
        textArea(
          document,
          t("Shared description"),
          "description",
          value.description,
          4,
          maxMarkdown,
          t("Added to every item in the class."),
        ),
        textArea(
          document,
          t("Curse"),
          "curse",
          value.curse,
          3,
          maxMarkdown,
          t("Added to every item as its curse."),
        ),
      );
      const condition = element(document, "fieldset", "hb-effects-fieldset");
      condition.append(
        element(document, "legend", "", t("Condition")),
        element(
          document,
          "p",
          "hb-hint",
          t(
            "Every item of the class gives this condition. Its level on the sheet is the number of the class's items in effect. Leave the name empty for none.",
          ),
        ),
        textField(document, t("Condition name"), "conditionName", value.condition?.name ?? "", {
          maxLength: 120,
          placeholder: "Elemental Attunement",
        }),
        textField(document, t("Condition id"), "conditionId", value.condition?.id ?? "", {
          maxLength: 64,
          placeholder: "elemental-attunement",
          hint: t("Filled from the name when empty."),
        }),
        textArea(
          document,
          t("Condition summary"),
          "conditionSummary",
          value.condition?.summary ?? "",
          3,
          maxConditionSummary,
          t("What each level does, as players read it."),
        ),
      );
      form.append(
        condition,
        checkField(
          document,
          t("Visible to players"),
          "playerVisible",
          value.playerVisible,
          t("Lists the class in the player gallery. Each item also needs its own switch."),
        ),
      );
      this.#previewId(form, () => this.#classIds());
      const actions = element(document, "div", "hb-editor-actions");
      actions.dataset["uiActions"] = "";
      const save = actionButton(
        document,
        t("Save"),
        () => void this.#saveClass(form, stored),
        "primary",
      );
      save.type = "submit";
      actions.append(save);
      if (stored) {
        actions.append(
          actionButton(
            document,
            t("Add item to this class"),
            () => void this.#select({ kind: "new-item", classId: value.id }),
          ),
          actionButton(document, t("Delete"), () => void this.#deleteClass(stored), "danger"),
        );
      }
      form.append(actions);
      form.addEventListener("submit", (event) => event.preventDefault());
      return form;
    }
    #readClass(form: HTMLFormElement, stored: Stored<ItemClass> | undefined): ItemClass {
      const data = new FormData(form);
      const name = formText(data, "name").trim();
      const taken = this.#classIds();
      const conditionName = formText(data, "conditionName").trim(),
        conditionId = formText(data, "conditionId").trim(),
        conditionSummary = formText(data, "conditionSummary").trim();
      const condition =
        conditionName || conditionId || conditionSummary
          ? {
              id: conditionId || slug(conditionName),
              name: conditionName,
              summary: conditionSummary,
            }
          : undefined;
      return {
        id: stored?.value.id ?? (formText(data, "id").trim() || freeId(name, taken)),
        schemaVersion: 1,
        name,
        description: formText(data, "description"),
        curse: formText(data, "curse"),
        itemType: formText(data, "itemType").trim(),
        rarity: formText(data, "rarity") as Rarity,
        attunement: data.get("attunement") !== null,
        bodyPlacements: formValues(data, "bodyPlacements") as BodyPlacement[],
        tags: splitTags(formText(data, "tags")),
        namePrefix: formText(data, "namePrefix").trim(),
        playerVisible: data.get("playerVisible") !== null,
        updatedAt: Date.now(),
        ...(condition ? { condition } : {}),
      };
    }
    async #saveClass(form: HTMLFormElement, stored: Stored<ItemClass> | undefined): Promise<void> {
      const value = this.#readClass(form, stored);
      const named = !stored && formText(new FormData(form), "id").trim() === "";
      if (!stored && this.#classIds().has(value.id))
        return this.#editorProblem({ text: "This id is already in use. Choose another id." });
      const failure = classProblem(value);
      if (failure) return this.#editorProblem(failure);
      await this.#save(
        collections.classes,
        value,
        stored,
        (saved) => ({ kind: "class", id: saved.id }),
        named
          ? (failed) => ({
              ...value,
              id: freeId(value.name, new Set([...this.#classIds(), ...failed])),
            })
          : undefined,
      );
    }
    #itemForm(
      stored: Stored<Item> | undefined,
      classId: string | undefined,
      template?: Item,
    ): HTMLFormElement {
      const t = this.#t;
      const value = stored?.value ?? template ?? newItem("", "", classId ?? "", Date.now());
      const form = this.#form(stored ? value.name : t("New item"));
      const classes = [...(this.#drafts?.classes ?? [])].sort((a, b) =>
        compare(fold(a.value.name), fold(b.value.name)),
      );
      const classOf = (id: string): ItemClass | undefined =>
        classes.find((entry) => entry.value.id === id)?.value;
      form.append(
        textField(document, t("Name"), "name", value.name, { maxLength: 120 }),
        this.#idField(stored !== undefined, value.id, "ring-of-embers"),
        selectField(document, t("Class"), "classId", value.classId, [
          ["", t("No class")],
          ...classes.map((entry) => [entry.value.id, entry.value.name] as const),
        ]),
        textArea(
          document,
          t("Description"),
          "text",
          value.text,
          5,
          maxMarkdown,
          t("The effect as players read it on their character sheet."),
        ),
      );
      const effects = element(document, "fieldset", "hb-effects-fieldset");
      effects.append(
        element(document, "legend", "", t("Effects")),
        element(
          document,
          "p",
          "hb-hint",
          t(
            "Effects and properties apply while the item is equipped, and attuned when it requires attunement. An item with neither is text only: the sheet shows its description.",
          ),
        ),
      );
      this.#effects = effectsEditor(
        document,
        value.characterEffects,
        t,
        () => {
          this.#setDirty(true);
          this.#updatePreview(form, stored);
        },
        () => this.#controls?.refresh(),
      );
      effects.append(this.#effects.root);
      const grants = element(document, "fieldset", "hb-effects-fieldset");
      grants.append(
        element(document, "legend", "", t("Properties")),
        element(
          document,
          "p",
          "hb-hint",
          t(
            "Advantages, limited uses, spells, toggles and resistances, on the same terms. Item spells never use spell slots.",
          ),
        ),
      );
      this.#grants = grantsEditor(
        document,
        value.grants,
        t,
        () => {
          this.#setDirty(true);
          this.#updatePreview(form, stored);
        },
        () => this.#controls?.refresh(),
        () => form.querySelector<HTMLInputElement>('input[name="name"]')?.value.trim() ?? "",
      );
      grants.append(this.#grants.root);
      form.append(effects, grants);

      const defaults = element(document, "details", "hb-defaults");
      const inherited = classOf(value.classId);
      defaults.open = Object.keys(value.overrides).length > 0;
      defaults.append(
        element(document, "summary", "", t("Class defaults")),
        element(document, "p", "hb-hint", t("Leave a field empty to use the class's value.")),
      );
      const fromClass = (text: string): string => t("From class ({value})", { value: text });
      defaults.append(
        textField(document, t("Item type"), "overrideItemType", value.overrides.itemType ?? "", {
          maxLength: 120,
          placeholder: inherited?.itemType ?? "Wondrous Item",
          suggestions: itemTypes,
        }),
        selectField(document, t("Rarity"), "overrideRarity", value.overrides.rarity ?? "", [
          ["", fromClass(t(inherited?.rarity ?? "Common"))],
          ...rarities.map((rarity) => [rarity, t(rarity)] as const),
        ]),
        selectField(
          document,
          t("Requires attunement"),
          "overrideAttunement",
          value.overrides.attunement === undefined ? "" : value.overrides.attunement ? "yes" : "no",
          [
            ["", fromClass(t((inherited?.attunement ?? false) ? "Yes" : "No"))],
            ["yes", t("Yes")],
            ["no", t("No")],
          ],
        ),
        checkField(
          document,
          t("Use the class's placements"),
          "inheritPlacements",
          value.overrides.bodyPlacements === undefined,
        ),
        chipsField(
          document,
          t("Body placements"),
          "overridePlacements",
          value.overrides.bodyPlacements ?? inherited?.bodyPlacements ?? [],
          bodyPlacements.map((placement) => [placement, t(placement)] as const),
        ),
      );
      form.append(
        defaults,
        textField(document, t("Tags"), "tags", value.tags.join(", "), {
          hint: t("Lowercase words joined by hyphens, separated by commas."),
        }),
        checkField(
          document,
          t("Visible to players"),
          "playerVisible",
          value.playerVisible,
          t("Lists the item in the player gallery when its class is visible too."),
        ),
        checkField(
          document,
          t("Retired"),
          "retired",
          value.retired,
          t("Retired items stay usable on character sheets but leave the player gallery."),
        ),
      );
      const preview = element(document, "section", "hb-preview");
      preview.setAttribute("aria-live", "polite");
      form.append(preview);
      this.#previewId(form, () => this.#itemIds());
      const actions = element(document, "div", "hb-editor-actions");
      actions.dataset["uiActions"] = "";
      const save = actionButton(
        document,
        t("Save"),
        () => void this.#saveItem(form, stored, false),
        "primary",
      );
      save.type = "submit";
      actions.append(save);
      if (stored)
        actions.append(
          actionButton(
            document,
            t("Duplicate"),
            () =>
              void this.#select({
                kind: "new-item",
                classId: stored.value.classId,
                template: {
                  ...stored.value,
                  id: "",
                  name: t("{name} (copy)", { name: stored.value.name }),
                  retired: false,
                },
              }),
          ),
          actionButton(document, t("Delete"), () => void this.#deleteItem(stored), "danger"),
        );
      else
        actions.append(
          actionButton(
            document,
            t("Save and add another"),
            () => void this.#saveItem(form, stored, true),
          ),
        );
      form.append(actions);
      form.addEventListener("submit", (event) => event.preventDefault());
      form.addEventListener("input", () => this.#updatePreview(form, stored));
      form.addEventListener("change", () => this.#updatePreview(form, stored));
      this.#updatePreview(form, stored);
      return form;
    }
    #readItem(form: HTMLFormElement, stored: Stored<Item> | undefined): Item {
      const data = new FormData(form);
      const name = formText(data, "name").trim();
      const effects = this.#effects?.read() ?? [],
        grants = this.#grants?.read();
      // An item is automated exactly when it declares something to automate.
      const mechanics: Mechanics =
        effects.length > 0 || grants !== undefined ? "complete" : "narrative";
      const itemType = formText(data, "overrideItemType").trim(),
        rarity = formText(data, "overrideRarity"),
        attunement = formText(data, "overrideAttunement");
      const overrides: Overrides = {
        ...(itemType ? { itemType } : {}),
        ...(rarity ? { rarity: rarity as Rarity } : {}),
        ...(attunement ? { attunement: attunement === "yes" } : {}),
        ...(data.get("inheritPlacements") === null
          ? { bodyPlacements: formValues(data, "overridePlacements") as BodyPlacement[] }
          : {}),
      };
      return {
        id: stored?.value.id ?? (formText(data, "id").trim() || freeId(name, this.#itemIds())),
        schemaVersion: 1,
        classId: formText(data, "classId"),
        name,
        text: formText(data, "text"),
        overrides,
        tags: splitTags(formText(data, "tags")),
        characterMechanics: mechanics,
        characterEffects: effects,
        playerVisible: data.get("playerVisible") !== null,
        retired: data.get("retired") !== null,
        updatedAt: Date.now(),
        ...(grants ? { grants } : {}),
      };
    }
    #updatePreview(form: HTMLFormElement, stored: Stored<Item> | undefined): void {
      const t = this.#t;
      const preview = form.querySelector(".hb-preview");
      if (!preview) return;
      const item = this.#readItem(form, stored);
      const itemClass = this.#drafts?.classes.find(
        (entry) => entry.value.id === item.classId,
      )?.value;
      const published = flatten(itemClass, { ...item, name: item.name || t("New item") });
      const failure = itemProblem({ ...item, id: item.id || "item", name: item.name || "item" });
      preview.replaceChildren(
        element(document, "h3", "", t("As published")),
        element(document, "p", "hb-preview-name", published.record.name),
      );
      if (failure) preview.append(messageBlock(document, problemText(t, failure), "alert"));
      const lines = [
        ...published.record.characterEffects.map((effect) => describeEffect(effect, t)),
        ...describeGrants(published.record.grants, t),
      ];
      if (lines.length > 0) {
        const list = element(document, "ul", "hb-effect-summary");
        for (const line of lines) list.append(element(document, "li", "", line));
        preview.append(list);
      }
      preview.append(markdown(document, published.record.text));
    }
    async #saveItem(
      form: HTMLFormElement,
      stored: Stored<Item> | undefined,
      another: boolean,
    ): Promise<void> {
      const value = this.#readItem(form, stored);
      const named = !stored && formText(new FormData(form), "id").trim() === "";
      if (!stored && this.#itemIds().has(value.id))
        return this.#editorProblem({ text: "This id is already in use. Choose another id." });
      const failure = itemProblem(value);
      if (failure) return this.#editorProblem(failure);
      await this.#save(
        collections.items,
        value,
        stored,
        (saved) =>
          another ? { kind: "new-item", classId: saved.classId } : { kind: "item", id: saved.id },
        named
          ? (failed) => ({
              ...value,
              id: freeId(value.name, new Set([...this.#itemIds(), ...failed])),
            })
          : undefined,
      );
    }
    #editorProblem(problem: Problem): void {
      this.#editorMessage = { text: problemText(this.#t, problem), kind: "alert" };
      const form = this.#editor.querySelector("form");
      form?.querySelector(":scope > .hb-message")?.remove();
      form?.querySelector("h2")?.after(messageBlock(document, this.#editorMessage.text, "alert"));
      this.#editorMessage = undefined;
    }
    /**
     * Saves one draft and selects what `select` names. A new draft whose id
     * came from its name can still meet a deleted draft's key, which the
     * browser cannot reuse; `rename` then gives the next free id.
     */
    async #save<T extends ItemClass | Item>(
      collection: typeof collections.classes | typeof collections.items,
      value: T,
      stored: Stored<T> | undefined,
      select: (saved: T) => Selection,
      rename?: (failed: ReadonlySet<string>) => T,
    ): Promise<void> {
      const runtime = this.#runtime;
      if (!runtime || this.#busy) return;
      this.#setBusy(true);
      try {
        const failed = new Set<string>();
        let draft = value;
        for (;;) {
          try {
            await runtime.repository.save(collection, draft, stored?.revision ?? 0, this.#signal());
            break;
          } catch (error) {
            if (!rename || !isConflict(error) || failed.size >= 5) throw error;
            failed.add(draft.id);
            draft = rename(failed);
          }
        }
        this.#selection = select(draft);
        this.#setDirty(false);
        this.#editorMessage = { text: this.#t("Saved."), kind: "status" };
        this.#setBusy(false);
        await this.#load();
        this.#editorMessage = undefined;
      } catch (error) {
        this.#setBusy(false);
        if (isConflict(error))
          this.#editorProblem({
            text: stored
              ? "Someone else changed this draft. Reload to see their version."
              : "This id was used by a deleted draft. Choose another id.",
          });
        else this.#editorProblem({ text: messageOf(error, "The draft could not be saved.") });
      }
    }
    async #deleteClass(stored: Stored<ItemClass>): Promise<void> {
      const t = this.#t;
      if (this.#drafts?.items.some((entry) => entry.value.classId === stored.value.id))
        return this.#editorProblem({ text: "Move or delete this class's items first." });
      if (
        !(await confirmDialog(
          this,
          t,
          t("Delete {name}?", { name: stored.value.name }),
          t("Delete"),
        ))
      )
        return;
      await this.#remove(collections.classes, stored);
    }
    async #deleteItem(stored: Stored<Item>): Promise<void> {
      const t = this.#t;
      const published = this.#published?.records.get(`hb.${stored.value.id}`);
      const question =
        published && !published.value.withdrawn
          ? t(
              "Deleting a published item withdraws it at the next publish; characters holding it then show a missing-source problem. Retire it instead to keep it on their sheets. Delete {name}?",
              { name: stored.value.name },
            )
          : t("Delete {name}?", { name: stored.value.name });
      if (!(await confirmDialog(this, t, question, t("Delete")))) return;
      await this.#remove(collections.items, stored);
    }
    async #remove(
      collection: typeof collections.classes | typeof collections.items,
      stored: Stored<ItemClass> | Stored<Item>,
    ): Promise<void> {
      const runtime = this.#runtime;
      if (!runtime || this.#busy) return;
      this.#setBusy(true);
      try {
        await runtime.repository.remove(
          collection,
          stored.value.id,
          stored.revision,
          this.#signal(),
        );
        this.#selection = undefined;
        this.#setDirty(false);
        this.#setBusy(false);
        await this.#load();
      } catch (error) {
        this.#setBusy(false);
        this.#editorProblem({
          text: isConflict(error)
            ? "Someone else changed this draft. Reload to see their version."
            : messageOf(error, "The draft could not be saved."),
        });
      }
    }

    // --- Publish, import, export ------------------------------------------

    async #publish(): Promise<void> {
      const runtime = this.#runtime,
        t = this.#t;
      if (!runtime || this.#busy) return;
      if (
        this.#dirty &&
        !(await confirmDialog(this, t, t("Leave unsaved changes?"), t("Discard changes")))
      )
        return;
      this.#setBusy(true);
      const signal = this.#signal();
      try {
        const [drafts, published] = await Promise.all([
          runtime.repository.drafts(signal),
          runtime.repository.published(signal, true),
        ]);
        const plan = planPublish(
          drafts.classes.map((entry) => entry.value),
          drafts.items.map((entry) => entry.value),
          published.records,
          published.meta,
          Date.now(),
        );
        const body = element(document, "div", "hb-dialog-body");
        let confirmable = plan.problems.length === 0 && plan.mutations.length > 0;
        if (plan.problems.length > 0) {
          const block = messageBlock(document, t("Fix these drafts before publishing:"), "alert");
          const list = element(document, "ul");
          for (const entry of plan.problems) {
            const name =
              drafts.items.find((item) => item.value.id === entry.itemId)?.value.name ??
              entry.itemId;
            list.append(element(document, "li", "", `${name}: ${problemText(t, entry.problem)}`));
          }
          block.append(list);
          body.append(block);
        } else if (plan.mutations.length > 256) {
          confirmable = false;
          body.append(
            messageBlock(
              document,
              t("Publishing would make {count} changes; publish at most 255 at a time.", {
                count: plan.mutations.length - 1,
              }),
              "alert",
            ),
          );
        } else {
          body.append(
            element(
              document,
              "p",
              "",
              t(
                "Publishing changes the rules data every character uses. Each character sheet asks its owner to adopt the new rules on its next save.",
              ),
            ),
          );
          for (const [operation, label] of [
            ["add", "Added"],
            ["update", "Updated"],
            ["withdraw", "Withdrawn"],
          ] as const) {
            const changes = plan.changes.filter((change) => change.operation === operation);
            if (changes.length === 0) continue;
            body.append(element(document, "h3", "", `${t(label)} (${changes.length})`));
            const list = element(document, "ul", "hb-change-list");
            for (const change of changes) list.append(element(document, "li", "", change.name));
            body.append(list);
          }
          if (plan.changes.some((change) => change.operation === "withdraw"))
            body.append(
              messageBlock(
                document,
                t(
                  "Characters holding a withdrawn item show a missing-source problem until it leaves their inventory.",
                ),
                "alert",
              ),
            );
        }
        const confirmed = await openDialog(
          this,
          t,
          t("Publish to character sheets"),
          body,
          confirmable ? t("Publish") : undefined,
        );
        if (!confirmed) return;
        await runtime.repository.commit(
          plan.mutations,
          [...drafts.dataRevisions, ...(published.dataRevisions ?? [])],
          signal,
        );
        this.#message = { text: "Published.", kind: "status" };
      } catch (error) {
        if (signal.aborted) return;
        this.#message = {
          text: isConflict(error)
            ? "Something changed while you reviewed. Review the publish again."
            : messageOf(error, "Publishing failed. Nothing was changed."),
          kind: "alert",
        };
      } finally {
        this.#setBusy(false);
      }
      await this.#load();
    }
    async #import(file: File): Promise<void> {
      const runtime = this.#runtime,
        t = this.#t;
      if (!runtime || this.#busy || !this.#drafts) return;
      const fail = (text: string, params?: Readonly<Record<string, string | number>>): void => {
        this.#message = { text: t(text, params), kind: "alert" };
        this.#renderHeader();
      };
      if (file.size > 2 * 1024 * 1024) return fail("Import files are limited to 2 MiB.");
      let document_: unknown;
      try {
        document_ = JSON.parse(await file.text()) as unknown;
      } catch {
        return fail("The selected file is not valid JSON.");
      }
      try {
        planImport(
          document_,
          new Map(this.#drafts.classes.map((entry) => [entry.value.id, entry])),
          new Map(this.#drafts.items.map((entry) => [entry.value.id, entry])),
          Date.now(),
        );
      } catch (error) {
        return error instanceof HomebrewError
          ? fail(problemText(t, error.problem))
          : fail("The import could not be previewed.");
      }
      if (!runtime.importer.available)
        return fail(
          "The homebrew worker is not running, so imports are unavailable. Check the add-on in Settings.",
        );
      this.#setBusy(true);
      const signal = this.#signal();
      try {
        let preview: ImportPreview;
        try {
          preview = parseImportPreview(
            await runtime.importer.call<unknown>(
              "preview",
              { contractVersion: "import-preview.v1", format: importFormat, document: document_ },
              { deadlineMs: 15_000, signal },
            ),
          );
        } catch (error) {
          if (!signal.aborted) fail(messageOf(error, "The import could not be previewed."));
          return;
        }
        const body = element(document, "div", "hb-dialog-body");
        const { creates, updates, skips, deletes } = preview.summary;
        body.append(
          element(
            document,
            "p",
            "",
            t("{creates} new, {updates} changed, {skips} unchanged, {deletes} removed.", {
              creates,
              updates,
              skips,
              deletes,
            }),
          ),
        );
        for (const warning of preview.warnings)
          body.append(messageBlock(document, warning, "status"));
        const changed = creates + updates + deletes > 0;
        if (!changed)
          body.append(
            messageBlock(
              document,
              t("Nothing to import: every entry matches what is stored."),
              "status",
            ),
          );
        if (preview.changes.length > 0) {
          const list = element(document, "ul", "hb-change-list");
          for (const change of preview.changes)
            list.append(element(document, "li", "", `${change.label} — ${t(change.operation)}`));
          body.append(list);
        }
        if (
          !(await openDialog(
            this,
            t,
            t("Import homebrew items"),
            body,
            changed ? t("Import") : undefined,
          ))
        )
          return;
        try {
          const receipt = parseImportCommit(
            await runtime.importer.call<unknown>(
              "commit",
              { contractVersion: "import-commit.v1", token: preview.token },
              { deadlineMs: 15_000, idempotencyKey: crypto.randomUUID(), signal },
            ),
          );
          this.#message = {
            text: t("Import saved. Changes: {count}.", { count: receipt.writes + receipt.deletes }),
            kind: "status",
          };
        } catch (error) {
          if (!signal.aborted)
            fail(messageOf(error, "The import could not be saved. Nothing was changed."));
          return;
        }
      } finally {
        this.#setBusy(false);
      }
      await this.#load();
    }
    #export(): void {
      if (!this.#drafts) return;
      const now = new Date();
      const document_ = exportDocument(
        this.#drafts.classes.map((entry) => entry.value),
        this.#drafts.items.map((entry) => entry.value),
        now.getTime(),
      );
      downloadFile(
        document,
        `${JSON.stringify(document_, null, 2)}\n`,
        `homebrew-items-${now.toISOString().slice(0, 10)}.json`,
        "application/json",
      );
    }
  }
  customElements.define(tag, CatalogElement);
  return tag;
}

function splitTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag !== ""),
    ),
  ];
}
function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { status?: unknown }).status === 409
  );
}
/** A message our own code wrote; host and network errors get the fallback. */
function messageOf(error: unknown, fallback: string): string {
  return error instanceof HomebrewError ? error.message : fallback;
}
