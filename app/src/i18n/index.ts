import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import en from "./en.json";
import cs from "./cs.json";

export type Language = "en" | "cs";
export type LanguagePreference = "system" | Language;
export const LANGUAGE_STORAGE_KEY = "@veetr_language";
export const resources = { en: { translation: en }, cs: { translation: cs } };

// Initialize without native dependencies so helpers also work in tests and on web.
// Source sentences are keys; punctuation is literal and English is the fallback.
export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "cs"],
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  initAsync: false,
  react: { useSuspense: false },
});

export function validPreference(value: unknown): LanguagePreference {
  return value === "en" || value === "cs" ? value : "system";
}

export function resolveLanguage(
  preference: LanguagePreference,
  locales: readonly string[],
): Language {
  if (preference !== "system") return preference;
  for (const locale of locales) {
    const language = locale.toLowerCase().split(/[-_]/)[0];
    if (language === "en" || language === "cs") return language;
  }
  return "en";
}

/** Stable translator for event handlers and non-React presentation helpers. */
export function t(key: string, values?: Record<string, unknown>): string {
  return String(i18n.t(key, values ?? {}));
}

/** Subscribe without changing handler identity or restarting recording effects. */
export function useLanguageRefresh(): Language {
  useTranslation("translation", { i18n });
  return i18n.resolvedLanguage === "cs" ? "cs" : "en";
}

export function locale(): string {
  return i18n.resolvedLanguage === "cs" ? "cs-CZ" : "en-GB";
}

const numberFormats = new Map<string, Intl.NumberFormat>();
export function formatNumber(value: number, decimals = 0): string {
  const language = locale(),
    key = `${language}:${decimals}`;
  let formatter = numberFormats.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(language, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: false,
    });
    numberFormats.set(key, formatter);
  }
  return formatter.format(value);
}

// Stored and native errors stay in their original language for classification and
// diagnostics. Translate recognized application messages only at presentation.
const messageTemplates = Object.keys(en)
  .filter((key) => key.includes("{{"))
  .map((key) => {
    const names: string[] = [];
    const pattern = key
      .split(/(\{\{\w+\}\})/)
      .map((part) => {
        if (/^\{\{\w+\}\}$/.test(part)) {
          names.push(part.slice(2, -2));
          return "([\\s\\S]*?)";
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    return { key, names, pattern: new RegExp(`^${pattern}$`) };
  });
export function translateMessage(message: string): string {
  if (Object.prototype.hasOwnProperty.call(en, message)) return t(message);
  for (const { key, names, pattern } of messageTemplates) {
    const match = pattern.exec(message);
    if (match)
      return t(
        key,
        Object.fromEntries(
          names.map((name, index) => [
            name,
            translateMessage(match[index + 1]),
          ]),
        ),
      );
  }
  return message;
}
