import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./api";
import { t } from "./i18n";
import type { Json } from "./database.types";
import type { Polar } from "../../../../packages/shared/src/polar/model";
import { importPolar } from "../../../../packages/shared/src/polar/import";
import {
  polarCurve,
  polarWindColor,
  polarWindSpeeds,
} from "../../../../packages/shared/src/polar/diagram";

export type BoatSpecificationsData = {
  sailNumber?: string;
  manufacturer?: string;
  model?: string;
  variant?: string;
  waterlineLengthM?: number;
  draftM?: number;
  airDraftM?: number;
  beamM?: number;
  polar?: Polar;
};
const textFields = [
  ["sailNumber", "Sail number"],
  ["manufacturer", "Manufacturer"],
  ["model", "Model"],
  ["variant", "Variant / year"],
] as const;
const dimensions = [
  ["waterlineLengthM", "Waterline length (m)", 200],
  ["draftM", "Draft (m)", 30],
  ["airDraftM", "Height above waterline (m)", 200],
  ["beamM", "Beam (m)", 100],
] as const;
export const polarCsv = (polar?: Polar) =>
  polar
    ? [
        "TWS,TWA,speed",
        ...polar.points.map((p) => `${p.tws},${p.twa},${p.speed}`),
      ].join("\n")
    : "";
