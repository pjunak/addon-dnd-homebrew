import { compare, type Published } from "./model.js";
import type { PublishedState } from "./repository.js";

/**
 * Records the gallery lists and wiki search offers: revealed, current ones.
 * Visibility is presentation, not secrecy; served records are readable by
 * every player's sheet, and an unrevealed card simply stays unpublished.
 */
export function revealed(state: PublishedState): Published[] {
  return [...state.records.values()]
    .map((entry) => entry.value)
    .filter((record) => record.playerVisible && !record.retired && !record.withdrawn)
    .sort(
      (left, right) =>
        compare(fold(left.setName), fold(right.setName)) ||
        compare(fold(left.record.name), fold(right.record.name)),
    );
}
/** A record a sheet may still hold: anything published and not withdrawn. */
export function served(state: PublishedState, id: string): Published | undefined {
  const record = state.records.get(id)?.value;
  return record && !record.withdrawn ? record : undefined;
}
export function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase();
}
/** Plain text for previews that cannot render Markdown. */
export function plainText(markdown: string, limit: number): string {
  return markdown
    .replace(/[#*_`>\r\n]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, limit);
}
