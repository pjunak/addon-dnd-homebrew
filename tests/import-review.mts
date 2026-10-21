import test from "node:test";
import assert from "node:assert/strict";
import { parseImportCommit, parseImportPreview } from "#web/import-review";

const preview = {
  contractVersion: "import-preview-result.v1",
  token: "t".repeat(32),
  format: "dnd-homebrew-items",
  mode: "merge",
  summary: { creates: 2, updates: 0, skips: 1, deletes: 0 },
  warnings: ["Imported items are drafts."],
  changes: [{ collection: "homebrew_items", id: "luna", operation: "create", label: "Luna" }],
};

void test("worker previews are validated before they are shown", () => {
  assert.equal(parseImportPreview(preview).changes[0]!.label, "Luna");
  for (const broken of [
    { ...preview, contractVersion: "import-preview-result.v2" },
    { ...preview, token: "short" },
    { ...preview, summary: { ...preview.summary, creates: -1 } },
    { ...preview, changes: [{ ...preview.changes[0], operation: "rename" }] },
    { ...preview, warnings: ["x".repeat(501)] },
  ])
    assert.throws(() => parseImportPreview(broken));
});

void test("commit receipts are validated", () => {
  assert.deepEqual(
    parseImportCommit({
      contractVersion: "import-commit-result.v1",
      committed: true,
      writes: 3,
      deletes: 1,
    }),
    { writes: 3, deletes: 1 },
  );
  assert.throws(() =>
    parseImportCommit({
      contractVersion: "import-commit-result.v1",
      committed: false,
      writes: 0,
      deletes: 0,
    }),
  );
});
