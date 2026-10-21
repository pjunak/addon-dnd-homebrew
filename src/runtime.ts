import type { AddonContext, ServiceHandle } from "./sdk.js";
import type { ReferenceLoader } from "./references.js";
import type { HomebrewRepository } from "./repository.js";
export interface HomebrewRuntime {
  readonly repository: HomebrewRepository;
  /** This package's own worker import adapter; it has no provider while the worker is down. */
  readonly importer: ServiceHandle;
  /** Spells and classes from the Compendium, for the editor's pickers. */
  readonly references: ReferenceLoader;
  readonly signal: AbortSignal;
  readonly ui: AddonContext["ui"];
}
interface Registry {
  readonly generations: Map<string, HomebrewRuntime>;
}
const key = "__ttrpgCodexDndHomebrewV1";
export function registerRuntime(generation: string, runtime: HomebrewRuntime): () => void {
  const registry = getRegistry();
  registry.generations.set(generation, runtime);
  return () => {
    if (registry.generations.get(generation) === runtime) registry.generations.delete(generation);
  };
}
export function runtimeFor(generation: string): HomebrewRuntime | undefined {
  return getRegistry().generations.get(generation);
}
function getRegistry(): Registry {
  const root = globalThis as typeof globalThis & Record<string, unknown>;
  const current = root[key];
  if (
    typeof current === "object" &&
    current !== null &&
    (current as { generations?: unknown }).generations instanceof Map
  )
    return current as Registry;
  const created: Registry = { generations: new Map() };
  root[key] = created;
  return created;
}
