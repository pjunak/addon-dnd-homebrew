import { HomebrewError, isRecord, type ImportChange, type ImportSummary } from "./model.js";

export interface ImportPreview {
  readonly token: string;
  readonly summary: ImportSummary;
  readonly warnings: readonly string[];
  readonly changes: readonly ImportChange[];
}
const count = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const text = (value: unknown, limit: number): value is string =>
  typeof value === "string" && value.length <= limit;

/** Validates the worker's import-preview-result.v1 before it is shown. */
export function parseImportPreview(value: unknown): ImportPreview {
  const invalid = () => new HomebrewError("The import could not be previewed.");
  if (!isRecord(value) || value["contractVersion"] !== "import-preview-result.v1") throw invalid();
  const { token, summary, warnings, changes } = value;
  if (
    !text(token, 200) ||
    token.length < 20 ||
    !isRecord(summary) ||
    !Array.isArray(warnings) ||
    !Array.isArray(changes)
  )
    throw invalid();
  if (
    !count(summary["creates"]) ||
    !count(summary["updates"]) ||
    !count(summary["skips"]) ||
    !count(summary["deletes"])
  )
    throw invalid();
  if (warnings.length > 100 || !warnings.every((warning) => text(warning, 500))) throw invalid();
  if (changes.length > 256) throw invalid();
  const parsed = changes.map((change: unknown): ImportChange => {
    if (
      !isRecord(change) ||
      !text(change["collection"], 100) ||
      !text(change["id"], 120) ||
      !text(change["label"], 200) ||
      (change["operation"] !== "create" &&
        change["operation"] !== "update" &&
        change["operation"] !== "delete")
    )
      throw invalid();
    return {
      collection: change["collection"],
      id: change["id"],
      label: change["label"],
      operation: change["operation"],
    };
  });
  return {
    token,
    summary: {
      creates: summary["creates"],
      updates: summary["updates"],
      skips: summary["skips"],
      deletes: summary["deletes"],
    },
    warnings: warnings as string[],
    changes: parsed,
  };
}

export function parseImportCommit(value: unknown): {
  readonly writes: number;
  readonly deletes: number;
} {
  if (
    !isRecord(value) ||
    value["contractVersion"] !== "import-commit-result.v1" ||
    value["committed"] !== true ||
    !count(value["writes"]) ||
    !count(value["deletes"])
  )
    throw new HomebrewError("The import could not be saved. Nothing was changed.");
  return { writes: value["writes"], deletes: value["deletes"] };
}
