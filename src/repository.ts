import {
  collections,
  HomebrewError,
  metaKey,
  parseFeat,
  parseSet,
  parseItem,
  parseMeta,
  parsePublished,
  parsePublishedFeat,
  parsePublishedSubclass,
  parseSubclass,
  type CollectionMutation,
  type Feat,
  type Item,
  type ItemSet,
  type Published,
  type PublishedFeat,
  type PublishedSubclass,
  type PublishMeta,
  type Stored,
  type Subclass,
} from "./model.js";
import type {
  AddonContext,
  AddonDocument,
  CollectionHandle,
  CommitReceipt,
  DataMutation,
  DataSetRevision,
} from "./sdk.js";

/** The part of the host's data API the repository uses. */
export interface RepositoryContext {
  readonly signal: AbortSignal;
  readonly data: {
    readonly subscribe?: AddonContext["data"]["subscribe"];
    collection(id: string): Pick<CollectionHandle<unknown>, "query" | "get">;
    transact(
      mutations: readonly DataMutation[],
      options?: Parameters<AddonContext["data"]["transact"]>[1],
    ): Promise<Pick<CommitReceipt, "results">>;
  };
}

/** A collection the DM edits drafts in. */
export type DraftCollection =
  | typeof collections.sets
  | typeof collections.items
  | typeof collections.subclasses
  | typeof collections.feats;

/** A stored value that failed its checks; it is shown, never silently dropped. */
export interface Unreadable {
  readonly collection: string;
  readonly key: string;
  readonly message: string;
}
export interface Drafts {
  readonly sets: readonly Stored<ItemSet>[];
  readonly items: readonly Stored<Item>[];
  readonly subclasses: readonly Stored<Subclass>[];
  readonly feats: readonly Stored<Feat>[];
  readonly unreadable: readonly Unreadable[];
  readonly dataRevisions: readonly DataSetRevision[];
}
export interface PublishedState {
  readonly records: ReadonlyMap<string, Stored<Published>>;
  readonly subclasses: ReadonlyMap<string, Stored<PublishedSubclass>>;
  readonly feats: ReadonlyMap<string, Stored<PublishedFeat>>;
  readonly meta: Stored<PublishMeta> | undefined;
  readonly unreadable: readonly Unreadable[];
  /** Present only for a guarded (DM) read; players cannot read set revisions. */
  readonly dataRevisions?: readonly DataSetRevision[];
}

