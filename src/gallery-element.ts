import { hostLocale, translator, type Translator } from "./catalogs.js";
import { describeEffect } from "./effects.js";
import { describeGrants } from "./grants.js";
import { element, markdown, messageBlock, option } from "./fields.js";
import { fold, revealed, served } from "./gallery-model.js";
import { LiveRefresh } from "./live-refresh.js";
import { HomebrewError, type Published } from "./model.js";
import type { PublishedState } from "./repository.js";
import { runtimeFor, type HomebrewRuntime } from "./runtime.js";
import type { ContributionContext } from "./sdk.js";

export const galleryElementTag = "dnd-homebrew-gallery";

interface RouteHost {
  readonly locale?: string;
  readonly query?: readonly (readonly [string, string])[];
}

export function defineGalleryElement(generation?: string): string {
  const tag = generation ? `${galleryElementTag}-${generation}` : galleryElementTag;
  if (customElements.get(tag)) return tag;
  class GalleryElement extends HTMLElement {
    #contribution: ContributionContext | undefined;
    #runtime: HomebrewRuntime | undefined;
    #controls: ReturnType<HomebrewRuntime["ui"]["enhance"]> | undefined;
    #connection: AbortController | undefined;
    #refresh: LiveRefresh | undefined;
    #state: PublishedState | undefined;
    #failure: string | undefined;
    #search = "";
    #setName = "";
    readonly #list = document.createElement("div");

    set codexContribution(value: ContributionContext) {
      const previous = this.#contribution;
      this.#contribution = value;
      if (!this.isConnected) return;
      if (previous?.addon.generation !== value.addon.generation) this.#connect();
      else this.#render();
    }
    get #t(): Translator {
      return translator(hostLocale(this.#contribution?.host));
    }
    get #focusId(): string {
      const query = (this.#contribution?.host as RouteHost | undefined)?.query;
      return Array.isArray(query) ? (query.find(([key]) => key === "id")?.[1] ?? "") : "";
    }
    connectedCallback(): void {
      this.classList.add("dnd-homebrew", "hb-shell", "hb-gallery");
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
      this.#state = undefined;
      if (!runtime || runtime.signal.aborted) {
        this.#failure =
          "This page belongs to an add-on version that is no longer active. Reload the page.";
        this.#render();
        return;
      }
      this.#connection = new AbortController();
      this.#controls = runtime.ui.enhance(this);
      this.#refresh = new LiveRefresh(
        () => true,
        () => void this.#load(),
      );
      runtime.repository.subscribe(() => this.#refresh?.invalidate(), this.#signal());
      this.#render();
      void this.#load();
    }
    async #load(): Promise<void> {
      const runtime = this.#runtime;
      if (!runtime) return;
      this.#refresh?.consume();
      const signal = this.#signal();
      try {
        const state = await runtime.repository.published(signal);
        if (signal.aborted || runtime !== this.#runtime) return;
        this.#state = state;
        this.#failure = undefined;
      } catch (error) {
        if (signal.aborted) return;
        this.#failure =
          error instanceof HomebrewError
            ? error.message
            : "Homebrew items could not be loaded. Reload to try again.";
      }
      this.#render();
    }
    #render(): void {
      const t = this.#t;
      const header = element(document, "header", "hb-header");
      const title = element(document, "div", "hb-title");
      title.append(
        element(document, "h1", "", t("Item Gallery")),
        element(document, "p", "", t("Items the DM has revealed to the party.")),
      );
      header.append(title);
      const nodes: HTMLElement[] = [header];
      if (this.#failure) nodes.push(messageBlock(document, t(this.#failure), "alert"));
      else if (!this.#state)
        nodes.push(messageBlock(document, t("Loading homebrew items…"), "status"));
      else {
        const records = revealed(this.#state);
        const focus = served(this.#state, this.#focusId);
        if (this.#focusId && !focus)
          nodes.push(messageBlock(document, t("The linked item is not published."), "status"));
        const sets = [
          ...new Set(records.map((record) => record.setName).filter((name) => name !== "")),
        ];
        nodes.push(this.#filters(sets));
        this.#list.className = "hb-gallery-list";
        nodes.push(this.#list);
        this.#renderList(records, focus);
      }
      this.replaceChildren(...nodes);
      this.#controls?.refresh();
      if (this.#focusId)
        this.querySelector<HTMLElement>(".hb-card.focused")?.scrollIntoView({ block: "nearest" });
    }
    #filters(sets: readonly string[]): HTMLElement {
      const t = this.#t;
      const bar = element(document, "div", "hb-gallery-filters");
      bar.dataset["uiToolbar"] = "";
      const search = element(document, "input");
      search.type = "search";
      search.dataset["ui"] = "search";
      search.dataset["uiKey"] = "gallery-search";
      search.placeholder = t("Search the gallery");
      search.setAttribute("aria-label", t("Search the gallery"));
      search.value = this.#search;
      search.addEventListener("input", () => {
        this.#search = search.value;
        if (this.#state)
          this.#renderList(revealed(this.#state), served(this.#state, this.#focusId));
      });
      bar.append(search);
      if (sets.length > 1) {
        const select = element(document, "select");
        select.setAttribute("aria-label", t("Set"));
        select.append(option(document, "", t("All sets")));
        for (const name of sets) {
          const entry = option(document, name, name);
          entry.selected = name === this.#setName;
          select.append(entry);
        }
        select.addEventListener("change", () => {
          this.#setName = select.value;
          if (this.#state)
            this.#renderList(revealed(this.#state), served(this.#state, this.#focusId));
        });
        bar.append(select);
      }
      return bar;
    }
    #renderList(records: readonly Published[], focus: Published | undefined): void {
      const t = this.#t;
      const query = fold(this.#search.trim());
      const shown = records.filter(
        (record) =>
          (!this.#setName || record.setName === this.#setName) &&
          (!query ||
            fold(record.record.name).includes(query) ||
            fold(record.record.text).includes(query)),
      );
      if (focus && !shown.some((record) => record.id === focus.id)) shown.unshift(focus);
      if (shown.length === 0) {
        this.#list.replaceChildren(
          messageBlock(
            document,
            t(
              records.length === 0
                ? "No items have been revealed yet."
                : "No items match the search.",
            ),
            "status",
          ),
        );
        return;
      }
      this.#list.replaceChildren(
        ...shown.map((record) => this.#card(record, record.id === focus?.id)),
      );
    }
    #card(published: Published, focused: boolean): HTMLElement {
      const t = this.#t;
      const record = published.record;
      const card = element(document, "article", `hb-card${focused ? " focused" : ""}`);
      card.id = `hb-card-${published.itemId}`;
      const heading = element(document, "h2", "", record.name);
      const meta = element(
        document,
        "p",
        "hb-card-meta",
        [published.setName, t(record.rarity)].filter(Boolean).join(" · "),
      );
      card.append(heading, meta, markdown(document, record.text));
      const lines = [
        ...record.characterEffects.map((effect) => describeEffect(effect, t)),
        ...describeGrants(record.grants, t),
      ];
      if (lines.length > 0) {
        const effects = element(document, "div", "hb-card-effects");
        effects.append(element(document, "p", "", t("Applied on the character sheet:")));
        const list = element(document, "ul");
        for (const line of lines) list.append(element(document, "li", "", line));
        effects.append(list);
        for (const condition of record.grants?.conditions ?? [])
          if (condition.summary) effects.append(markdown(document, condition.summary));
        card.append(effects);
      }
      return card;
    }
  }
  customElements.define(tag, GalleryElement);
  return tag;
}
