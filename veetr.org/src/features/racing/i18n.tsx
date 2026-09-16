import { useSyncExternalStore } from "react";
import { cs, en } from "./translations";
export type Language = "cs" | "en";
const storageKey = "veetr.language";
export function detectLanguage(
  languages: readonly string[],
  saved?: string | null,
): Language {
  if (saved === "cs" || saved === "en") return saved;
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0];
    if (base === "cs" || base === "en") return base;
  }
  return "en";
}
function initialLanguage(): Language {
  try {
    return detectLanguage(
      navigator.languages,
      localStorage.getItem(storageKey),
    );
  } catch {
    return typeof navigator === "undefined"
      ? "en"
      : detectLanguage(navigator.languages);
  }
}
let language = initialLanguage();
const listeners = new Set<() => void>();
export function setLanguage(next: Language) {
  language = next;
  try {
    localStorage.setItem(storageKey, next);
  } catch {
    /* In-memory selection works without storage. */
  }
  if (typeof document !== "undefined") document.documentElement.lang = next;
  listeners.forEach((notify) => notify());
}
export function useLanguage() {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    () => language,
  );
}
export function t(
  key: string,
  values: Record<string, string | number> = {},
): string {
  const dictionary = language === "cs" ? cs : en;
  return (dictionary[key] ?? key).replace(/\{(\w+)\}/g, (match, name) =>
    String(values[name] ?? match),
  );
}
export function LanguageSelector() {
  const current = useLanguage();
  return (
    <select
      className="language-selector"
      aria-label={t("Language")}
      value={current}
      onChange={(e) => setLanguage(e.target.value as Language)}
    >
      <option value="cs" lang="cs">
        Čeština
      </option>
      <option value="en" lang="en">
        English
      </option>
    </select>
  );
}
if (typeof document !== "undefined") document.documentElement.lang = language;
