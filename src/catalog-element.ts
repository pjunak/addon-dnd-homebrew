import { hostLocale, problemText, translator, type Translator } from "./catalogs.js";
import { choiceDialog, confirmDialog, openDialog } from "./dialogs.js";
import { downloadFile } from "./download.js";
import {
  actionButton,
  badge,
  checkField,
  chipsField,
  element,
  formNumber,
  formText,
  formValues,
  messageBlock,
  numberField,
  selectField,
  splitTags,
  textArea,
  textField,
} from "./fields.js";
import { fold } from "./gallery-model.js";
import { parseImportCommit, parseImportPreview, type ImportPreview } from "./import-review.js";
import { featCategoryLabels, featEditor, type FeatEditor } from "./feat-editor.js";
import { itemEditor, itemTypes, type ItemEditor } from "./item-editor.js";
import { LiveRefresh } from "./live-refresh.js";
import {
  bodyPlacements,
  canonical,
  setProblem,
  collections,
  backgroundProblem,
  compare,
  draftDeletes,
  draftPuts,
  exportDocument,
  featProblem,
  flatten,
  flattenBackground,
  flattenFeat,
  flattenSpecies,
  flattenSpell,
  flattenSubclass,
  freeId,
  HomebrewError,
  importFormat,
  itemProblem,
  maxConditionSummary,
  maxMarkdown,
  maxWeight,
  moveOverrides,
  newBackground,
  newSet,
  newItem,
  newFeat,
  newSpecies,
  newSpell,
  newSubclass,
  planImport,
  planPublish,
  rarities,
  slug,
  speciesProblem,
  spellProblem,
  subclassProblem,
  titleOf,
  type Background,
  type BodyPlacement,
  type CollectionMutation,
  type Feat,
  type Item,
  type ItemSet,
  type Problem,
  type Rarity,
  type Species,
  type Spell,
  type Stored,
  type Subclass,
} from "./model.js";
import { backgroundEditor, type BackgroundEditor } from "./background-editor.js";
import { optionOf, type FeatOption, type References } from "./references.js";
import type { DraftCollection, Drafts, PublishedState } from "./repository.js";
import { runtimeFor, type HomebrewRuntime } from "./runtime.js";
import { speciesEditor, type SpeciesEditor } from "./species-editor.js";
import { spellEditor, spellLevelLabel, type SpellEditor } from "./spell-editor.js";
import { mechanicsEditor, type MechanicsEditor } from "./subclass-editor.js";
import { fieldLabel } from "./vocabulary.js";
import type { ContributionContext } from "./sdk.js";

export const catalogElementTag = "dnd-homebrew-catalog";

type StoredDraft =
  | Stored<ItemSet>
  | Stored<Item>
  | Stored<Subclass>
  | Stored<Feat>
  | Stored<Spell>
  | Stored<Species>
  | Stored<Background>;

