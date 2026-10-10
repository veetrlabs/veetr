import React, { useEffect, useMemo, useRef, useState } from "react";
import { t } from "./i18n";
import {
  trueBearing,
  usableFix,
  watchStartCompass,
  watchStartPosition,
  type StartFix,
} from "./startSensors";
import type { CoursePoint } from "./course";
import { magneticCorrection } from "./magneticCorrection";

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
  position,
  onBearing,
  onPreview,
}: {
  position?: CoursePoint;
  onBearing: (degrees: number) => void;
  onPreview?: (preview: CompassPreview | null) => void;
}) {
  const [reading, setReading] = useState(false),
    [heading, setHeading] = useState<{ degrees: number; at: number } | null>(
      null,
    ),
    [error, setError] = useState(""),
    [sensorIssue, setSensorIssue] = useState<string | null>(null),
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
  const day = new Date(now).toISOString().slice(0, 10);
  const correction = useMemo(
    () => magneticCorrection(position, new Date(day)),
    [position?.latitude, position?.longitude, day],
  );
  const validCorrection = correction !== null;
  useEffect(() => {
    onPreview?.(reading ? {
      degrees: fresh && heading ? (validCorrection ? trueBearing(heading.degrees, correction) : heading.degrees) : null,
      trueNorth: validCorrection,
    } : null);
  }, [reading, heading, fresh, correction, validCorrection, onPreview]);
  useEffect(() => () => onPreview?.(null), [onPreview]);
  return (
    <>
      <button
        className="start-compass-action"
        type="button"
        disabled={reading || !validCorrection}
        onClick={() => {
          void (async () => {
            setError("");
            setSensorIssue(null);
            setReading(true);
            const run = ++generation.current;
            try {
              const release = await watchStartCompass((value, issue) => {
                setSensorIssue(issue ?? null);
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
      {!validCorrection && (
        <p className="start-compass-error" role="status">
          {t(!position ? "Set start A on the map or use your phone position to enable the compass." : "Automatic correction is unavailable for this location or date. Enter a true-north bearing manually.")}
        </p>
      )}
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
                  sensorIssue ?? (heading ? "Move the phone gently to refresh the compass reading." : "Waiting for phone compass data. Move the phone gently. If nothing appears, try Safari or check motion access in your browser settings."),
                )}
          </p>
          <div className="start-compass-capture">
            <p>{validCorrection && t("Automatic magnetic correction: {degrees}° · based on start A", { degrees: correction.toFixed(1) })}</p>
            <button
              type="button"
              disabled={!fresh || !validCorrection}
              onClick={() => {
                if (
                  heading &&
                  Date.now() - heading.at <= 3000 &&
                  validCorrection
                ) {
                  onBearing(trueBearing(heading.degrees, correction));
                  stop();
                }
              }}
            >
              {t("Capture bearing")}
            </button>
          </div>
          <p>
            {t(
              "Capture freezes the true-north bearing. Cancel keeps your previous bearing.",
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
