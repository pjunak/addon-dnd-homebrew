import { fill, type Problem } from "./model.js";
import type { AddonContext } from "./sdk.js";

/** The host's ui.i18n; Homebrew's texts live in locales/*.json. */
export type I18n = AddonContext["i18n"];
export type Translator = (
  text: string,
  params?: Readonly<Record<string, string | number>>,
) => string;

/** The reader's language from a contribution's host context; English until the host says. */
export function hostLocale(host: unknown): string {
  return typeof host === "object" &&
    host !== null &&
    "locale" in host &&
    typeof host.locale === "string"
    ? host.locale
    : "en";
}
/**
 * Messages are keyed by their English text, so without a translator (in models
 * and tests) or for text no catalog can hold, the English shows.
 */
export function translator(i18n?: I18n): Translator {
  return (text, params = {}) =>
    i18n && text.length > 0 && text.length <= 500 ? i18n.t(text, params) : fill(text, params);
}
export function problemText(t: Translator, problem: Problem): string {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(problem.params ?? {}))
    params[key] = typeof value === "string" && key === "problem" ? t(value) : value;
  return t(problem.text, params);
}
