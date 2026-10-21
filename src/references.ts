import type { ServiceHandle } from "./sdk.js";

/** A rule record offered in a picker: its id, name and a short description. */
export interface RuleOption {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
}
/** Spells and classes from the installed rules data, sorted by name. */
export interface References {
  readonly spells: readonly RuleOption[];
  readonly classes: readonly RuleOption[];
}

/** Picker options from rule records: id, name, and details for the highlighted option. */
export function pickerOptions(
  options: readonly RuleOption[],
): (readonly [string, string, string])[] {
  return options.map((option) => [option.id, option.name, option.detail] as const);
}

const kinds = ["spell", "class"] as const;
type Kind = (typeof kinds)[number];
const pageLimit = 200;
const deadlineMs = 5000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const ordinal = (level: number): string => (level === 0 ? "Cantrip" : `Level ${level}`);

/** The picker entry for a record value, or undefined when it is malformed. */
function optionOf(kind: Kind, value: unknown): RuleOption | undefined {
  if (!isObject(value) || typeof value["id"] !== "string" || typeof value["name"] !== "string")
    return undefined;
  if (kind === "class") return { id: value["id"], name: value["name"], detail: "" };
  const level = value["level"],
    school = typeof value["school"] === "string" ? value["school"] : "",
    classes = Array.isArray(value["classes"])
      ? value["classes"].filter((entry): entry is string => typeof entry === "string")
      : [];
  if (typeof level !== "number" || !Number.isInteger(level)) return undefined;
  return {
    id: value["id"],
    name: value["name"],
    detail: [ordinal(level), school, classes.join(", ")].filter(Boolean).join(" · "),
  };
}

/**
 * Reads the pickers' records from every other rules-data provider (the
 * Compendium), once per page load. A provider that fails or answers
 * malformed data is skipped; with none left the editor falls back to typed ids.
 */
export class ReferenceLoader {
  readonly #connect: () => Promise<ServiceHandle>;
  readonly #signal: AbortSignal;
  #loading: Promise<References> | undefined;
  /** `signal` is the add-on generation's: a load outlives the page that asked. */
  constructor(connect: () => Promise<ServiceHandle>, signal: AbortSignal) {
    this.#connect = connect;
    this.#signal = signal;
  }
  load(): Promise<References> {
    this.#loading ??= this.#read(this.#signal).catch((error: unknown) => {
      this.#loading = undefined;
      throw error;
    });
    return this.#loading;
  }
  async #read(signal: AbortSignal): Promise<References> {
    const handle = await this.#connect();
    const found: Record<Kind, Map<string, RuleOption>> = { spell: new Map(), class: new Map() };
    let answered = false;
    for (const provider of handle.providers) {
      const call = <T>(method: string, params: unknown): Promise<T> =>
        handle.call<T>(method, params, { providerAddonId: provider.addonId, deadlineMs, signal });
      try {
        const catalog = await call<unknown>("catalog", {});
        const sets = isObject(catalog) && Array.isArray(catalog["sets"]) ? catalog["sets"] : [];
        for (const set of sets) {
          if (!isObject(set) || typeof set["id"] !== "string" || !isObject(set["kinds"])) continue;
          for (const kind of kinds) {
            if (typeof set["kinds"][kind] !== "number" || set["kinds"][kind] < 1) continue;
            let cursor: string | undefined;
            do {
              const page = await call<unknown>("query", {
                setId: set["id"],
                kind,
                limit: pageLimit,
                ...(cursor === undefined ? {} : { cursor }),
              });
              if (!isObject(page) || !Array.isArray(page["records"])) break;
              for (const record of page["records"]) {
                const option = isObject(record) ? optionOf(kind, record["value"]) : undefined;
                if (option && !found[kind].has(option.id)) found[kind].set(option.id, option);
              }
              cursor = typeof page["nextCursor"] === "string" ? page["nextCursor"] : undefined;
            } while (cursor !== undefined);
          }
        }
        answered = true;
      } catch (error) {
        if (signal.aborted) throw error;
      }
    }
    if (!answered) throw new Error("No rules-data provider answered.");
    const sorted = (options: Map<string, RuleOption>): RuleOption[] =>
      [...options.values()].sort((left, right) => left.name.localeCompare(right.name));
    return { spells: sorted(found.spell), classes: sorted(found.class) };
  }
}
