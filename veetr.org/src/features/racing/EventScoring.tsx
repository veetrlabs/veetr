import {appHref} from "./routes";
import { t } from "./i18n";
import React from "react";
import {
  type Series,
  type DiscardRule,
  eventsFor,
  standingsForView,
  seriesRounds,
} from "./domain";
import { BoatName } from "./BoatName";
export function Discards({
  value,
  onChange,
  label,
}: {
  value: DiscardRule[];
  onChange: (rules: DiscardRule[]) => void;
  label: string;
}) {
  return (
    <div>
      <h3>{label}</h3>
      <p>
        {t(
          "Without a rule, no scores are discarded. Thresholds use the number of completed heats or races.",
        )}
      </p>
      {value.map((r, i) => (
        <div className="inline" key={i}>
          <label>
            {t("From completed count")}
            <input
              type="number"
              min="1"
              value={r.from}
              onChange={(e) =>
                onChange(
                  value.map((v, j) =>
                    j === i ? { ...v, from: Number(e.target.value) } : v,
                  ),
                )
              }
            />
          </label>
          <label>
            {t("Discard")}
            <input
              type="number"
              min="0"
              value={r.discard}
              onChange={(e) =>
                onChange(
                  value.map((v, j) =>
                    j === i ? { ...v, discard: Number(e.target.value) } : v,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            {t("Remove threshold")}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...value,
            { from: Math.max(0, ...value.map((r) => r.from)) + 4, discard: 1 },
          ])
        }
      >
        {t("Add threshold")}
      </button>
    </div>
  );
}
export function EventStandings({
  series,
  categoryId = "",
  boatId,
  publicLinks=false,
}: {
  series: Series;
  categoryId?: string;
  boatId?: string;
  publicLinks?: boolean;
}) {
  const rows = standingsForView(series, categoryId);
  const rounds = seriesRounds(series, categoryId);
  const columns = eventsFor(series)
    .filter(event => event.scheduleStatus !== "Cancelled")
    .sort((a, b) => a.order - b.order)
    .map(event => ({
      id: event.id,
      name: event.name,
      rounds: rounds.filter(round => round.eventId === event.id),
    }));
  const rules = series.discards ?? [];
  return (
    <section id="standings">
      <h2>{t("Series standings")}</h2>
      <p>
        {rules.length
          ? rules
              .map((r) =>
                t(
                  "Discard {discard} after {from} completed races",
                  { from: r.from, discard: r.discard },
                ),
              )
              .join(" · ")
          : t("No discards")}
        {t(". Live standings are provisional.")}
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("Rank")}</th>
              <th>{t("Boat")}</th>
              {columns.map((c) => (
                <th key={c.id}>{publicLinks ? <a href={appHref(`?public=${series.id}&event=${c.id}`)}>{c.name}</a> : c.name}{c.rounds.length > 1 ? ` ×${c.rounds.length}` : ""}</th>
              ))}
              <th>{t("Raw total")}</th>
              <th>{t("Counted total")}</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((row) => !boatId || row.id === boatId)
              .map((row) => (
                <tr key={row.id}>
                  <td>{row.rank || "—"}</td>
                  <th>
                    <BoatName
                      boat={series.boats.find((b) => b.id === row.id)!}
                    />
                  </th>
                  {columns.map((c) => (
                    <td key={c.id} style={{ whiteSpace: "nowrap" }}>
                      {c.rounds.map((round, index) => (
                        <React.Fragment key={round.id}>
                          {index > 0 && " + "}
                          <span className={row.discardedRaceIds.includes(round.id) ? "discarded" : undefined}>
                            {row.scores.find(score => score.raceId === round.id)?.points ?? "—"}
                          </span>
                        </React.Fragment>
                      ))}
                    </td>
                  ))}
                  <td>{row.rawTotal}</td>
                  <td className="counted">{row.countedTotal}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p>
        {series.pointsStart === 0 ? t("Imported series: category rank minus one; 24h counts twice. Unknown dates and missing results are left blank.") : t(
              "Series points are race rank × race weight. Races marked completed count toward the discard threshold.",
            )}{" "}
        {t("Red crossed-out scores do not count.")}
      </p>
    </section>
  );
}
