import type { Translator } from "./catalogs.js";
import { actionButton, badge, element } from "./fields.js";

export type KindKey = "item" | "set" | "subclass" | "feat" | "spell" | "species" | "background";

/** One kind of homebrew; its words are English and translated where shown. */
export interface HomebrewKind {
  readonly key: KindKey;
  /** One draft, as the New… menu lists it. */
  readonly one: string;
  /** Its heading on the overview. */
  readonly many: string;
  readonly newLabel: string;
  /** A decorative glyph, as the host's settings and overview headings use. */
  readonly icon: string;
  readonly about: string;
  /** Sets are not served themselves: they reach play through their items. */
  readonly published: boolean;
}

/** Every kind, in the order the overview and the New… menu list them. */
export const homebrewKinds: readonly HomebrewKind[] = [
  {
    key: "item",
    one: "Item",
    many: "Items",
    newLabel: "New item",
    icon: "⚔︎",
    about:
      "A magic item, such as a +1 weapon, a ring of resistance or a wand with a spell. Start from a common kind and change what you need.",
    published: true,
  },
  {
    key: "set",
    one: "Set",
    many: "Sets",
    newLabel: "New set",
    icon: "❖",
    about:
      "Items that share their type, rarity, attunement, description or curse, such as a deck of cards.",
    published: false,
  },
  {
    key: "subclass",
    one: "Subclass",
    many: "Subclasses",
    newLabel: "New subclass",
    icon: "⚜︎",
    about: "A class's subclass, with its features by level.",
    published: true,
  },
  {
    key: "feat",
    one: "Feat",
    many: "Feats",
    newLabel: "New feat",
    icon: "★",
    about: "An origin feat, a general feat, a fighting style or an epic boon.",
    published: true,
  },
  {
    key: "spell",
    one: "Spell",
    many: "Spells",
    newLabel: "New spell",
    icon: "✶",
    about: "A spell with its stat block, on the spell lists of the classes you choose.",
    published: true,
  },
  {
    key: "species",
    one: "Species",
    many: "Species",
    newLabel: "New species",
    icon: "⚘︎",
    about:
      "A species for character creation, with its size, speeds and traits, and lineages to choose from.",
    published: true,
  },
  {
    key: "background",
    one: "Background",
    many: "Backgrounds",
    newLabel: "New background",
    icon: "✒︎",
    about:
      "A background for character creation: the abilities it raises, its origin feat, skills, tools and equipment.",
    published: true,
  },
];

/** A kind at a glance: its drafts, how many differ from what is in play, and how many players cannot see. */
export interface KindSummary {
  readonly count: number;
  readonly pending: number;
  readonly hidden: number;
}

/**
 * The start screen: a card per kind with its counts and its New action, then
 * how a draft reaches play. `start` opens a new draft of a kind.
 */
export function overview(
  document: Document,
  t: Translator,
  summaries: Readonly<Record<KindKey, KindSummary>>,
  start: (key: KindKey) => void,
): HTMLElement {
  const root = element(document, "section", "hb-overview");
  root.setAttribute("aria-labelledby", "hb-overview-title");
  const title = element(document, "h2", "hb-overview-title", t("Your homebrew"));
  title.id = "hb-overview-title";
  const head = element(document, "div", "hb-overview-head");
  head.append(
    title,
    element(
      document,
      "p",
      "hb-hint",
      t("Choose a draft in the list to edit it, or start a new one here."),
    ),
  );
  const cards = element(document, "div", "hb-kind-tiles");
  for (const kind of homebrewKinds)
    cards.append(kindCard(document, t, kind, summaries[kind.key], start));
  root.append(head, cards, flow(document, t));
  return root;
}

function kindCard(
  document: Document,
  t: Translator,
  kind: HomebrewKind,
  summary: KindSummary,
  start: (key: KindKey) => void,
): HTMLElement {
  const card = element(document, "article", "hb-kind-tile");
  card.dataset["kind"] = kind.key;
  const head = element(document, "div", "hb-kind-tile-head");
  const icon = element(document, "span", "hb-kind-icon", kind.icon);
  icon.setAttribute("aria-hidden", "true");
  const count = element(document, "span", "hb-kind-count", String(summary.count));
  count.setAttribute("aria-label", t("Drafts: {count}", { count: summary.count }));
  head.append(icon, element(document, "h3", "", t(kind.many)), count);
  const state = element(document, "p", "hb-kind-state");
  if (summary.count === 0) state.append(element(document, "span", "hb-kind-none", t("None yet")));
  else {
    if (summary.pending > 0)
      state.append(badge(document, t("{count} to publish", { count: summary.pending }), "accent"));
    else if (kind.published) state.append(badge(document, t("All published"), "muted"));
    if (summary.hidden > 0)
      state.append(
        badge(document, t("{count} hidden from players", { count: summary.hidden }), "muted"),
      );
  }
  const action = actionButton(document, t(kind.newLabel), () => start(kind.key));
  action.classList.add("ui-action");
  card.append(head, element(document, "p", "hb-kind-about", t(kind.about)), state, action);
  return card;
}

/** How a draft reaches play: a real sequence, so the steps are numbered. */
function flow(document: Document, t: Translator): HTMLElement {
  const root = element(document, "div", "hb-flow");
  root.append(element(document, "h3", "", t("How homebrew reaches the table")));
  const steps = element(document, "ol");
  for (const [name, text] of [
    ["Draft", "Drafts stay private to you while you write them."],
    ["Publish", "Publishing puts all your drafts into play at once."],
    [
      "Play",
      "Character sheets use what you publish, and players find visible items in the Item Gallery.",
    ],
  ] as const) {
    const step = element(document, "li");
    step.append(element(document, "strong", "", t(name)), element(document, "span", "", t(text)));
    steps.append(step);
  }
  root.append(steps);
  return root;
}
