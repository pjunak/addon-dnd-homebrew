// End-to-end check on a disposable host with the Compendium, Engine, Character
// Sheets and this add-on installed through the normal review lifecycle. It uses
// the host's installed-suite fixtures, so it runs from a host checkout:
//
//   cp host-tests/installed-homebrew.browser.mts ../ttrpg-codex/frontend/test/browser/
//   cd ../ttrpg-codex && npm --workspace @ttrpg-codex/frontend run build
//   CODEX_ENGINE_ZIP=… CODEX_SHEETS_ZIP=… CODEX_COMPENDIUM_ZIP=… \
//   CODEX_HOMEBREW_ZIP=…/dist/dnd-homebrew-1.0.0.zip CODEX_HOMEBREW_ROOT=…/addon-dnd-homebrew \
//     node --test frontend/test/browser/installed-homebrew.browser.mts
//
// CODEX_HOMEBREW_ROOT must hold a built web/ (npm run build) and the examples.
// The card property checks need D&D Engine 5.4.0 or later.
import { required } from "./fixture-types.mts";
import type { APIRequestContext } from "playwright";
import type { AddressInfo } from "node:net";
import type { ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdir, mkdtemp, rm, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createServer } from "node:net";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";
import { request as playwrightRequest } from "playwright";
import { jsonResponse, installReviewedPackage, enableAllRuleSources } from "./installed-graph-fixture.mts";

const homebrewRoot = required(process.env.CODEX_HOMEBREW_ROOT);
const model = (await import(pathToFileURL(resolve(homebrewRoot, "web/model.js")).href)) as {
  planPublish: (classes: unknown[], items: unknown[], published: Map<string, unknown>, meta: unknown, now: number) => {
    problems: unknown[];
    mutations: { dataId: string; key: string; expectedRevision: number; value?: unknown; operation: string }[];
  };
  parsePublished: (value: unknown) => unknown;
};
const paths = [process.env.CODEX_ENGINE_ZIP, process.env.CODEX_SHEETS_ZIP, process.env.CODEX_COMPENDIUM_ZIP, process.env.CODEX_HOMEBREW_ZIP];
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = resolve(root, "frontend/test-results/installed-homebrew");
let directory: string,
  host: ChildProcessByStdio<null, Readable, Readable>,
  dm: APIRequestContext,
  player: APIRequestContext,
  dmCsrf: string,
  playerCsrf: string,
  hostOutput = "";

