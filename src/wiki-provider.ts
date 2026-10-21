import { fold, plainText, revealed, served } from "./gallery-model.js";
import { idPrefix, isRecord, type Published } from "./model.js";
import type { HomebrewRepository, PublishedState } from "./repository.js";

/** Published records shared by every wiki request until the data changes. */
export class PublishedCache {
  readonly #repository: Pick<HomebrewRepository, "published">;
  readonly #signal: AbortSignal;
  #pending: Promise<PublishedState> | undefined;
  constructor(repository: Pick<HomebrewRepository, "published">, signal: AbortSignal) {
    this.#repository = repository;
    this.#signal = signal;
  }
  get(): Promise<PublishedState> {
    this.#pending ??= this.#repository.published(this.#signal).catch((error: unknown) => {
      this.#pending = undefined;
      throw error;
    });
    return this.#pending;
  }
  invalidate(): void {
    this.#pending = undefined;
  }
}

interface Match {
  readonly index: number;
  readonly label: string;
  readonly description: string;
  readonly target: {
    readonly route: string;
    readonly query: readonly (readonly [string, string])[];
  };
}
const target = (record: Published): Match["target"] => ({
  route: "gallery.route",
  query: [["id", record.id]],
});

/**
 * Resolves `magic-item:hb.*` hints from character sheets and wiki links. An
 * exact id resolves while the record is served, revealed or not, because the
 * sheet asking already holds it; label lookups and search see revealed items
 * only. Anything else is left to other providers, such as the compendium.
 */
export async function provideReferences(
  cache: Pick<PublishedCache, "get">,
  raw: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  signal.throwIfAborted();
  if (!isRecord(raw) || raw["contractVersion"] !== "wiki-links.v1")
    throw new TypeError("Invalid wiki request");
  if (raw["operation"] === "search") {
    const query = raw["query"],
      limit = raw["limit"];
    if (
      typeof query !== "string" ||
      query.length > 200 ||
      typeof limit !== "number" ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 20
    )
      throw new TypeError("Invalid reference search");
    const needle = fold(query.trim());
    if (!needle) return { contractVersion: "wiki-links.v1", matches: [] };
    const state = await cache.get();
    signal.throwIfAborted();
    return {
      contractVersion: "wiki-links.v1",
      matches: revealed(state)
        .filter((record) => fold(record.record.name).includes(needle))
        .slice(0, limit)
        .map((record, index): Match => ({
          index,
          label: record.record.name,
          description: [record.setName, record.record.rarity].filter(Boolean).join(" · "),
          target: target(record),
        })),
    };
  }
  const references = raw["references"];
  if (raw["operation"] !== "resolve" || !Array.isArray(references) || references.length > 100)
    throw new TypeError("Invalid reference batch");
  for (const reference of references)
    if (
      !isRecord(reference) ||
      typeof reference["label"] !== "string" ||
      reference["label"].length > 200 ||
      typeof reference["hint"] !== "string" ||
      reference["hint"].length > 300
    )
      throw new TypeError("Invalid reference");
  if (references.length === 0) return { contractVersion: "wiki-links.v1", matches: [] };
  const state = await cache.get();
  signal.throwIfAborted();
  const visible = revealed(state);
  return {
    contractVersion: "wiki-links.v1",
    matches: (references as { label: string; hint: string }[]).flatMap(
      (reference, index): Match[] => {
        const record = resolve(state, visible, reference.label, reference.hint);
        return record
          ? [
              {
                index,
                label: record.record.name,
                description: plainText(record.record.text, 500),
                target: target(record),
              },
            ]
          : [];
      },
    ),
  };
}

function resolve(
  state: PublishedState,
  visible: readonly Published[],
  label: string,
  hint: string,
): Published | undefined {
  hint = hint.trim();
  const colon = hint.indexOf(":"),
    kind = colon < 0 ? hint : hint.slice(0, colon),
    id = colon < 0 ? "" : hint.slice(colon + 1);
  if (kind && kind !== "magic-item") return undefined;
  if (id) return id.startsWith(idPrefix) ? served(state, id) : undefined;
  const wanted = fold(label.trim());
  if (!wanted) return undefined;
  const matches = visible.filter((record) => fold(record.record.name) === wanted);
  return matches.length === 1 ? matches[0] : undefined;
}
