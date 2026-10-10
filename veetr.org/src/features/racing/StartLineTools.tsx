import React, { useEffect, useRef, useState } from "react";
import { t } from "./i18n";
import {
  trueBearing,
  usableFix,
  watchStartCompass,
  watchStartPosition,
  type StartFix,
} from "./startSensors";
import type { CoursePoint } from "./course";

export function StartLinePosition({
  onPosition,
  end,
}: {
  onPosition: (point: CoursePoint, end: "startA" | "startB") => void;
  end: "startA" | "startB";
}) {
  const [fix, setFix] = useState<StartFix | null>(null),
    [reading, setReading] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now);
  const cleanup = useRef<(() => void) | null>(null);
  const stop = () => {
    cleanup.current?.();
    cleanup.current = null;
    setReading(false);
    setFix(null);
  };
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
      cleanup.current?.();
    };
  }, []);
  return (
    <div className="start-phone-tools">
      <div className="course-tools">
        <button
          type="button"
          onClick={() => {
            if (reading) {
              stop();
              return;
            }
            setError("");
            setFix(null);
            try {
              cleanup.current = watchStartPosition(
                (p) => {
                  setFix(p);
                  setNow(Date.now());
                },
                (message) => {
                  setFix(null);
                  setError(message);
                },
              );
              setReading(true);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {t(reading ? "Stop reading position" : "Read phone position")}
        </button>
        {reading && (
          <button
            key={end}
            type="button"
            disabled={!usableFix(fix, now)}
            onClick={() => {
              if (usableFix(fix))
                onPosition(
                  { latitude: fix.latitude, longitude: fix.longitude },
                  end,
                );
              stop();
            }}
          >
            {t(
              end === "startA"
                ? "Use position for referee end A"
                : "Use position for buoy end B",
            )}
          </button>
        )}
      </div>
      {reading && (
        <p role="status">
          {fix
            ? t("GPS accuracy: ±{metres} m", {
                metres: Math.round(fix.accuracy),
              })
            : t("Waiting for a fresh GPS position…")}{" "}
          {fix &&
            !usableFix(fix, now) &&
            t(
              "Wait for a position less than 15 seconds old and accuracy within 50 m.",
            )}
        </p>
      )}
      {error && <p role="alert">{t(error)}</p>}
    </div>
  );
}

export type CompassPreview = { degrees: number | null; trueNorth: boolean };

export function StartLineCompass({
  onBearing,
  onPreview,
}: {
  onBearing: (degrees: number) => void;
  onPreview?: (preview: CompassPreview | null) => void;
}) {
  const [reading, setReading] = useState(false),
    [heading, setHeading] = useState<{ degrees: number; at: number } | null>(
      null,
    ),
    [correction, setCorrection] = useState(""),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now);
  const cleanup = useRef<(() => void) | null>(null),
    generation = useRef(0);
  const stop = () => {
    generation.current++;
    cleanup.current?.();
    cleanup.current = null;
    setReading(false);
    setHeading(null);
  };
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      generation.current++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
      cleanup.current?.();
    };
  }, []);
  const fresh = heading && now - heading.at <= 3000;
  const validCorrection =
    correction.trim() !== "" &&
    Number.isFinite(Number(correction)) &&
    Math.abs(Number(correction)) <= 180;
  useEffect(() => {
    onPreview?.(reading ? {
      degrees: fresh && heading ? (validCorrection ? trueBearing(heading.degrees, Number(correction)) : heading.degrees) : null,
      trueNorth: validCorrection,
    } : null);
  }, [reading, heading, fresh, correction, validCorrection, onPreview]);
  useEffect(() => () => onPreview?.(null), [onPreview]);
  return (
    <>
      <button
        className="start-compass-action"
        type="button"
        disabled={reading}
        onClick={() => {
          void (async () => {
            setError("");
            setReading(true);
            const run = ++generation.current;
            try {
              const release = await watchStartCompass((value) => {
                setHeading(
                  value === null ? null : { degrees: value, at: Date.now() },
                );
                setNow(Date.now());
              });
              if (run !== generation.current) {
                release();
                return;
              }
              cleanup.current = release;
            } catch (e) {
              if (run === generation.current) {
                setError((e as Error).message);
                setReading(false);
              }
            }
          })();
        }}
      >
        {t("Point phone at buoy")}
      </button>
      {reading && (
        <div className="start-compass-panel">
          <p>
            {t(
              "Hold the phone flat and point its top edge at the buoy. The bearing field updates as you turn.",
            )}
          </p>
          <p role="status">
            {fresh
              ? t("Magnetic bearing: {degrees}°", {
                  degrees: heading.degrees.toFixed(1),
                })
              : t(
                  "Waiting for a usable compass reading. Hold the phone flat, or enter a bearing manually.",
                )}
          </p>
          <div className="start-compass-capture">
            <label>
              {t("Magnetic correction (degrees, east positive)")}
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={!fresh || !validCorrection}
              onClick={() => {
                if (
                  heading &&
                  Date.now() - heading.at <= 3000 &&
                  validCorrection
                ) {
                  onBearing(trueBearing(heading.degrees, Number(correction)));
                  stop();
                }
              }}
            >
              {t("Capture bearing")}
            </button>
          </div>
          <p>
            {t(
              "Enter the local magnetic correction to enable Capture bearing. Capture freezes the angle; Cancel keeps your previous bearing. Use 0 only if no correction is needed.",
            )}
          </p>
          <button type="button" onClick={stop}>
            {t("Cancel")}
          </button>
        </div>
      )}
      {error && (
        <p className="start-compass-error" role="alert">
          {t(error)}
        </p>
      )}
    </>
  );
}
