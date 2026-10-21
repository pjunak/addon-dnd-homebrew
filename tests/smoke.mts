import test from "node:test";
import assert from "node:assert/strict";

void test("compiled entry binds both routes and the wiki provider and disposes idempotently", async () => {
  type BindingRecord = { id: string; binding: { kind: string }; disposed: boolean };
  const oldHTMLElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
  const oldCustomElements = Object.getOwnPropertyDescriptor(globalThis, "customElements");
  const definitions = new Map<string, unknown>();
  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    writable: true,
    value: class {},
  });
  Object.defineProperty(globalThis, "customElements", {
    configurable: true,
    writable: true,
    value: {
      define: (name: string, constructor: unknown) => definitions.set(name, constructor),
      get: (name: string) => definitions.get(name),
    },
  });
  try {
    const compiledEntry = new URL("../web/index.js", import.meta.url);
    compiledEntry.searchParams.set("smoke", "1");
    const { activate } = (await import(compiledEntry.href)) as {
      activate: (context: unknown) => Promise<{ dispose(): void }>;
    };
    const bindings: BindingRecord[] = [];
    const owned: string[] = [];
    let unsubscribed = false;
    const required: string[] = [];
    const context = {
      addon: { id: "dnd-homebrew", version: "1.0.0", generation: "b".repeat(64) },
      signal: new AbortController().signal,
      capabilities: { require: (id: string) => required.push(id) },
      data: {
        subscribe: () => () => {
          unsubscribed = true;
        },
        collection: () => ({
          query: async () => ({ documents: [] }),
          get: async () => assert.fail("unused"),
        }),
        transact: async () => ({ results: [] }),
      },
      services: {
        own: async (contract: string) => {
          owned.push(contract);
          return { available: false, providers: [], call: async () => assert.fail("unused") };
        },
      },
      ui: {
        bind: (id: string, binding: { kind: string }) => {
          const record = { id, binding, disposed: false };
          bindings.push(record);
          return {
            dispose: () => {
              record.disposed = true;
            },
          };
        },
      },
    };
    const disposable = await activate(context);
    assert.deepEqual(owned, ["codex.import-adapter"]);
    assert.deepEqual(required.sort(), [
      "data.transactions",
      "services.own",
      "ui.contributions",
      "ui.controls.v1",
      "ui.markdown",
    ]);
    assert.deepEqual(
      bindings.map(({ id, binding }) => [id, binding.kind]),
      [
        ["homebrew.route", "element"],
        ["gallery.route", "element"],
        ["homebrew.wiki", "model-provider"],
      ],
    );
    assert.equal(definitions.size, 2);
    disposable.dispose();
    disposable.dispose();
    assert.ok(bindings.every((binding) => binding.disposed));
    assert.ok(unsubscribed);
  } finally {
    if (oldHTMLElement) Object.defineProperty(globalThis, "HTMLElement", oldHTMLElement);
    else Reflect.deleteProperty(globalThis, "HTMLElement");
    if (oldCustomElements) Object.defineProperty(globalThis, "customElements", oldCustomElements);
    else Reflect.deleteProperty(globalThis, "customElements");
  }
});
