import React from "react";
import { t } from "./i18n";
import { appHref } from "./routes";

export function isPublicNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error &&
    (error.code === "PT404" || error.code === "22P02"));
}

export function PublicNotFound() {
  return <section role="status">
    <h1>{t("404 — Not found")}</h1>
    <p>{t("This series or race is not available.")}</p>
    <a href={appHref("/")}>{t("Back to races")}</a>
  </section>;
}