export class HomebrewRepository {
  readonly #context: RepositoryContext;
  constructor(context: RepositoryContext) {
    this.#context = context;
  }
  subscribe(listener: () => void, signal: AbortSignal): () => void {
    const ours = new Set<string>(Object.values(collections));
    return (
      this.#context.data.subscribe?.(
        (change) => {
          if (
            change.reason === "reset" ||
            (change.kind === "collection" && ours.has(change.dataId))
          )
            listener();
        },
        { signal: AbortSignal.any([signal, this.#context.signal]) },
      ) ?? (() => undefined)
    );
  }
  /** Reads every set, item, subclass and feat draft; DM only. */
  async drafts(signal: AbortSignal): Promise<Drafts> {
    signal = AbortSignal.any([this.#context.signal, signal]);
    const [sets, items, subclasses, feats] = await Promise.all([
      this.#all(collections.sets, signal, true),
      this.#all(collections.items, signal, true),
      this.#all(collections.subclasses, signal, true),
      this.#all(collections.feats, signal, true),
    ]);
    const unreadable: Unreadable[] = [];
    return {
      sets: read(sets.documents, collections.sets, parseSet, unreadable),
      items: read(items.documents, collections.items, parseItem, unreadable),
      subclasses: read(subclasses.documents, collections.subclasses, parseSubclass, unreadable),
      feats: read(feats.documents, collections.feats, parseFeat, unreadable),
      unreadable,
      dataRevisions: [
        sets.dataRevision!,
        items.dataRevision!,
        subclasses.dataRevision!,
        feats.dataRevision!,
      ],
    };
  }
  /** Reads the published records; `guarded` adds set revisions for a publish. */
  async published(signal: AbortSignal, guarded = false): Promise<PublishedState> {
    signal = AbortSignal.any([this.#context.signal, signal]);
    const [records, subclassRecords, featRecords, meta] = await Promise.all([
      this.#all(collections.published, signal, guarded),
      this.#all(collections.publishedSubclasses, signal, guarded),
      this.#all(collections.publishedFeats, signal, guarded),
      this.#all(collections.meta, signal, guarded),
    ]);
    const unreadable: Unreadable[] = [];
    const published = read(records.documents, collections.published, parsePublished, unreadable);
    const subclasses = read(
      subclassRecords.documents,
      collections.publishedSubclasses,
      parsePublishedSubclass,
      unreadable,
    );
    const feats = read(
      featRecords.documents,
      collections.publishedFeats,
      parsePublishedFeat,
      unreadable,
    );
    const metas = read(
      meta.documents.filter((document) => document.key === metaKey),
      collections.meta,
      parseMeta,
      unreadable,
    );
    return {
      records: new Map(published.map((entry) => [entry.value.id, entry])),
      subclasses: new Map(subclasses.map((entry) => [entry.value.id, entry])),
      feats: new Map(feats.map((entry) => [entry.value.id, entry])),
      meta: metas[0],
      unreadable,
      ...(guarded
        ? {
            dataRevisions: [
              records.dataRevision!,
              subclassRecords.dataRevision!,
              featRecords.dataRevision!,
              meta.dataRevision!,
            ],
          }
        : {}),
    };
  }
  async save(
    collection: DraftCollection,
    value: ItemSet | Item | Subclass | Feat,
    expectedRevision: number,
    signal: AbortSignal,
  ): Promise<number> {
    const receipt = await this.#context.data.transact(
      [
        {
          operation: "put",
          kind: "collection",
          dataId: collection,
          key: value.id,
          expectedRevision,
          value,
        },
      ],
      { signal: AbortSignal.any([this.#context.signal, signal]) },
    );
    return revisionOf(receipt, collection, value.id);
  }
  async remove(
    collection: DraftCollection,
    key: string,
    expectedRevision: number,
    signal: AbortSignal,
  ): Promise<void> {
    await this.#context.data.transact(
      [{ operation: "delete", kind: "collection", dataId: collection, key, expectedRevision }],
      { signal: AbortSignal.any([this.#context.signal, signal]) },
    );
  }
  /** Commits a reviewed plan only if no read collection changed since. */
  async commit(
    mutations: readonly CollectionMutation[],
    expectedDataSets: readonly DataSetRevision[],
    signal: AbortSignal,
  ): Promise<void> {
    if (mutations.length === 0) return;
    await this.#context.data.transact(mutations, {
      signal: AbortSignal.any([this.#context.signal, signal]),
      expectedDataSets,
    });
  }
  async #all(
    id: string,
    signal: AbortSignal,
    guarded: boolean,
  ): Promise<{ documents: readonly AddonDocument<unknown>[]; dataRevision?: DataSetRevision }> {
    const handle = this.#context.data.collection(id);
    const documents: AddonDocument<unknown>[] = [];
    let cursor: string | undefined;
    let revision: number | undefined;
    do {
      signal.throwIfAborted();
      const page = await handle.query({
        ...(cursor === undefined ? {} : { cursor }),
        limit: 200,
        signal,
        ...(guarded ? { includeDataRevision: true } : {}),
        ...(guarded && revision !== undefined ? { expectedDataRevision: revision } : {}),
      });
      signal.throwIfAborted();
      if (!Array.isArray(page.documents))
        throw new HomebrewError("The host returned an invalid page of homebrew data.");
      if (guarded) {
        if (
          page.dataRevision === undefined ||
          !Number.isSafeInteger(page.dataRevision) ||
          page.dataRevision < 0 ||
          (revision !== undefined && page.dataRevision !== revision)
        )
          throw new HomebrewError("Homebrew data changed while loading. Reload to try again.");
        revision = page.dataRevision;
      }
      documents.push(...page.documents);
      cursor = page.nextCursor;
    } while (cursor !== undefined);
    return {
      documents,
      ...(revision === undefined
        ? {}
        : { dataRevision: { kind: "collection" as const, dataId: id, revision } }),
    };
  }
}

function read<T>(
  documents: readonly AddonDocument<unknown>[],
  collection: string,
  parse: (value: unknown) => T,
  unreadable: Unreadable[],
): Stored<T>[] {
  const result: Stored<T>[] = [];
  for (const document of documents) {
    try {
      if (typeof document.key !== "string" || !Number.isSafeInteger(document.revision))
        throw new HomebrewError("The host returned an invalid document.");
      const value = parse(document.value);
      const id = (value as { id?: unknown }).id;
      if (id !== undefined && id !== document.key)
        throw new HomebrewError("The stored id does not match its key.");
      result.push({ value, revision: document.revision });
    } catch (error) {
      unreadable.push({
        collection,
        key: String(document.key),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}

function revisionOf(receipt: Pick<CommitReceipt, "results">, dataId: string, key: string): number {
  const result = receipt.results.find((entry) => entry.dataId === dataId && entry.key === key);
  if (!result || !Number.isSafeInteger(result.afterRevision))
    throw new HomebrewError("The save was stored, but its receipt is incomplete. Reload the page.");
  return result.afterRevision;
}