export function parseBoatPolar(
  csv: string,
  previous?: Polar,
): Polar | undefined {
  if (!csv.trim()) return undefined;
  const parsed = importPolar(csv, {
    id: crypto.randomUUID(),
    name: previous?.name ?? "Boat polar",
    source: "manual",
    version: "1",
    createdAt: new Date().toISOString(),
    speedBasis: previous?.speedBasis ?? "water",
  });
  // A public polar contains curve values, never trip identifiers or raw observations.
  return {
    id: parsed.id,
    name: parsed.name,
    source: parsed.source,
    version: parsed.version,
    createdAt: parsed.createdAt,
    speedBasis: parsed.speedBasis,
    points: parsed.points.map(({ tws, twa, speed }) => ({ tws, twa, speed })),
  };
}
export function BoatPolarChart({ polar }: { polar: Polar }) {
  const [hidden, setHidden] = useState<number[]>([]);
  const winds = useMemo(() => polarWindSpeeds(polar), [polar]);
  const max = Math.max(1, ...polar.points.map((p) => p.speed)) * 1.1;
  const scale = 140 / max;
  return (
    <div className="boat-polar">
      <svg
        viewBox="0 0 320 320"
        role="img"
        aria-label={t("Polar diagram")}
        style={{
          width: "100%",
          maxWidth: 680,
          display: "block",
          margin: "auto",
        }}
      >
        <title>{t("Polar diagram")}</title>
        {[1, 2, 3, 4].map((i) => (
          <g key={i}>
            <circle
              cx="160"
              cy="160"
              r={35 * i}
              fill="none"
              stroke="currentColor"
              opacity="0.2"
            />
            <text x="164" y={160 - 35 * i} fontSize="8" fill="currentColor">
              {((max * i) / 4).toFixed(1)} kn
            </text>
          </g>
        ))}
        {[0, 30, 60, 90, 120, 150].map((angle) => (
          <line
            key={angle}
            x1="160"
            y1="20"
            x2="160"
            y2="300"
            stroke="currentColor"
            opacity="0.15"
            transform={`rotate(${angle} 160 160)`}
          />
        ))}
        <text
          x="160"
          y="12"
          textAnchor="middle"
          fontSize="9"
          fill="currentColor"
        >
          0°
        </text>
        {winds
          .filter((w) => !hidden.includes(w))
          .map((w) => (
            <path
              key={w}
              d={polarCurve(polar, w, scale)}
              fill="none"
              stroke={polarWindColor(w, winds)}
              strokeWidth="1.5"
            />
          ))}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {winds.map((w) => (
          <button
            type="button"
            key={w}
            aria-pressed={!hidden.includes(w)}
            style={{
              color: polarWindColor(w, winds),
              borderColor: hidden.includes(w)
                ? "transparent"
                : polarWindColor(w, winds),
              background: "transparent",
              minHeight: 44,
            }}
            onClick={() =>
              setHidden((old) =>
                old.includes(w) ? old.filter((v) => v !== w) : [...old, w],
              )
            }
          >
            {w} kn
          </button>
        ))}
      </div>
    </div>
  );
}
export function BoatSpecifications({
  boatId,
  editable = false,
  onBusyChange,
}: {
  boatId: string;
  editable?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [saved, setSaved] = useState<BoatSpecificationsData>();
  const [draft, setDraft] = useState<BoatSpecificationsData>({});
  const [csv, setCsv] = useState("");
  const [polarError, setPolarError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!supabase) throw new Error("Connect to save boat details.");
      const { data, error } = await supabase.rpc("boat_specifications", {
        bid: boatId,
      });
      if (error) throw error;
      if (alive) {
        const specs = (data ?? {}) as BoatSpecificationsData;
        setSaved(specs);
        setDraft(specs);
        setCsv(polarCsv(specs.polar));
      }
    })().catch((e) => {
      if (alive) setError(e.message);
    });
    return () => {
      alive = false;
    };
  }, [boatId]);
  async function save(form: HTMLFormElement) {
    if (
      !saved ||
      pending.current ||
      polarError ||
      !form.reportValidity() ||
      JSON.stringify(draft) === JSON.stringify(saved)
    )
      return;
    pending.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      if (!supabase) throw new Error("Connect to save boat details.");
      const { error } = await supabase.rpc("save_boat_specifications", {
        bid: boatId,
        details: draft as unknown as Json,
        expected: saved as unknown as Json,
      });
      if (error) throw error;
      setSaved(draft);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <section className="boat-specifications">
      <h2>{t("Boat details")}</h2>
      {!saved ? (
        <p>{t("Loading boat…")}</p>
      ) : editable ? (
        <form
          className="edit-row"
          onSubmit={(e) => {
            e.preventDefault();
            void save(e.currentTarget);
          }}
          onBlur={(e) => {
            void save(e.currentTarget);
          }}
        >
          <p>
            {t(
              "Changes save automatically. These boat details and the polar chart are public.",
            )}
          </p>
          <fieldset disabled={busy}>
            {textFields.map(([key, label]) => (
              <label key={key}>
                {t(label)}
                <input
                  value={draft[key] ?? ""}
                  maxLength={120}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value || undefined })
                  }
                />
              </label>
            ))}
            {dimensions.map(([key, label, max]) => (
              <label key={key}>
                {t(label)}
                <input
                  type="number"
                  min="0.001"
                  max={max}
                  step="any"
                  value={draft[key] ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [key]: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </label>
            ))}
          </fieldset>
          <h3>{t("Polar diagram")}</h3>
          {draft.polar && <BoatPolarChart polar={draft.polar} />}
          <details>
            <summary>{t("Edit polar data")}</summary>
            <label>
              {t("Polar CSV")}
              <textarea
                value={csv}
                disabled={busy}
                rows={10}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                }}
                onChange={(e) => {
                  setCsv(e.target.value);
                  try {
                    setDraft({
                      ...draft,
                      polar: parseBoatPolar(e.target.value, saved.polar),
                    });
                    setPolarError("");
                  } catch (error) {
                    setPolarError((error as Error).message);
                  }
                }}
              />
            </label>
            <p>
              {t(
                "Paste or edit CSV. Wind and boat speeds are in knots; angles are in degrees. Valid changes preview above and save when you leave the field.",
              )}
            </p>
            {polarError && <p role="alert">{t(polarError)}</p>}
          </details>
          {busy && <p role="status">{t("Saving…")}</p>}
        </form>
      ) : (
        <>
          <dl>
            {[...textFields, ...dimensions].map(
              ([key, label]) =>
                saved[key] !== undefined && (
                  <React.Fragment key={key}>
                    <dt>{t(label)}</dt>
                    <dd>{saved[key]}</dd>
                  </React.Fragment>
                ),
            )}
          </dl>
          {saved.polar && (
            <>
              <h3>{t("Polar diagram")}</h3>
              <BoatPolarChart polar={saved.polar} />
            </>
          )}
        </>
      )}
      {error && <p role="alert">{t(error)}</p>}
    </section>
  );
}
