import { defineCatalogElement } from "./catalog-element.js";
import { defineGalleryElement } from "./gallery-element.js";
import { HomebrewRepository } from "./repository.js";
import { registerRuntime } from "./runtime.js";
import type { AddonContext, Disposable } from "./sdk.js";
import { PublishedCache, provideReferences } from "./wiki-provider.js";

export async function activate(context: AddonContext): Promise<Disposable> {
  context.capabilities.require("data.transactions");
  context.capabilities.require("services.own");
  context.capabilities.require("ui.contributions");
  context.capabilities.require("ui.markdown");
  context.capabilities.require("ui.controls.v1");
  context.signal.throwIfAborted();
  const importer = await context.services.own("codex.import-adapter", { signal: context.signal });
  const repository = new HomebrewRepository(context);
  const references = new PublishedCache(repository, context.signal);
  const unsubscribe = repository.subscribe(() => references.invalidate(), context.signal);
  const unregister = registerRuntime(context.addon.generation, {
    repository,
    importer,
    signal: context.signal,
    ui: context.ui,
  });
  const bindings = [
    context.ui.bind("homebrew.route", {
      kind: "element",
      tag: defineCatalogElement(context.addon.generation),
    }),
    context.ui.bind("gallery.route", {
      kind: "element",
      tag: defineGalleryElement(context.addon.generation),
    }),
    context.ui.bind("homebrew.wiki", {
      kind: "model-provider",
      provide: (request, { signal }) => provideReferences(references, request, signal),
    }),
  ];
  let disposed = false;
  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const binding of bindings.reverse()) binding.dispose();
      unsubscribe();
      unregister();
    },
  });
}