before(async () => {
  const [engine, sheets, compendium, homebrew] = await Promise.all(paths.map((path) => readFile(resolve(required(path)))));
  await mkdir(output, { recursive: true });
  directory = await mkdtemp(resolve(output, "host-"));
  const binary = resolve(directory, "codex");
  await promisify(execFile)("go", ["build", "-o", binary, "./cmd/codex"], { cwd: root, timeout: 300_000 });
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = (probe.address() as AddressInfo).port;
  await new Promise((done) => probe.close(done));
  host = spawn(binary, ["-listen", `127.0.0.1:${port}`, "-data-dir", resolve(directory, "data"), "-web-dir", resolve(root, "frontend/dist")], {
    cwd: root,
    env: { ...process.env, CODEX_DM_PASSWORD: "local-homebrew-dm", CODEX_PLAYER_PASSWORD: "local-homebrew-player" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  host.stdout.on("data", (chunk) => (hostOutput += chunk));
  host.stderr.on("data", (chunk) => (hostOutput += chunk));
  dm = await playwrightRequest.newContext({ baseURL: `http://127.0.0.1:${port}` });
  player = await playwrightRequest.newContext({ baseURL: `http://127.0.0.1:${port}` });
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    try {
      ready = (await dm.get("/api/health")).ok();
    } catch {
      /* Startup. */
    }
    if (!ready) await sleep(100);
  }
  assert.ok(ready, hostOutput);
  dmCsrf = (await jsonResponse(await dm.post("/api/login", { data: { password: "local-homebrew-dm" } }))).csrfToken;
  playerCsrf = (await jsonResponse(await player.post("/api/login", { data: { password: "local-homebrew-player" } }))).csrfToken;
  await installReviewedPackage(dm, dmCsrf, "dnd-2024-compendium", compendium, []);
  await enableAllRuleSources(dm, dmCsrf);
  await installReviewedPackage(dm, dmCsrf, "dnd-engine", engine, []);
  await installReviewedPackage(dm, dmCsrf, "dnd-sheets", sheets, []);
  await installReviewedPackage(dm, dmCsrf, "dnd-homebrew", homebrew, []);
});
after(async () => {
  await dm?.dispose();
  await player?.dispose();
  if (host && host.exitCode === null) {
    const closed = once(host, "close");
    host.kill();
    await closed;
  }
  if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function generation(id: string): Promise<string> {
  return (await jsonResponse(await dm.get(`/api/admin/addons/${id}`))).state.activeGenerationId;
}
async function connect(request: APIRequestContext, csrf: string, addon: string, body: Record<string, unknown>) {
  const base = `/api/addons/${addon}/generations/${await generation(addon)}/services`;
  const connection = await jsonResponse(
    await request.post(`${base}/connect`, { headers: { "X-Codex-CSRF": csrf }, data: { contractVersion: "addon-service-connect.v1", ...body } }),
  );
  return async (method: string, params: unknown, idempotencyKey?: string) => {
    const target = connection.providers[0];
    assert.ok(target, `no provider for ${JSON.stringify(body)}: ${JSON.stringify(connection)}`);
    const response = await request.post(`${base}/call`, {
      headers: { "X-Codex-CSRF": csrf },
      data: {
        contractVersion: "addon-service-call.v1",
        contract: connection.contract,
        providerAddonId: target.addonId,
        providerVersion: target.contractVersion,
        providerGeneration: target.generation,
        bindingRevision: target.bindingRevision,
        method,
        params,
        deadlineMs: 30000,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    });
    return { status: response.status(), body: JSON.parse(await response.text()) };
  };
}
const engineAs = (request: APIRequestContext, csrf: string) =>
  connect(request, csrf, "dnd-sheets", { contract: "dnd5e.rules-engine", range: "^5.0.0", cardinality: "one" });

async function data(operation: string, body: Record<string, unknown>) {
  return jsonResponse(
    await dm.post(`/api/addons/dnd-homebrew/generations/${await generation("dnd-homebrew")}/data/${operation}`, {
      headers: { "X-Codex-CSRF": dmCsrf },
      data: body,
    }),
  );
}
async function all(dataId: string) {
  const page = await data("query", { contractVersion: "addon-data-query.v1", kind: "collection", dataId, limit: 200, where: [], includeDataRevision: true });
  assert.equal(page.nextCursor, undefined);
  return page as { documents: { key: string; revision: number; value: unknown }[]; dataRevision: number };
}
/** The browser's Publish, through the same planner and a guarded transaction. */
async function publish(): Promise<number> {
  const [classes, items, published, meta] = await Promise.all(["homebrew_classes", "homebrew_items", "homebrew_published", "homebrew_meta"].map(all));
  const plan = model.planPublish(
    classes!.documents.map((document) => document.value),
    items!.documents.map((document) => document.value),
    new Map(published!.documents.map((document) => [document.key, { value: model.parsePublished(document.value), revision: document.revision }])),
    meta!.documents[0] ? { value: meta!.documents[0].value, revision: meta!.documents[0].revision } : undefined,
    Date.now(),
  );
  assert.deepEqual(plan.problems, []);
  if (plan.mutations.length === 0) return 0;
  await data("transactions", {
    contractVersion: "addon-data-transaction.v1",
    expectedDataSets: [classes, items, published, meta].map((set, index) => ({
      kind: "collection",
      dataId: ["homebrew_classes", "homebrew_items", "homebrew_published", "homebrew_meta"][index],
      revision: set!.dataRevision,
    })),
    mutations: plan.mutations.map((mutation) => ({ ...mutation, kind: "collection" })),
  });
  return plan.mutations.length;
}

function inputs(inventory: unknown[]) {
  return {
    contractVersion: "rules-character.v2",
    inputs: {
      build: {
        method: "array",
        baseScores: { STR: 15, DEX: 13, CON: 14, INT: 12, WIS: 10, CHA: 8 },
        rolls: [],
        species: "dwarf",
        lineage: "",
        background: "soldier",
        levels: Array.from({ length: 3 }, (_, i) => ({ id: `level-${i + 1}`, classId: "fighter" })),
        subclasses: {},
        choices: [],
        spells: { cantrips: {}, spellbook: {}, grantChoices: {}, castingAbilities: {}, swaps: [], acquisitions: [] },
      },
      play: { hp: 0, temporaryHp: 0, inventory, currency: {}, resourceUses: {}, activeFeatures: {}, preparedSpells: {}, rolls: [], asOf: "2026-10-21T00:00:00Z" },
      grants: [],
    },
  };
}
const card = (id: string, extra: Record<string, unknown> = {}) => ({
  id: `inv-${id}`,
  reference: { kind: "magic-item", id },
  name: id,
  quantity: 1,
  location: "equipped",
  attuned: false,
  acquisition: "",
  notes: "",
  ...extra,
});
type Evaluation = {
  identity: { contentRevision: string };
  evaluation: { inputs: unknown; sheet: Record<string, any>; spellOptions: Record<string, any>; issues: { id: string; severity: string }[] };
};

void test("the DM imports the cursed cards through the add-on's own worker", async () => {
  const importer = await connect(dm, dmCsrf, "dnd-homebrew", { contract: "codex.import-adapter", own: true });
  const document = JSON.parse(await readFile(resolve(homebrewRoot, "docs/examples/cursed-cards.json"), "utf8"));
  const preview = await importer("preview", { contractVersion: "import-preview.v1", format: "dnd-homebrew-items", document });
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.deepEqual(preview.body.result.summary, { creates: 45, updates: 0, skips: 0, deletes: 0 });
  const commit = await importer("commit", { contractVersion: "import-commit.v1", token: preview.body.result.token }, "import-1");
  assert.equal(commit.status, 200, JSON.stringify(commit.body));
  assert.equal((await all("homebrew_items")).documents.length, 44);
  const playerImporter = await connect(player, playerCsrf, "dnd-homebrew", { contract: "codex.import-adapter", own: true });
  const refused = await playerImporter("describe", {});
  assert.notEqual(refused.status, 200, "a player must not use the importer");
});

void test("published cards apply on DM and player sheets", async () => {
  const dmEngine = await engineAs(dm, dmCsrf);
  const before = (await dmEngine("query-records", { contractVersion: "rules-engine-query.v1", kind: "magic-item", limit: 200 })).body.result;
  assert.equal(before.records.filter((record: { id: string }) => record.id.startsWith("hb.")).length, 0, "drafts reached the engine");
  assert.equal(await publish(), 45);
  const records: { id: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = (await dmEngine("query-records", { contractVersion: "rules-engine-query.v1", kind: "magic-item", limit: 200, ...(cursor ? { cursor } : {}) })).body.result;
    records.push(...page.records);
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(records.filter((record) => record.id.startsWith("hb.")).length, 44);
  assert.ok(records.some((record) => record.id === "ring-of-protection"), "compendium items are still there");

  for (const [request, csrf] of [[dm, dmCsrf], [player, playerCsrf]] as const) {
    const evaluate = await engineAs(request, csrf);
    const plain = (await evaluate("evaluate-character", inputs([]))).body.result as Evaluation;
    const call = await evaluate("evaluate-character", inputs([card("hb.defense"), card("hb.knowledge"), card("hb.mindfulness"), card("hb.growth-of-energy"), card("hb.destiny")]));
    assert.equal(call.status, 200, JSON.stringify(call.body));
    const equipped = call.body.result as Evaluation;
    const sheet = equipped.evaluation.sheet, base = plain.evaluation.sheet;
    assert.equal(sheet.derived.armorClass, base.derived.armorClass + 1);
    assert.equal(sheet.derived.maxHp, base.derived.maxHp + 5);
    assert.equal(sheet.abilities.INT.score, Math.min(20, base.abilities.INT.score + 1));
    assert.equal(sheet.skills.insight.proficient, true);
    const itemIssues = equipped.evaluation.issues.filter((issue) => /^(item-|placement-)/u.test(issue.id));
    assert.deepEqual(itemIssues, [], "cards must not raise item blockers");
  }
});

void test("card properties reach the sheet: an advantage, an item spell, a use and Fate-Touched", async () => {
  const engine = await engineAs(dm, dmCsrf);
  const call = await engine("evaluate-character", inputs([card("hb.resilience"), card("hb.divine-guidance"), card("hb.good-fortune")]));
  assert.equal(call.status, 200, JSON.stringify(call.body));
  const result = (call.body.result as Evaluation).evaluation;
  const fromItem = (entry: any, id: string) => entry?.source?.type === "item" && entry.source.id === `inv-hb.${id}`;
  const blockers = (issues: { id: string; severity: string }[]) => issues.filter((issue) => issue.severity === "blocker").map((issue) => issue.id).sort();
  const bare = ((await engine("evaluate-character", inputs([]))).body.result as Evaluation).evaluation;
  assert.deepEqual(blockers(result.issues), blockers(bare.issues), "equipping cards adds no blockers to the unfinished test build");
  assert.ok(result.sheet.advantages?.some((entry: any) => entry.on === "deathSave" && fromItem(entry, "resilience")), JSON.stringify(result.sheet.advantages));
  assert.equal(result.sheet.deathSaveAdvantage, true);
  const fortune = result.sheet.resources.find((entry: any) => fromItem(entry, "good-fortune"));
  assert.equal(fortune?.max, 1, JSON.stringify(result.sheet.resources));
  const fate = result.sheet.conditions?.find((row: any) => row.id === "fate-touched");
  assert.equal(fate?.level, 3, JSON.stringify(result.sheet.conditions));
  assert.equal(fate?.granted, true);

  // Play changes need a finished build, which this fixture is not; the Engine's
  // own tests cast item spells. Here the card only has to offer its choice.
  const choice = result.spellOptions.castingAbilityChoices.find((entry: any) => fromItem(entry, "divine-guidance"));
  assert.deepEqual(choice?.options, ["INT", "WIS", "CHA"], JSON.stringify(result.spellOptions.castingAbilityChoices));
});

void test("a republish changes the rules identity and a withdrawn card blocks its holder", async () => {
  const evaluate = await engineAs(dm, dmCsrf);
  const before = (await evaluate("evaluate-character", inputs([card("hb.luna")]))).body.result as Evaluation;
  const items = await all("homebrew_items");
  const luna = items.documents.find((document) => document.key === "luna")!;
  await data("transactions", {
    contractVersion: "addon-data-transaction.v1",
    mutations: [{ operation: "delete", kind: "collection", dataId: "homebrew_items", key: "luna", expectedRevision: luna.revision }],
  });
  assert.equal(await publish(), 2, "one withdrawal and the metadata");
  const after = (await evaluate("evaluate-character", inputs([card("hb.luna")]))).body.result as Evaluation;
  assert.notEqual(after.identity.contentRevision, before.identity.contentRevision);
  assert.ok(after.evaluation.issues.some((issue) => issue.id === "item-source:inv-hb.luna" && issue.severity === "blocker"), JSON.stringify(after.evaluation.issues));
  assert.equal(await publish(), 0, "an unchanged publish writes nothing");
});

void test("the real UI edits, publishes and shows the gallery", async () => {
  const { chromium } = await import("playwright");
  const shots = process.env.HOMEBREW_SHOTS;
  const browser = await chromium.launch();
  try {
    const errors: string[] = [];
    const page = await (await browser.newContext({ storageState: await dm.storageState(), viewport: { width: 1360, height: 950 } })).newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${(await dm.get("/api/health")).url().replace("/api/health", "")}/#/addons/dnd-homebrew/homebrew`);
    await page.getByRole("heading", { name: "Homebrew Items" }).waitFor();
    assert.equal(await page.locator('a[href="#/addons/dnd-homebrew/homebrew"]').count(), 1);
    await page.getByRole("button", { name: /^Defense/u }).click();
    await page.locator(".hb-effect-row").first().waitFor();
    if (shots) await page.screenshot({ path: `${shots}/ui-editor.png`, fullPage: true });
    const description = page.locator('textarea[name="text"]');
    await description.fill("+1 permanent bonus to Armor Class while you carry this card.");
    await page.locator(".hb-editor-actions").getByRole("button", { name: "Save" }).click();
    await page.getByText("Unpublished changes: 1.").waitFor();
    await page.getByRole("button", { name: "Publish changes (1)" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Cursed Card: Defense").waitFor();
    if (shots) await page.screenshot({ path: `${shots}/ui-publish.png` });
    await dialog.getByRole("button", { name: "Publish" }).click();
    await page.getByText("Everything is published.").waitFor();
    const published = (await all("homebrew_published")).documents.find((document) => document.key === "hb.defense")!;
    assert.match(JSON.stringify(published.value), /while you carry this card/u);

    const playerPage = await (await browser.newContext({ storageState: await player.storageState(), viewport: { width: 1360, height: 950 } })).newPage();
    playerPage.on("pageerror", (error) => errors.push(error.message));
    const origin = (await player.get("/api/health")).url().replace("/api/health", "");
    await playerPage.goto(`${origin}/#/addons/dnd-homebrew/homebrew-gallery`);
    await playerPage.getByText("No items have been revealed yet.").waitFor();
    assert.equal(await playerPage.locator('a[href="#/addons/dnd-homebrew/homebrew-gallery"]').count(), 1);
    assert.equal(await playerPage.locator('a[href="#/addons/dnd-homebrew/homebrew"]').count(), 0);
    await playerPage.goto(`${origin}/#/addons/dnd-homebrew/homebrew-gallery?id=hb.defense`);
    await playerPage.locator(".hb-card.focused").getByText("Cursed Card: Defense").waitFor();
    if (shots) await playerPage.screenshot({ path: `${shots}/ui-gallery.png`, fullPage: true });
    await playerPage.goto(`${origin}/#/addons/dnd-homebrew/homebrew`);
    await playerPage.waitForTimeout(500);
    assert.equal(await playerPage.locator(".hb-tree").count(), 0, "players must not reach the DM editor");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
