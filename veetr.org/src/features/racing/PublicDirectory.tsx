import { appHref } from "./routes";
import { t } from "./i18n";
import { useEffect, useState } from "react";
import { listPublicSeries, type PublicSeriesSummary } from "./api";
export function PublicDirectory() {
  const [series, setSeries] = useState<PublicSeriesSummary[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      listPublicSeries()
        .then((rows) => {
          if (alive) {
            setSeries(rows);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    void refresh();
    const timer = setInterval(refresh, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const filtered = series.filter((s) =>
    `${s.name} ${s.year}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <section className="public-directory">
      <h1>{t("Racing on record.")}</h1>
      <p>
        {t(
          "Follow published regatta results, explore the fleet, and see how the series unfolds.",
        )}
      </p>
      <label>
        {t("Find a series")}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Series name or year")}
        />
      </label>
      {loading ? (
        <p role="status">{t("Loading published series…")}</p>
      ) : error ? (
        <p role="status">{t(error)}</p>
      ) : (
        <>
          <div className="public-series-grid">
            {filtered.map((s) => (
              <a
                className="public-series-card"
                href={appHref(`?public=${s.id}`)}
                key={s.id}
              >
                <span className="eyebrow">
                  {s.year} · {t(s.status)}
                </span>
                <h2>{s.name}</h2>
                <p>{s.description || t("Sailing series")}</p>
                <span>
                  {s.raceCount} {t("published races ·")}
                  {s.boatCount} {t("boats")}
                </span>
              </a>
            ))}
          </div>
          {!filtered.length && (
            <p>
              {query
                ? t("No published series match your search.")
                : t(
                    "No races have been published yet. Check back after the committee publishes results.",
                  )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