type Selection =
  | { readonly kind: "set"; readonly id: string }
  | { readonly kind: "item"; readonly id: string }
  | { readonly kind: "new-set" }
  /** `template` prefills the editor, as Duplicate does. */
  | { readonly kind: "new-item"; readonly setId: string; readonly template?: Item }
  | { readonly kind: "subclass"; readonly id: string }
  | { readonly kind: "new-subclass"; readonly template?: Subclass }
  | { readonly kind: "feat"; readonly id: string }
  | { readonly kind: "new-feat"; readonly template?: Feat }
  | { readonly kind: "spell"; readonly id: string }
  | { readonly kind: "new-spell"; readonly template?: Spell }
  | { readonly kind: "species"; readonly id: string }
  | { readonly kind: "new-species"; readonly template?: Species }
  | { readonly kind: "background"; readonly id: string }
  | { readonly kind: "new-background"; readonly template?: Background };

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
    /** Sets whose items the tree hides. */
    readonly #collapsed = new Set<string>();
    #dirty = false;
    #busy = false;
    #message: { text: string; kind: "status" | "alert" } | undefined;
    #editorMessage: { text: string; kind: "status" | "alert" } | undefined;
    /** Pickers' records; undefined until loaded, or when no Compendium answers. */
    #references: References | undefined;
    #mechanics: MechanicsEditor | undefined;
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
      void this.#loadReferences(runtime);
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

    /** Turns typed ids into pickers once the rules data arrives, unless an edit is open. */
    async #loadReferences(runtime: HomebrewRuntime): Promise<void> {
      try {
        const references = await runtime.references.load();
        if (this.#runtime !== runtime) return;
        this.#references = references;
        if (!this.#dirty && !this.#busy) {
          this.#renderEditor();
          this.#controls?.refresh();
        }
      } catch {
        // Without a Compendium the editor keeps typed ids.
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
        element(document, "h1", "", t("Homebrew")),
        element(
          document,
          "p",
          "",
          t(
            "Create items, item sets, subclasses, feats, spells, species and backgrounds, then publish them to use them on character sheets.",
          ),
        ),
      );
      const actions = element(document, "div", "hb-actions");
      actions.dataset["uiActions"] = "";
      const ready = this.#drafts !== undefined && !this.#busy;
      const pending = this.#pendingChanges();
      const others = this.#newMenu(ready);
      const buttons = [
        actionButton(
          document,
          t("New item"),
          () => void this.#select({ kind: "new-item", setId: this.#currentSetId() }),
        ),
        actionButton(document, t("New set"), () => void this.#select({ kind: "new-set" })),
        actionButton(document, t("Import file"), () => this.#fileInput.click()),
        actionButton(document, t("Export"), () => this.#export()),
      ];
      const publish = actionButton(
        document,
        pending > 0 ? t("Publish changes ({count})", { count: pending }) : t("Publish"),
        () => void this.#publish(),
        "primary",
      );
      buttons.push(publish);
      for (const button of buttons) button.disabled = !ready;
      if (pending === 0) publish.disabled = true;
      actions.append(buttons[0]!, buttons[1]!, others, ...buttons.slice(2));
      const top = element(document, "header", "hb-header");
      top.append(title, actions);
      this.#header.replaceChildren(top);
      if (this.#drafts && this.#published) {
        const meta = this.#published.meta;
        const status = [
          meta
            ? t("Published revision {revision}, records: {count}.", {
                revision: meta.value.revision,
                count: meta.value.recordCount,
              })
            : t("Never published."),
          pending > 0
            ? t("Unpublished changes: {count}.", { count: pending })
            : meta
              ? t("Everything is published.")
              : "",
        ]
          .filter((part) => part !== "")
          .join(" ");
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
    /**
     * "New…" opens the kinds besides items and sets, so the header stays one
     * row as kinds are added. It closes on a choice, Escape or leaving it.
     */
    #newMenu(ready: boolean): HTMLElement {
      const t = this.#t;
      const root = element(document, "div", "hb-new");
      const panel = element(document, "div", "hb-new-panel");
      panel.id = `hb-new-${crypto.randomUUID()}`;
      panel.hidden = true;
      const toggle = actionButton(document, t("New…"), () =>
        show(toggle.getAttribute("aria-expanded") !== "true"),
      );
      toggle.disabled = !ready;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", panel.id);
      const show = (open: boolean): void => {
        panel.hidden = !open;
        toggle.setAttribute("aria-expanded", String(open));
        if (open) panel.querySelector<HTMLButtonElement>("button")?.focus();
      };
      const kinds: readonly (readonly [string, Selection])[] = [
        ["Subclass", { kind: "new-subclass" }],
        ["Feat", { kind: "new-feat" }],
        ["Spell", { kind: "new-spell" }],
        ["Species", { kind: "new-species" }],
        ["Background", { kind: "new-background" }],
      ];
      for (const [label, selection] of kinds)
        panel.append(
          actionButton(document, t(label), () => {
            show(false);
            void this.#select(selection);
          }),
        );
      root.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") return;
        event.stopPropagation();
        show(false);
        toggle.focus();
      });
      root.addEventListener("focusout", (event) => {
        if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget))
          show(false);
      });
      root.append(toggle, panel);
      return root;
    }
    #renderTree(): void {
      const t = this.#t;
      this.#tree.setAttribute("aria-label", t("Homebrew"));
      const search = element(document, "input");
      search.type = "search";
      search.dataset["ui"] = "search";
      search.dataset["uiKey"] = "tree-search";
      search.placeholder = t("Search homebrew");
      search.setAttribute("aria-label", t("Search homebrew"));
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
      const sets = [...this.#drafts.sets].sort((a, b) =>
        compare(fold(a.value.name), fold(b.value.name)),
      );
      const items = [...this.#drafts.items].sort((a, b) =>
        compare(fold(a.value.name), fold(b.value.name)),
      );
      const subclasses = [...this.#drafts.subclasses].sort((a, b) =>
        compare(fold(a.value.name), fold(b.value.name)),
      );
      const matches = (item: Item, itemSet?: ItemSet): boolean =>
        !query ||
        fold(item.name).includes(query) ||
        (itemSet !== undefined && fold(itemSet.name).includes(query));
      const feats = [...this.#drafts.feats].sort((a, b) =>
        compare(fold(a.value.name), fold(b.value.name)),
      );
      const spells = [...this.#drafts.spells].sort((a, b) =>
        compare(fold(a.value.name), fold(b.value.name)),
      );
      const species = [...this.#drafts.species].sort((a, b) =>
        compare(fold(a.value.name), fold(b.value.name)),
      );
      const backgrounds = [...this.#drafts.backgrounds].sort((a, b) =>
        compare(fold(a.value.name), fold(b.value.name)),
      );
      if (
        sets.length === 0 &&
        items.length === 0 &&
        subclasses.length === 0 &&
        feats.length === 0 &&
        spells.length === 0 &&
        species.length === 0 &&
        backgrounds.length === 0
      ) {
        groups.append(
          element(
            document,
            "p",
            "hb-hint",
            t(
              "Nothing yet. Create an item, a set, a subclass, a feat, a spell, a species or a background, or import a file to begin.",
            ),
          ),
        );
        return;
      }
      const group = (
        label: string,
        itemSet: ItemSet | undefined,
        members: readonly Stored<Item>[],
      ): void => {
        const visible = members.filter((entry) => matches(entry.value, itemSet));
        if (query && visible.length === 0 && !(itemSet && fold(itemSet.name).includes(query)))
          return;
        const section = element(document, "section", "hb-group");
        if (itemSet) {
          const head = this.#treeButton(label, { kind: "set", id: itemSet.id });
          head.classList.add("hb-group-head");
          head.append(badge(document, t("Items: {count}", { count: members.length }), "muted"));
          if (!itemSet.playerVisible) head.append(badge(document, t("Hidden"), "muted"));
          // A search shows every match, collapsed or not.
          const collapsed = !query && this.#collapsed.has(itemSet.id);
          const toggle = element(document, "button", "hb-tree-toggle", collapsed ? "▸" : "▾");
          toggle.type = "button";
          toggle.setAttribute("aria-expanded", String(!collapsed));
          toggle.setAttribute(
            "aria-label",
            collapsed
              ? t("Show the items of {name}", { name: label })
              : t("Hide the items of {name}", { name: label }),
          );
          toggle.addEventListener("click", () => {
            if (!this.#collapsed.delete(itemSet.id)) this.#collapsed.add(itemSet.id);
            this.#renderTreeGroups();
            this.#tree.querySelector<HTMLElement>(`[data-set-toggle="${itemSet.id}"]`)?.focus();
          });
          toggle.dataset["setToggle"] = itemSet.id;
          const row = element(document, "div", "hb-group-row");
          row.append(toggle, head);
          section.append(row);
          if (collapsed) {
            groups.append(section);
            return;
          }
        } else section.append(element(document, "h2", "hb-group-head", label));
        const list = element(document, "ul");
        for (const entry of visible) {
          const button = this.#treeButton(entry.value.name, { kind: "item", id: entry.value.id });
          for (const [text, tone] of this.#itemBadges(entry.value, itemSet))
            button.append(badge(document, t(text), tone));
          const row = element(document, "li");
          row.append(button);
          list.append(row);
        }
        section.append(list);
        groups.append(section);
      };
      for (const entry of sets)
        group(
          entry.value.name,
          entry.value,
          items.filter((item) => item.value.setId === entry.value.id),
        );
      const loose = items.filter(
        (item) =>
          item.value.setId === "" || !sets.some((entry) => entry.value.id === item.value.setId),
      );
      if (loose.length > 0) group(t("Items without a set"), undefined, loose);
      // Subclasses, feats, spells, species and backgrounds: each draft with a detail badge and its publish state.
      const kind = <T extends { readonly id: string; readonly name: string }>(
        label: string,
        drafts: readonly Stored<T>[],
        selection: (id: string) => Selection,
        detail: (draft: T) => string,
        state: (draft: T) => "Unpublished" | "Changed" | undefined,
      ): void => {
        const shown = drafts.filter(
          (entry) =>
            !query ||
            fold(entry.value.name).includes(query) ||
            fold(detail(entry.value)).includes(query),
        );
        if (shown.length === 0) return;
        const section = element(document, "section", "hb-group");
        section.append(element(document, "h2", "hb-group-head", label));
        const list = element(document, "ul");
        for (const entry of shown) {
          const button = this.#treeButton(entry.value.name, selection(entry.value.id));
          button.append(badge(document, detail(entry.value), "muted"));
          const pending = state(entry.value);
          if (pending) button.append(badge(document, t(pending), "warn"));
          const row = element(document, "li");
          row.append(button);
          list.append(row);
        }
        section.append(list);
        groups.append(section);
      };
      const stateOf = (
        published: Stored<{ readonly withdrawn: boolean }> | undefined,
        flattened: () => unknown,
      ): "Unpublished" | "Changed" | undefined =>
        !published || published.value.withdrawn
          ? "Unpublished"
          : canonical(published.value) !== canonical(flattened())
            ? "Changed"
            : undefined;
      kind(
        t("Subclasses"),
        subclasses,
        (id) => ({ kind: "subclass", id }),
        (subclass) => this.#className(subclass.classId),
        (subclass) =>
          stateOf(this.#published?.subclasses.get(`hb.${subclass.id}`), () =>
            flattenSubclass(subclass),
          ),
      );
      kind(
        t("Feats"),
        feats,
        (id) => ({ kind: "feat", id }),
        (feat) => t(featCategoryLabels[feat.category]),
        (feat) => stateOf(this.#published?.feats.get(`hb.${feat.id}`), () => flattenFeat(feat)),
      );
      kind(
        t("Spells"),
        spells,
        (id) => ({ kind: "spell", id }),
        (spell) => spellLevelLabel(t, spell.level),
        (spell) =>
          stateOf(this.#published?.spells.get(`hb.${spell.id}`), () => flattenSpell(spell)),
      );
      kind(
        t("Species"),
        species,
        (id) => ({ kind: "species", id }),
        (entry) => t(entry.creatureType),
        (entry) =>
          stateOf(this.#published?.species.get(`hb.${entry.id}`), () => flattenSpecies(entry)),
      );
      kind(
        t("Backgrounds"),
        backgrounds,
        (id) => ({ kind: "background", id }),
        (entry) => (entry.originFeat ? this.#featName(entry.originFeat) : t("No origin feat")),
        (entry) =>
          stateOf(this.#published?.backgrounds.get(`hb.${entry.id}`), () =>
            flattenBackground(entry),
          ),
      );
    }
    /**
     * The rules data grants pick from, with this campaign's spells added:
     * grants and item spells name them by `hb.<id>`.
     */
    #grantReferences(): References | undefined {
      const references = this.#references;
      if (!references || !this.#drafts) return references;
      const byName = (left: { readonly name: string }, right: { readonly name: string }) =>
        left.name.localeCompare(right.name);
      const spells = this.#drafts.spells.flatMap(
          (entry) => optionOf("spell", flattenSpell(entry.value).record) ?? [],
        ),
        feats = this.#drafts.feats.map((entry): FeatOption => ({
          id: `hb.${entry.value.id}`,
          name: entry.value.name,
          detail: entry.value.category,
          category: entry.value.category,
        }));
      return {
        ...references,
        spells: [...references.spells, ...spells].sort(byName),
        feats: [...references.feats, ...feats].sort(byName),
      };
    }
    /** A feat's name from the rules data or this campaign, or its id in words. */
    #featName(featId: string): string {
      return (
        this.#grantReferences()?.feats.find((feat) => feat.id === featId)?.name ??
        titleOf(featId.replace(/^hb\./u, ""))
      );
    }
    /** A class's name from the rules data, or its id in words. */
    #className(classId: string): string {
      return (
        this.#references?.classes.find((entry) => entry.id === classId)?.name ??
        (classId ? titleOf(classId) : this.#t("No class"))
      );
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
      itemSet: ItemSet | undefined,
    ): [string, "" | "muted" | "warn" | "accent"][] {
      // Only what needs attention or differs from a usual item gets a badge.
      const badges: [string, "" | "muted" | "warn" | "accent"][] =
        item.characterMechanics === "complete" ? [] : [["Text only", "muted"]];
      if (!(item.playerVisible && (itemSet?.playerVisible ?? true)))
        badges.push(["Hidden", "muted"]);
      if (item.retired) badges.push(["Retired", "warn"]);
      const published = this.#published?.records.get(`hb.${item.id}`);
      if (!published || published.value.withdrawn) badges.push(["Unpublished", "warn"]);
      else if (canonical(published.value) !== canonical(flatten(itemSet, item)))
        badges.push(["Changed", "warn"]);
      return badges;
    }
    #pendingChanges(): number {
      if (!this.#drafts || !this.#published) return 0;
      const plan = planPublish(
        this.#drafts.sets.map((entry) => entry.value),
        this.#drafts.items.map((entry) => entry.value),
        this.#published.records,
        this.#published.meta,
        0,
        this.#drafts.subclasses.map((entry) => entry.value),
        this.#published.subclasses,
        this.#drafts.feats.map((entry) => entry.value),
        this.#published.feats,
        this.#drafts.spells.map((entry) => entry.value),
        this.#published.spells,
        this.#drafts.species.map((entry) => entry.value),
        this.#published.species,
        this.#drafts.backgrounds.map((entry) => entry.value),
        this.#published.backgrounds,
      );
      // A published draft with a problem would also be withdrawn; count it once.
      return new Set([
        ...plan.changes.map((change) => change.id),
        ...plan.problems.map((entry) => `hb.${entry.itemId}`),
      ]).size;
    }

    #selected(): StoredDraft | undefined {
      const selection = this.#selection;
      if (!selection || !this.#drafts) return undefined;
      if (selection.kind === "set")
        return this.#drafts.sets.find((entry) => entry.value.id === selection.id);
      if (selection.kind === "item")
        return this.#drafts.items.find((entry) => entry.value.id === selection.id);
      if (selection.kind === "subclass")
        return this.#drafts.subclasses.find((entry) => entry.value.id === selection.id);
      if (selection.kind === "feat")
        return this.#drafts.feats.find((entry) => entry.value.id === selection.id);
      if (selection.kind === "spell")
        return this.#drafts.spells.find((entry) => entry.value.id === selection.id);
      if (selection.kind === "species")
        return this.#drafts.species.find((entry) => entry.value.id === selection.id);
      if (selection.kind === "background")
        return this.#drafts.backgrounds.find((entry) => entry.value.id === selection.id);
      return undefined;
    }
    #currentSetId(): string {
      const selection = this.#selection;
      if (selection?.kind === "set") return selection.id;
      if (selection?.kind === "item")
        return (
          this.#drafts?.items.find((entry) => entry.value.id === selection.id)?.value.setId ?? ""
        );
      if (selection?.kind === "new-item") return selection.setId;
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
      // A report of the last action ends when the DM moves on; problems stay.
      if (this.#message?.kind === "status") {
        this.#message = undefined;
        this.#renderHeader();
      }
      if (selection.kind === "item") {
        const setId = this.#drafts?.items.find((entry) => entry.value.id === selection.id)?.value
          .setId;
        if (setId) this.#collapsed.delete(setId);
      }
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
      this.#mechanics = undefined;
      const selection = this.#selection;
      if (!selection || !this.#drafts) {
        // The header holds the buttons; this explains what each kind is for.
        const start = element(document, "div", "hb-start");
        const kinds = element(document, "dl", "hb-kinds");
        for (const [name, about] of [
          [
            "Item",
            "A magic item, such as a +1 weapon, a ring of resistance or a wand with a spell. Start from a common kind and change what you need.",
          ],
          [
            "Set",
            "Items that share their type, rarity, attunement, description or curse, such as a deck of cards.",
          ],
          ["Subclass", "A class's subclass, with its features by level."],
          ["Feat", "An origin feat, a general feat, a fighting style or an epic boon."],
          ["Spell", "A spell with its stat block, on the spell lists of the classes you choose."],
          [
            "Species",
            "A species for character creation, with its size, speeds and traits, and lineages to choose from.",
          ],
          [
            "Background",
            "A background for character creation: the abilities it raises, its origin feat, skills, tools and equipment.",
          ],
        ] as const)
          kinds.append(element(document, "dt", "", t(name)), element(document, "dd", "", t(about)));
        start.append(
          element(
            document,
            "p",
            "hb-hint",
            t(
              "Choose something on the left to edit it, or start something new with the buttons above.",
            ),
          ),
          kinds,
        );
        this.#editor.replaceChildren(start);
        return;
      }
      if (selection.kind === "background" || selection.kind === "new-background") {
        const stored =
          selection.kind === "background"
            ? this.#drafts.backgrounds.find((entry) => entry.value.id === selection.id)
            : undefined;
        this.#editor.replaceChildren(
          this.#backgroundForm(
            stored,
            selection.kind === "new-background" ? selection.template : undefined,
          ),
        );
      } else if (selection.kind === "species" || selection.kind === "new-species") {
        const stored =
          selection.kind === "species"
            ? this.#drafts.species.find((entry) => entry.value.id === selection.id)
            : undefined;
        this.#editor.replaceChildren(
          this.#speciesForm(
            stored,
            selection.kind === "new-species" ? selection.template : undefined,
          ),
        );
      } else if (selection.kind === "spell" || selection.kind === "new-spell") {
        const stored =
          selection.kind === "spell"
            ? this.#drafts.spells.find((entry) => entry.value.id === selection.id)
            : undefined;
        this.#editor.replaceChildren(
          this.#spellForm(stored, selection.kind === "new-spell" ? selection.template : undefined),
        );
      } else if (selection.kind === "feat" || selection.kind === "new-feat") {
        const stored =
          selection.kind === "feat"
            ? this.#drafts.feats.find((entry) => entry.value.id === selection.id)
            : undefined;
        this.#editor.replaceChildren(
          this.#featForm(stored, selection.kind === "new-feat" ? selection.template : undefined),
        );
      } else if (selection.kind === "subclass" || selection.kind === "new-subclass") {
        const stored =
          selection.kind === "subclass"
            ? this.#drafts.subclasses.find((entry) => entry.value.id === selection.id)
            : undefined;
        this.#editor.replaceChildren(
          this.#subclassForm(
            stored,
            selection.kind === "new-subclass" ? selection.template : undefined,
          ),
        );
      } else if (selection.kind === "set" || selection.kind === "new-set") {
        const stored =
          selection.kind === "set"
            ? this.#drafts.sets.find((entry) => entry.value.id === selection.id)
            : undefined;
        this.#editor.replaceChildren(this.#setForm(stored));
      } else {
        const stored =
          selection.kind === "item"
            ? this.#drafts.items.find((entry) => entry.value.id === selection.id)
            : undefined;
        this.#editor.replaceChildren(
          selection.kind === "new-item"
            ? this.#itemForm(undefined, selection.setId, selection.template)
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
    #setIds(): ReadonlySet<string> {
      return new Set(this.#drafts?.sets.map((entry) => entry.value.id) ?? []);
    }
    /** Item ids in use, including published records whose draft was deleted. */
    #itemIds(): ReadonlySet<string> {
      return new Set([
        ...(this.#drafts?.items.map((entry) => entry.value.id) ?? []),
        ...[...(this.#published?.records.values() ?? [])].map((entry) => entry.value.itemId),
      ]);
    }
    /** Spell ids in use, including published spells whose draft was deleted. */
    #spellIds(): ReadonlySet<string> {
      return new Set([
        ...(this.#drafts?.spells.map((entry) => entry.value.id) ?? []),
        ...[...(this.#published?.spells.values() ?? [])].map((entry) => entry.value.spellId),
      ]);
    }
    /** Background ids in use, including published backgrounds whose draft was deleted. */
    #backgroundIds(): ReadonlySet<string> {
      return new Set([
        ...(this.#drafts?.backgrounds.map((entry) => entry.value.id) ?? []),
        ...[...(this.#published?.backgrounds.values() ?? [])].map(
          (entry) => entry.value.backgroundId,
        ),
      ]);
    }
    /** Species ids in use, including published species whose draft was deleted. */
    #speciesIds(): ReadonlySet<string> {
      return new Set([
        ...(this.#drafts?.species.map((entry) => entry.value.id) ?? []),
        ...[...(this.#published?.species.values() ?? [])].map((entry) => entry.value.speciesId),
      ]);
    }
    /** Feat ids in use, including published feats whose draft was deleted. */
    #featIds(): ReadonlySet<string> {
      return new Set([
        ...(this.#drafts?.feats.map((entry) => entry.value.id) ?? []),
        ...[...(this.#published?.feats.values() ?? [])].map((entry) => entry.value.featId),
      ]);
    }
    /** Subclass ids in use, including published subclasses whose draft was deleted. */
    #subclassIds(): ReadonlySet<string> {
      return new Set([
        ...(this.#drafts?.subclasses.map((entry) => entry.value.id) ?? []),
        ...[...(this.#published?.subclasses.values() ?? [])].map((entry) => entry.value.subclassId),
      ]);
    }
    /**
     * A draft form: its fields go into `main`, and an editor with a preview
     * appends it after `main`. Ctrl+S (Cmd+S) saves.
     */
    #form(title: string): { form: HTMLFormElement; main: HTMLElement } {
      const form = element(document, "form", "hb-form");
      form.noValidate = true;
      const main = element(document, "div", "hb-form-main");
      main.append(element(document, "h2", "", title));
      form.append(main);
      // A form replaced after saving can still report a field's last change.
      const edited = (): void => {
        if (form.isConnected) this.#setDirty(true);
      };
      form.addEventListener("input", edited);
      form.addEventListener("change", edited);
      form.addEventListener("keydown", (event) => {
        if (event.key.toLowerCase() !== "s" || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        // Leaving the field first reports its change before the save, not after.
        if (event.target instanceof HTMLElement) event.target.blur();
        form.querySelector<HTMLButtonElement>('.hb-editor-actions button[type="submit"]')?.click();
      });
      if (this.#editorMessage)
        main.append(messageBlock(document, this.#editorMessage.text, this.#editorMessage.kind));
      return { form, main };
    }
    #setForm(stored: Stored<ItemSet> | undefined): HTMLFormElement {
      const t = this.#t;
      const value = stored?.value ?? newSet("", "", Date.now());
      const { form, main } = this.#form(stored ? value.name : t("New set"));
      const row = (...fields: HTMLElement[]): HTMLElement => {
        const node = element(document, "div", "hb-row");
        node.append(...fields);
        return node;
      };
      main.append(
        element(
          document,
          "p",
          "hb-hint",
          t("A set holds what its items share. Each item can still change any of these values."),
        ),
        row(
          textField(document, t("Name"), "name", value.name, { maxLength: 120 }),
          textField(document, t("Name prefix"), "namePrefix", value.namePrefix, {
            maxLength: 60,
            hint: t("Shown before each item's name, for example Elemental Ring: Fire."),
          }),
        ),
        row(
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
        ),
        row(
          checkField(document, t("Requires attunement"), "attunement", value.attunement),
          numberField(document, t("Weight (lb)"), "weightLb", value.weightLb, {
            min: 0,
            max: maxWeight,
            step: "any",
            hint: t("Each item's weight, for carrying. Leave it empty when unknown."),
          }),
        ),
        chipsField(
          document,
          t("Body placements"),
          "bodyPlacements",
          value.bodyPlacements,
          bodyPlacements.map((placement) => [placement, t(placement)] as const),
        ),
        textArea(
          document,
          t("Shared description"),
          "description",
          value.description,
          4,
          maxMarkdown,
          t("Added to every item in the set."),
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
            "Every item of the set gives this condition. Its level on the sheet is the number of the set's items in effect. Leave the name empty for none.",
          ),
        ),
        row(
          textField(document, t("Condition name"), "conditionName", value.condition?.name ?? "", {
            maxLength: 120,
            placeholder: "Elemental Attunement",
          }),
          textField(document, t("Condition id"), "conditionId", value.condition?.id ?? "", {
            maxLength: 64,
            placeholder: "elemental-attunement",
            hint: t("Filled from the name when empty."),
          }),
        ),
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
      const more = element(document, "details", "hb-defaults");
      more.append(
        element(document, "summary", "", t("Id and tags")),
        this.#idField(stored !== undefined, value.id, "elemental-rings"),
        textField(document, t("Tags"), "tags", value.tags.join(", "), {
          hint: t("Lowercase words joined by hyphens, separated by commas."),
        }),
      );
      main.append(
        condition,
        checkField(
          document,
          t("Visible to players"),
          "playerVisible",
          value.playerVisible,
          t("Lists the set in the player gallery. Each item also needs its own switch."),
        ),
      );
      if (stored) main.append(this.#setMembers(stored));
      main.append(more);
      this.#previewId(form, () => this.#setIds());
      const actions = element(document, "div", "hb-editor-actions");
      actions.dataset["uiActions"] = "";
      const save = actionButton(
        document,
        t("Save"),
        () => void this.#saveSet(form, stored),
        "primary",
      );
      save.type = "submit";
      actions.append(save);
      if (stored)
        actions.append(
          actionButton(document, t("Delete"), () => void this.#deleteSet(stored), "danger"),
        );
      main.append(actions);
      form.addEventListener("submit", (event) => event.preventDefault());
      return form;
    }
    /** The set's items as links, with the actions that change all of them. */
    #setMembers(stored: Stored<ItemSet>): HTMLElement {
      const t = this.#t;
      const members = this.#members(stored.value.id);
      const section = element(document, "section", "hb-set-items");
      section.append(
        element(document, "h3", "", t("Items in this set ({count})", { count: members.length })),
      );
      if (members.length === 0)
        section.append(element(document, "p", "hb-hint", t("No items yet.")));
      else {
        const list = element(document, "ul");
        for (const entry of members) {
          const button = this.#treeButton(entry.value.name, { kind: "item", id: entry.value.id });
          // "Open" keeps the link's name apart from the tree's button for the item.
          button.setAttribute("aria-label", t("Open {name}", { name: entry.value.name }));
          if (!entry.value.playerVisible) button.append(badge(document, t("Hidden"), "muted"));
          const item = element(document, "li");
          item.append(button);
          list.append(item);
        }
        section.append(list);
      }
      const actions = element(document, "div", "hb-row-actions");
      actions.dataset["uiActions"] = "";
      actions.append(
        actionButton(
          document,
          t("Add item to this set"),
          () => void this.#select({ kind: "new-item", setId: stored.value.id }),
        ),
      );
      const hidden = members.filter((entry) => !entry.value.playerVisible).length;
      if (hidden > 0)
        actions.append(
          actionButton(
            document,
            t("Show all its items to players"),
            () => void this.#showMembers(members, true),
          ),
        );
      if (hidden < members.length)
        actions.append(
          actionButton(
            document,
            t("Hide all its items from players"),
            () => void this.#showMembers(members, false),
          ),
        );
      section.append(actions);
      return section;
    }
    #members(setId: string): Stored<Item>[] {
      return (this.#drafts?.items ?? [])
        .filter((entry) => entry.value.setId === setId)
        .sort((a, b) => compare(fold(a.value.name), fold(b.value.name)));
    }
    async #showMembers(members: readonly Stored<Item>[], visible: boolean): Promise<void> {
      const t = this.#t;
      await this.#commitDrafts(
        draftPuts(
          collections.items,
          members,
          (item) => ({ ...item, playerVisible: visible }),
          Date.now(),
        ),
        visible ? t("Its items are visible to players.") : t("Its items are hidden from players."),
      );
    }
    #readSet(form: HTMLFormElement, stored: Stored<ItemSet> | undefined): ItemSet {
      const data = new FormData(form);
      const name = formText(data, "name").trim();
      const taken = this.#setIds();
      const weight = formNumber(data, "weightLb");
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
        ...(weight === undefined ? {} : { weightLb: weight }),
      };
    }
    async #saveSet(form: HTMLFormElement, stored: Stored<ItemSet> | undefined): Promise<void> {
      const value = this.#readSet(form, stored);
      const named = !stored && formText(new FormData(form), "id").trim() === "";
      if (!stored && this.#setIds().has(value.id))
        return this.#editorProblem({ text: "This id is already in use. Choose another id." });
      const failure = setProblem(value);
      if (failure) return this.#editorProblem(failure);
      await this.#save(
        collections.sets,
        value,
        stored,
        (saved) => ({ kind: "set", id: saved.id }),
        named
          ? (failed) => ({
              ...value,
              id: freeId(value.name, new Set([...this.#setIds(), ...failed])),
            })
          : undefined,
      );
    }
    #itemForm(
      stored: Stored<Item> | undefined,
      setId: string | undefined,
      template?: Item,
    ): HTMLFormElement {
      const t = this.#t;
      const value = stored?.value ?? template ?? newItem("", "", setId ?? "", Date.now());
      const { form, main } = this.#form(stored ? value.name : t("New item"));
      const sets = [...(this.#drafts?.sets ?? [])]
        .sort((a, b) => compare(fold(a.value.name), fold(b.value.name)))
        .map((entry) => entry.value);
      const editor = itemEditor(
        {
          document,
          t,
          references: this.#grantReferences(),
          sets,
          takenIds: () => this.#itemIds(),
          changed: () => this.#setDirty(true),
          restructured: () => this.#controls?.refresh(),
          ...(stored ? {} : { restart: (item: Item) => this.#restart(item) }),
        },
        form,
        main,
        value,
        stored !== undefined,
      );
      const actions = element(document, "div", "hb-editor-actions");
      actions.dataset["uiActions"] = "";
      const save = actionButton(
        document,
        t("Save"),
        () => void this.#saveItem(editor, stored, false),
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
                setId: stored.value.setId,
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
            () => void this.#saveItem(editor, stored, true),
          ),
        );
      main.append(actions);
      form.addEventListener("submit", (event) => event.preventDefault());
      return form;
    }
    /** Opens the new item again as `item`, keeping the changes it carries. */
    #restart(item: Item): void {
      this.#selection = { kind: "new-item", setId: item.setId, template: item };
      this.#renderEditor();
      this.#controls?.refresh();
      this.#setDirty(true);
      this.#editor
        .querySelector<HTMLInputElement>('input[name="name"]')
        ?.focus({ preventScroll: true });
    }
    async #saveItem(
      editor: ItemEditor,
      stored: Stored<Item> | undefined,
      another: boolean,
    ): Promise<void> {
      const value = editor.read();
      const named =
        !stored && formText(new FormData(this.#editor.querySelector("form")!), "id").trim() === "";
      if (!stored && this.#itemIds().has(value.id))
        return this.#editorProblem({ text: "This id is already in use. Choose another id." });
      const failure = itemProblem(value);
      if (failure) return this.#editorProblem(failure);
      await this.#save(
        collections.items,
        value,
        stored,
        (saved) =>
          another ? { kind: "new-item", setId: saved.setId } : { kind: "item", id: saved.id },
        named
          ? (failed) => ({
              ...value,
              id: freeId(value.name, new Set([...this.#itemIds(), ...failed])),
            })
          : undefined,
      );
    }
    #subclassForm(stored: Stored<Subclass> | undefined, template?: Subclass): HTMLFormElement {
      const t = this.#t;
      const value = stored?.value ?? template ?? newSubclass("", "", "", Date.now());
      const { form, main } = this.#form(stored ? value.name : t("New subclass"));
      const classes = this.#references?.classes;
      const classField = classes
        ? selectField(document, t("Class"), "classId", value.classId, [
            ["", t("Choose a class")],
            ...classes.map((entry) => [entry.id, entry.name] as const),
            ...(value.classId && !classes.some((entry) => entry.id === value.classId)
              ? [[value.classId, titleOf(value.classId)] as const]
              : []),
          ])
        : textField(document, t("Class"), "classId", value.classId, {
            maxLength: 64,
            placeholder: "fighter",
            hint: t(
              "The class id, such as fighter. With the Compendium installed, pick it by name.",
            ),
          });
      main.append(
        textField(document, t("Name"), "name", value.name, { maxLength: 120 }),
        this.#idField(stored !== undefined, value.id, "path-of-the-storm-drum"),
        classField,
        numberField(document, t("Subclass level"), "subclassLevel", value.subclassLevel, {
          min: 1,
          max: 20,
          hint: t("The class level a character chooses the subclass at, usually 3."),
        }),
        textField(document, t("Summary"), "excerpt", value.excerpt, {
          maxLength: 300,
          hint: t("An optional one-line summary."),
        }),
        textArea(
          document,
          t("Description"),
          "text",
          value.text,
          6,
          maxMarkdown,
          t("The subclass as players read it."),
        ),
      );
      this.#mechanics = mechanicsEditor(
        {
          document,
          t,
          references: this.#grantReferences(),
          subclassLevel: () => formNumber(new FormData(form), "subclassLevel") ?? 3,
          changed: () => {
            this.#setDirty(true);
            this.#updateSubclassPreview(form, stored);
          },
          restructured: () => this.#controls?.refresh(),
        },
        value,
        new Set(stored?.value.features.map((feature) => feature.id) ?? []),
      );
      main.append(this.#mechanics.root);
      const preview = element(document, "aside", "hb-preview");
      preview.setAttribute("aria-live", "polite");
      form.append(preview);
      this.#previewId(form, () => this.#subclassIds());
      const actions = element(document, "div", "hb-editor-actions");
      actions.dataset["uiActions"] = "";
      const save = actionButton(
        document,
        t("Save"),
        () => void this.#saveSubclass(form, stored),
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
                kind: "new-subclass",
                template: {
                  ...stored.value,
                  id: "",
                  name: t("{name} (copy)", { name: stored.value.name }),
                },
              }),
          ),
          actionButton(document, t("Delete"), () => void this.#deleteSubclass(stored), "danger"),
        );
      main.append(actions);
      form.addEventListener("submit", (event) => event.preventDefault());
      form.addEventListener("input", () => this.#updateSubclassPreview(form, stored));
      form.addEventListener("change", () => this.#updateSubclassPreview(form, stored));
      this.#updateSubclassPreview(form, stored);
      return form;
    }
    #readSubclass(form: HTMLFormElement, stored: Stored<Subclass> | undefined): Subclass {
      const data = new FormData(form);
      const name = formText(data, "name").trim();
      const mechanics = this.#mechanics?.read() ?? {
        spells: [],
        classResources: [],
        tableColumns: [],
        features: [],
      };
      return {
        id: stored?.value.id ?? (formText(data, "id").trim() || freeId(name, this.#subclassIds())),
        schemaVersion: 1,
        name,
        classId: formText(data, "classId").trim(),
        subclassLevel: formNumber(data, "subclassLevel") ?? 0,
        text: formText(data, "text"),
        excerpt: formText(data, "excerpt").trim(),
        ...mechanics,
        updatedAt: Date.now(),
      };
    }
    #updateSubclassPreview(form: HTMLFormElement, stored: Stored<Subclass> | undefined): void {
      const t = this.#t;
      const preview = form.querySelector(".hb-preview");
      if (!preview) return;
      const subclass = this.#readSubclass(form, stored);
      const failure = subclassProblem({
        ...subclass,
        id: subclass.id || "subclass",
        name: subclass.name || "subclass",
      });
      preview.replaceChildren(
        element(document, "h3", "", t("As published")),
        element(document, "p", "hb-preview-name", subclass.name || t("New subclass")),
        element(
          document,
          "p",
          "hb-hint",
          t("{class} subclass from level {level}; records: {count}.", {
            class: this.#className(subclass.classId),
            level: subclass.subclassLevel,
            count: subclass.features.length + 1,
          }),
        ),
      );
      if (failure) preview.append(messageBlock(document, problemText(t, failure), "alert"));
      const features = [...subclass.features].sort((left, right) => left.level - right.level);
      if (features.length > 0) {
        const list = element(document, "ul", "hb-effect-summary");
        for (const feature of features) {
          const granted = Object.keys(feature.grants ?? {})
            .map((field) => t(fieldLabel("Grants", field)))
            .join(", ");
          list.append(
            element(
              document,
              "li",
              "",
              granted
                ? t("Level {level}: {name} ({grants})", {
                    level: feature.level,
                    name: feature.name,
                    grants: granted,
                  })
                : t("Level {level}: {name}", { level: feature.level, name: feature.name }),
            ),
          );
        }
        preview.append(list);
      }
    }
    async #saveSubclass(
      form: HTMLFormElement,
      stored: Stored<Subclass> | undefined,
    ): Promise<void> {
      const value = this.#readSubclass(form, stored);
      const named = !stored && formText(new FormData(form), "id").trim() === "";
      if (!stored && this.#subclassIds().has(value.id))
        return this.#editorProblem({ text: "This id is already in use. Choose another id." });
      const failure = subclassProblem(value);
      if (failure) {
        this.#editorProblem(failure);
        // A problem names its field by path, as the form's controls are named.
        const at = failure.params?.["path"];
        if (typeof at === "string")
          (
            form.querySelector<HTMLElement>(`[name="${CSS.escape(at)}"]`) ??
            form.querySelector<HTMLElement>(`[name^="${CSS.escape(at)}"]`)
          )?.focus();
        return;
      }
      await this.#save(
        collections.subclasses,
        value,
        stored,
        (saved) => ({ kind: "subclass", id: saved.id }),
        named
          ? (failed) => ({
              ...value,
              id: freeId(value.name, new Set([...this.#subclassIds(), ...failed])),
            })
          : undefined,
      );
    }
    #featForm(stored: Stored<Feat> | undefined, template?: Feat): HTMLFormElement {
      const t = this.#t;
      const value = stored?.value ?? template ?? newFeat("", "", Date.now());
      const { form, main } = this.#form(stored ? value.name : t("New feat"));
      const editor = featEditor(
        {
          document,
          t,
          references: this.#grantReferences(),
          takenIds: () => this.#featIds(),
          changed: () => this.#setDirty(true),
          restructured: () => this.#controls?.refresh(),
          ...(stored ? {} : { restart: (feat: Feat) => this.#restartFeat(feat) }),
        },
        form,
        main,
        value,
        stored !== undefined,
      );
      const actions = element(document, "div", "hb-editor-actions");
      actions.dataset["uiActions"] = "";
      const save = actionButton(
        document,
        t("Save"),
        () => void this.#saveFeat(editor, stored),
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
                kind: "new-feat",
                template: {
                  ...stored.value,
                  id: "",
                  name: t("{name} (copy)", { name: stored.value.name }),
                },
              }),
          ),
          actionButton(document, t("Delete"), () => void this.#deleteFeat(stored), "danger"),
        );
      main.append(actions);
      form.addEventListener("submit", (event) => event.preventDefault());
      return form;
    }
    /** Opens the new feat again as `feat`, keeping the changes it carries. */
    #restartFeat(feat: Feat): void {
      this.#selection = { kind: "new-feat", template: feat };
      this.#renderEditor();
      this.#controls?.refresh();
      this.#setDirty(true);
      this.#editor
        .querySelector<HTMLInputElement>('input[name="name"]')
        ?.focus({ preventScroll: true });
    }
    async #saveFeat(editor: FeatEditor, stored: Stored<Feat> | undefined): Promise<void> {
      const value = editor.read();
      const named =
        !stored && formText(new FormData(this.#editor.querySelector("form")!), "id").trim() === "";
      if (!stored && this.#featIds().has(value.id))
        return this.#editorProblem({ text: "This id is already in use. Choose another id." });
      const failure = featProblem(value);
      if (failure) return this.#editorProblem(failure);
      await this.#save(
        collections.feats,
        value,
        stored,
        (saved) => ({ kind: "feat", id: saved.id }),
        named
          ? (failed) => ({
              ...value,
              id: freeId(value.name, new Set([...this.#featIds(), ...failed])),
            })
          : undefined,
      );
    }
    #spellForm(stored: Stored<Spell> | undefined, template?: Spell): HTMLFormElement {
      const t = this.#t;
      const value = stored?.value ?? template ?? newSpell("", "", Date.now());
      const { form, main } = this.#form(stored ? value.name : t("New spell"));
      const editor = spellEditor(
        { document, t, references: this.#references, takenIds: () => this.#spellIds() },
        form,
        main,
        value,
        stored !== undefined,
      );
      const actions = element(document, "div", "hb-editor-actions");
      actions.dataset["uiActions"] = "";
      const save = actionButton(
        document,
        t("Save"),
        () => void this.#saveSpell(editor, stored),
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
                kind: "new-spell",
                template: {
                  ...stored.value,
                  id: "",
                  name: t("{name} (copy)", { name: stored.value.name }),
                },
              }),
          ),
          actionButton(document, t("Delete"), () => void this.#deleteSpell(stored), "danger"),
        );
      main.append(actions);
      form.addEventListener("submit", (event) => event.preventDefault());
      return form;
    }
    async #saveSpell(editor: SpellEditor, stored: Stored<Spell> | undefined): Promise<void> {
      const value = editor.read();
      const named =
        !stored && formText(new FormData(this.#editor.querySelector("form")!), "id").trim() === "";
      if (!stored && this.#spellIds().has(value.id))
        return this.#editorProblem({ text: "This id is already in use. Choose another id." });
      const failure = spellProblem(value);
      if (failure) return this.#editorProblem(failure);
      await this.#save(
        collections.spells,
        value,
        stored,
        (saved) => ({ kind: "spell", id: saved.id }),
        named
          ? (failed) => ({
              ...value,
              id: freeId(value.name, new Set([...this.#spellIds(), ...failed])),
            })
          : undefined,
      );
    }
    #backgroundForm(
      stored: Stored<Background> | undefined,
      template?: Background,
    ): HTMLFormElement {
      const t = this.#t;
      const value = stored?.value ?? template ?? newBackground("", "", Date.now());
      const { form, main } = this.#form(stored ? value.name : t("New background"));
      const editor = backgroundEditor(
        {
          document,
          t,
          references: this.#grantReferences(),
          takenIds: () => this.#backgroundIds(),
          changed: () => this.#setDirty(true),
          restructured: () => this.#controls?.refresh(),
        },
        form,
        main,
        value,
        stored !== undefined,
      );
      const actions = element(document, "div", "hb-editor-actions");
      actions.dataset["uiActions"] = "";
      const save = actionButton(
        document,
        t("Save"),
        () => void this.#saveBackground(editor, stored),
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
                kind: "new-background",
                template: {
                  ...stored.value,
                  id: "",
                  name: t("{name} (copy)", { name: stored.value.name }),
                },
              }),
          ),
          actionButton(document, t("Delete"), () => void this.#deleteBackground(stored), "danger"),
        );
      main.append(actions);
      form.addEventListener("submit", (event) => event.preventDefault());
      return form;
    }
    async #saveBackground(
      editor: BackgroundEditor,
      stored: Stored<Background> | undefined,
    ): Promise<void> {
      const value = editor.read();
      const named =
        !stored && formText(new FormData(this.#editor.querySelector("form")!), "id").trim() === "";
      if (!stored && this.#backgroundIds().has(value.id))
        return this.#editorProblem({ text: "This id is already in use. Choose another id." });
      const failure = backgroundProblem(value);
      if (failure) return this.#editorProblem(failure);
      await this.#save(
        collections.backgrounds,
        value,
        stored,
        (saved) => ({ kind: "background", id: saved.id }),
        named
          ? (failed) => ({
              ...value,
              id: freeId(value.name, new Set([...this.#backgroundIds(), ...failed])),
            })
          : undefined,
      );
    }
    async #deleteBackground(stored: Stored<Background>): Promise<void> {
      const t = this.#t;
      const published = this.#published?.backgrounds.get(`hb.${stored.value.id}`);
      const question =
        published && !published.value.withdrawn
          ? t(
              "Deleting a published background withdraws it at the next publish; characters with it then show a missing-source problem. Delete {name}?",
              { name: stored.value.name },
            )
          : t("Delete {name}?", { name: stored.value.name });
      if (!(await confirmDialog(this, t, question, t("Delete")))) return;
      await this.#remove(collections.backgrounds, stored);
    }
    #speciesForm(stored: Stored<Species> | undefined, template?: Species): HTMLFormElement {
      const t = this.#t;
      const value = stored?.value ?? template ?? newSpecies("", "", Date.now());
      const { form, main } = this.#form(stored ? value.name : t("New species"));
      const editor = speciesEditor(
        {
          document,
          t,
          references: this.#grantReferences(),
          takenIds: () => this.#speciesIds(),
          changed: () => this.#setDirty(true),
          restructured: () => this.#controls?.refresh(),
        },
        form,
        main,
        value,
        stored !== undefined,
      );
      const actions = element(document, "div", "hb-editor-actions");
      actions.dataset["uiActions"] = "";
      const save = actionButton(
        document,
        t("Save"),
        () => void this.#saveSpecies(editor, stored),
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
                kind: "new-species",
                template: {
                  ...stored.value,
                  id: "",
                  name: t("{name} (copy)", { name: stored.value.name }),
                },
              }),
          ),
          actionButton(document, t("Delete"), () => void this.#deleteSpecies(stored), "danger"),
        );
      main.append(actions);
      form.addEventListener("submit", (event) => event.preventDefault());
      return form;
    }
    async #saveSpecies(editor: SpeciesEditor, stored: Stored<Species> | undefined): Promise<void> {
      const value = editor.read();
      const named =
        !stored && formText(new FormData(this.#editor.querySelector("form")!), "id").trim() === "";
      if (!stored && this.#speciesIds().has(value.id))
        return this.#editorProblem({ text: "This id is already in use. Choose another id." });
      const failure = speciesProblem(value);
      if (failure) return this.#editorProblem(failure);
      await this.#save(
        collections.species,
        value,
        stored,
        (saved) => ({ kind: "species", id: saved.id }),
        named
          ? (failed) => ({
              ...value,
              id: freeId(value.name, new Set([...this.#speciesIds(), ...failed])),
            })
          : undefined,
      );
    }
    async #deleteSpecies(stored: Stored<Species>): Promise<void> {
      const t = this.#t;
      const published = this.#published?.species.get(`hb.${stored.value.id}`);
      const question =
        published && !published.value.withdrawn
          ? t(
              "Deleting a published species withdraws it at the next publish; characters of it then show a missing-source problem. Delete {name}?",
              { name: stored.value.name },
            )
          : t("Delete {name}?", { name: stored.value.name });
      if (!(await confirmDialog(this, t, question, t("Delete")))) return;
      await this.#remove(collections.species, stored);
    }
    async #deleteSpell(stored: Stored<Spell>): Promise<void> {
      const t = this.#t;
      const published = this.#published?.spells.get(`hb.${stored.value.id}`);
      const question =
        published && !published.value.withdrawn
          ? t(
              "Deleting a published spell withdraws it at the next publish; characters with it then show a missing-source problem. Delete {name}?",
              { name: stored.value.name },
            )
          : t("Delete {name}?", { name: stored.value.name });
      if (!(await confirmDialog(this, t, question, t("Delete")))) return;
      await this.#remove(collections.spells, stored);
    }
    async #deleteFeat(stored: Stored<Feat>): Promise<void> {
      const t = this.#t;
      const published = this.#published?.feats.get(`hb.${stored.value.id}`);
      const question =
        published && !published.value.withdrawn
          ? t(
              "Deleting a published feat withdraws it at the next publish; characters with it then show a missing-source problem. Delete {name}?",
              { name: stored.value.name },
            )
          : t("Delete {name}?", { name: stored.value.name });
      if (!(await confirmDialog(this, t, question, t("Delete")))) return;
      await this.#remove(collections.feats, stored);
    }
    async #deleteSubclass(stored: Stored<Subclass>): Promise<void> {
      const t = this.#t;
      const published = this.#published?.subclasses.get(`hb.${stored.value.id}`);
      const question =
        published && !published.value.withdrawn
          ? t(
              "Deleting a published subclass withdraws it at the next publish; characters with it then show a missing-source problem. Delete {name}?",
              { name: stored.value.name },
            )
          : t("Delete {name}?", { name: stored.value.name });
      if (!(await confirmDialog(this, t, question, t("Delete")))) return;
      await this.#remove(collections.subclasses, stored);
    }
    /** Shows a problem under the form's title and brings it into view. */
    #editorProblem(problem: Problem): void {
      const main = this.#editor.querySelector(".hb-form-main");
      main?.querySelector(":scope > .hb-message")?.remove();
      const block = messageBlock(document, problemText(this.#t, problem), "alert");
      main?.querySelector("h2")?.after(block);
      block.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    /**
     * Saves one draft and selects what `select` names. A new draft whose id
     * came from its name can still meet a deleted draft's key, which the
     * browser cannot reuse; `rename` then gives the next free id.
     */
    async #save<T extends ItemSet | Item | Subclass | Feat | Spell | Species | Background>(
      collection: DraftCollection,
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
    /**
     * Deletes a set. Its items either go with it or stay without a set,
     * looking as they did; either way in one transaction.
     */
    async #deleteSet(stored: Stored<ItemSet>): Promise<void> {
      const t = this.#t,
        name = stored.value.name;
      const members = this.#members(stored.value.id);
      if (members.length === 0) {
        if (!(await confirmDialog(this, t, t("Delete {name}?", { name }), t("Delete")))) return;
        await this.#remove(collections.sets, stored);
        return;
      }
      const body = element(document, "div", "hb-dialog-body");
      body.append(
        element(
          document,
          "p",
          "",
          t("{name} has {count} items. Delete them too, or keep them without a set?", {
            name,
            count: members.length,
          }),
        ),
        element(
          document,
          "p",
          "hb-hint",
          t(
            "Kept items keep their type, rarity, attunement, weight and placements, but lose the set's name prefix, description, curse and condition.",
          ),
        ),
      );
      if (
        members.some((entry) => {
          const published = this.#published?.records.get(`hb.${entry.value.id}`);
          return published !== undefined && !published.value.withdrawn;
        })
      )
        body.append(
          messageBlock(
            document,
            t(
              "Deleting published items with the set withdraws them at the next publish; characters holding them then show a missing-source problem.",
            ),
            "alert",
          ),
        );
      const choice = await choiceDialog(this, t, t("Delete {name}?", { name }), body, [
        { value: "keep", label: t("Keep the items without a set"), variant: "primary" },
        { value: "all", label: t("Delete the set and its items"), variant: "danger" },
      ]);
      if (choice === undefined) return;
      const items =
        choice === "all"
          ? draftDeletes(collections.items, members)
          : draftPuts(
              collections.items,
              members,
              (item) => ({
                ...item,
                setId: "",
                overrides: moveOverrides(item.overrides, stored.value, undefined),
              }),
              Date.now(),
            );
      await this.#commitDrafts(
        [...items, ...draftDeletes(collections.sets, [stored])],
        t("Deleted {name}.", { name }),
        () => {
          this.#selection = undefined;
          this.#setDirty(false);
        },
      );
    }
    /**
     * Commits several draft changes guarded by the revisions the page loaded,
     * so nothing is overwritten that the page has not seen.
     */
    async #commitDrafts(
      mutations: readonly CollectionMutation[],
      done: string,
      succeeded: () => void = () => {},
    ): Promise<void> {
      const runtime = this.#runtime,
        drafts = this.#drafts;
      if (!runtime || !drafts || this.#busy || mutations.length === 0) return;
      if (mutations.length > 256)
        return this.#editorProblem({
          text: "This changes {count} drafts; change at most 256 at a time.",
          params: { count: mutations.length },
        });
      this.#setBusy(true);
      try {
        await runtime.repository.commit(mutations, drafts.dataRevisions, this.#signal());
        this.#message = { text: done, kind: "status" };
        succeeded();
      } catch (error) {
        this.#message = {
          text: isConflict(error)
            ? "Something changed since the page loaded. Try again."
            : messageOf(error, "The drafts could not be saved."),
          kind: "alert",
        };
      } finally {
        this.#setBusy(false);
      }
      await this.#load();
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
    async #remove(collection: DraftCollection, stored: StoredDraft): Promise<void> {
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
          drafts.sets.map((entry) => entry.value),
          drafts.items.map((entry) => entry.value),
          published.records,
          published.meta,
          Date.now(),
          drafts.subclasses.map((entry) => entry.value),
          published.subclasses,
          drafts.feats.map((entry) => entry.value),
          published.feats,
          drafts.spells.map((entry) => entry.value),
          published.spells,
          drafts.species.map((entry) => entry.value),
          published.species,
          drafts.backgrounds.map((entry) => entry.value),
          published.backgrounds,
        );
        const body = element(document, "div", "hb-dialog-body");
        let confirmable = plan.problems.length === 0 && plan.mutations.length > 0;
        if (plan.problems.length > 0) {
          const block = messageBlock(document, t("Fix these drafts before publishing:"), "alert");
          const list = element(document, "ul");
          for (const entry of plan.problems) {
            const name =
              drafts.items.find((item) => item.value.id === entry.itemId)?.value.name ??
              drafts.subclasses.find((subclass) => subclass.value.id === entry.itemId)?.value
                .name ??
              drafts.feats.find((feat) => feat.value.id === entry.itemId)?.value.name ??
              drafts.spells.find((spell) => spell.value.id === entry.itemId)?.value.name ??
              drafts.species.find((species) => species.value.id === entry.itemId)?.value.name ??
              drafts.backgrounds.find((background) => background.value.id === entry.itemId)?.value
                .name ??
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
                  "Characters with a withdrawn item, subclass, feat, spell, species or background show a missing-source problem until it is removed from them.",
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
          new Map(this.#drafts.sets.map((entry) => [entry.value.id, entry])),
          new Map(this.#drafts.items.map((entry) => [entry.value.id, entry])),
          Date.now(),
          new Map(this.#drafts.subclasses.map((entry) => [entry.value.id, entry])),
          new Map(this.#drafts.feats.map((entry) => [entry.value.id, entry])),
          new Map(this.#drafts.spells.map((entry) => [entry.value.id, entry])),
          new Map(this.#drafts.species.map((entry) => [entry.value.id, entry])),
          new Map(this.#drafts.backgrounds.map((entry) => [entry.value.id, entry])),
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
        const kinds: Readonly<Record<string, string>> = {
          [collections.sets]: t("set"),
          [collections.items]: t("item"),
          [collections.subclasses]: t("subclass"),
          [collections.feats]: t("feat"),
          [collections.spells]: t("spell"),
          [collections.species]: t("species"),
          [collections.backgrounds]: t("background"),
        };
        for (const [operation, label] of [
          ["create", "Created"],
          ["update", "Updated"],
          ["delete", "Removed"],
        ] as const) {
          const changes = preview.changes.filter((change) => change.operation === operation);
          if (changes.length === 0) continue;
          body.append(element(document, "h3", "", `${t(label)} (${changes.length})`));
          const list = element(document, "ul", "hb-change-list");
          for (const change of changes) {
            const kind = kinds[change.collection];
            list.append(
              element(document, "li", "", kind ? `${change.label} (${kind})` : change.label),
            );
          }
          body.append(list);
        }
        if (
          !(await openDialog(
            this,
            t,
            t("Import homebrew"),
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
        this.#drafts.sets.map((entry) => entry.value),
        this.#drafts.items.map((entry) => entry.value),
        now.getTime(),
        this.#drafts.subclasses.map((entry) => entry.value),
        this.#drafts.feats.map((entry) => entry.value),
        this.#drafts.spells.map((entry) => entry.value),
        this.#drafts.species.map((entry) => entry.value),
        this.#drafts.backgrounds.map((entry) => entry.value),
      );
      downloadFile(
        document,
        `${JSON.stringify(document_, null, 2)}\n`,
        `homebrew-${now.toISOString().slice(0, 10)}.json`,
        "application/json",
      );
    }
  }
  customElements.define(tag, CatalogElement);
  return tag;
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
