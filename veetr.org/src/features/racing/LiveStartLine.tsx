import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./api";
import type { Json } from "./database.types";
import { createStartPublisher, type UpdateStart } from "./liveStart";
import { usableFix, watchStartPosition, type StartFix } from "./startSensors";
import type { RaceCourse } from "./course";
import { t } from "./i18n";
export function LiveStartLine({
  seriesId,
  eventId,
  course,
  ready,
  onUpdate,
  onActive,
  updatePosition,
}: {
  seriesId: string;
  eventId: string;
  course: RaceCourse;
  ready: boolean;
  onUpdate: (course: RaceCourse) => void;
  onActive: (active: boolean) => void;
  updatePosition?: UpdateStart;
}) {
  const [mode, setMode] = useState("fixed"),
    [active, setActive] = useState(false),
    [stopping, setStopping] = useState(false),
    [error, setError] = useState(""),
    [fix, setFix] = useState<StartFix | null>(null);
  const [now, setNow] = useState(Date.now);
  const session = useRef<{ stop: () => Promise<void> } | null>(null),
    mounted = useRef(true);
  const callbacks = useRef({ onUpdate, onActive });
  callbacks.current = { onUpdate, onActive };
  const stop = async () => {
    const running = session.current;
    if (!running) return;
    session.current = null;
    setStopping(true);
    await running.stop();
    if (mounted.current) {
      setActive(false);
      setStopping(false);
      callbacks.current.onActive(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const hide = (event: Event) => {
      if (document.hidden || event.type === "pagehide") {
        setError(
          "Live position stopped because the page is no longer visible.",
        );
        void stop();
      }
    };
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", hide);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", hide);
      void session.current?.stop();
      session.current = null;
      callbacks.current.onActive(false);
    };
  }, []);
  useEffect(() => {
    if (active && !ready) {
      setError("Sync the course before starting live position.");
      void stop();
    }
  }, [ready, active]);
  const start = () => {
    if ((!supabase && !updatePosition) || !ready || session.current) return;
    setError("");
    setFix(null);
    let stopWatch = () => {},
      timer: ReturnType<typeof setTimeout>;
    const publisher = createStartPublisher(
      course,
      updatePosition ??
        (async (expected, position) => {
          const { data, error } = await supabase!.rpc(
            "update_race_start_position",
            {
              series_id: seriesId,
              event_id: eventId,
              expected_course: expected as unknown as Json,
              fix: position as unknown as Json,
            },
          );
          if (error) throw new Error(error.message);
          return data as unknown as RaceCourse;
        }),
      (next) => {
        if (mounted.current) callbacks.current.onUpdate(next);
      },
      (e) => {
        stopWatch();
        clearTimeout(timer);
        if (mounted.current) {
          setError(e.message);
          setActive(false);
          callbacks.current.onActive(false);
        }
        session.current = null;
      },
    );
    const stale = () => {
      if (mounted.current) {
        setError("Live position stopped: no fresh, accurate GPS fix.");
        void stop();
      }
    };
    session.current = {
      stop: async () => {
        stopWatch();
        clearTimeout(timer);
        await publisher.stop();
      },
    };
    try {
      stopWatch = watchStartPosition(
        (p) => {
          if (mounted.current) setFix(p);
          if (usableFix(p)) {
            clearTimeout(timer);
            timer = setTimeout(stale, 15000);
            publisher.publish(p);
          }
        },
        (message) => {
          if (mounted.current) {
            setError(message);
            void stop();
          }
        },
      );
      timer = setTimeout(stale, 15000);
      setActive(true);
      callbacks.current.onActive(true);
    } catch (e) {
      session.current = null;
      setError((e as Error).message);
    }
  };
  return (
    <div className="live-start-controls">
      <label>
        {t("Referee end A")}
        <select
          disabled={active || stopping}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="fixed">{t("Fixed position")}</option>
          <option value="live">{t("Live phone position")}</option>
        </select>
      </label>
      {mode === "fixed" ? (
        <p>
          {t(
            "This phone is not sharing its position. Use Edit course to capture a fixed position.",
          )}
        </p>
      ) : (
        <>
          <p>
            {t(
              "Starting shares this phone’s position as end A on published race pages. Keep this page open and the screen awake. Stopping freezes the last saved position.",
            )}
          </p>
          {course.startBearing && (
            <p>
              {t(
                "The captured bearing stays fixed while A moves. Aim again if the direction to the buoy changes.",
              )}
            </p>
          )}
          {!ready && (
            <p role="status">
              {t("Sync the course before starting live position.")}
            </p>
          )}
          <button
            type="button"
            disabled={stopping || (!active && !ready)}
            onClick={() => (active ? void stop() : start())}
          >
            {t(
              stopping
                ? "Freezing start position…"
                : active
                  ? "Stop and freeze start line"
                  : "Start live referee position",
            )}
          </button>
          {active && (
            <p role="status">
              {fix && usableFix(fix, now)
                ? t("GPS accuracy: ±{metres} m", {
                    metres: Math.round(fix.accuracy),
                  })
                : t("Waiting for a fresh GPS position…")}
            </p>
          )}
        </>
      )}
      {error && <p role="alert">{t(error)}</p>}
    </div>
  );
}
