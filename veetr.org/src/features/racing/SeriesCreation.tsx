import React, { useRef, useState } from "react";
import { id, newSeries, validateSeries, type Series } from "./domain";
import { t } from "./i18n";
import { appHref } from "./routes";

export function seriesFromForm(data: FormData): Series {
  const name = String(data.get("name") ?? "").trim();
  const year = Number(data.get("year"));
  const names = String(data.get("categories") ?? "")
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);
  if (!name) throw new Error("Enter a series name.");
  if (!Number.isInteger(year) || year < 1900 || year > 2200)
    throw new Error("Enter a year between 1900 and 2200.");
  if (!names.length || new Set(names).size !== names.length)
    throw new Error(
      "Enter at least one category, with a different name on each line.",
    );
  const series = {
    ...newSeries(name, year),
    description: String(data.get("description") ?? "").trim(),
    status: String(data.get("status")) as Series["status"],
    categories: names.map((name) => ({ id: id(), name })),
  };
  validateSeries(series);
  return series;
}

export function SeriesCreation({
  onCreate,
}: {
  onCreate: (series: Series) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submitting = useRef(false);
  return (
    <>
      <h1>{t("New series")}</h1>
      <form
        className="series-creation-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitting.current) return;
          const data = new FormData(event.currentTarget);
          submitting.current = true;
          setBusy(true);
          setError("");
          try {
            await onCreate(seriesFromForm(data));
          } catch (error) {
            setError(error instanceof Error ? error.message : String(error));
          } finally {
            submitting.current = false;
            setBusy(false);
          }
        }}
      >
        {error && <p role="alert">{t(error)}</p>}
        <fieldset disabled={busy}>
          <label>
            {t("Name")}
            <input name="name" required autoFocus />
          </label>
          <label>
            {t("Year")}
            <input
              name="year"
              type="number"
              min="1900"
              max="2200"
              required
              defaultValue={new Date().getFullYear()}
            />
          </label>
          <label>
            {t("Description")}
            <textarea name="description" rows={3} />
          </label>
          <label>
            {t("Status")}
            <select name="status" defaultValue="draft">
              <option value="draft">{t("draft")}</option>
              <option value="active">{t("active")}</option>
              <option value="completed">{t("completed")}</option>
            </select>
          </label>
          <label>
            {t("Categories (one per line)")}
            <textarea name="categories" rows={3} required />
          </label>
        </fieldset>
        <div className="form-actions">
          <button className="primary" disabled={busy}>
            {t(busy ? "Saving…" : "Create series")}
          </button>
          {!busy && <a href={appHref("/")}>{t("Cancel")}</a>}
        </div>
      </form>
    </>
  );
}
