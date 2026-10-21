// The host's public browser types live unchanged in src/codex/ (copied and
// checked by tools/codex-sdk.mts). This module only names them for this add-on.
export type {
  AddonContext,
  AddonDocument,
  CommitReceipt,
  DataChange,
  DataHandle as CollectionHandle,
  DataMutation,
  DataSetRevision,
  Disposable,
  QueryResult,
  ServiceHandle,
  ContributionElementContext as ContributionContext,
} from "./codex/browser-sdk.js";
