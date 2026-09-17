import { useEffect, useState } from "react";
import { listOwnedSeries, type OwnedSeries } from "./api";
import { appHref } from "./routes";
import { t } from "./i18n";

export function MySeries({ userId }: { userId: string }) {
  const [series, setSeries] = useState<OwnedSeries[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const rows = await listOwnedSeries(userId);
        if (active) { setSeries(rows); setError(""); }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [userId]);
  return <section className="my-series" aria-labelledby="my-series-title">
    <h2 id="my-series-title">{t("My series")}</h2>
    <p>{t("Series you own. Open a series to manage its fleet and invite skippers.")}</p>
    {error ? <p role="alert">{t(error)}</p> : series === null ? <p role="status">{t("Loading your series…")}</p> : !series.length ? <p>{t("You do not own any series yet.")}</p> :
      <ul className="team-list">{series.map(s => <li key={s.id}>
        <a href={appHref(`?series=${s.id}`)}>{s.name}</a>
        <span>{s.year}</span>
      </li>)}</ul>}
  </section>;
}
