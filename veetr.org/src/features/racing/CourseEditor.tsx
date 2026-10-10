import { MapPinPlus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { CourseMap, type CourseTarget } from "./CourseMap";
import {
  courseFingerprint,
  courseFor,
  MAX_COURSE_MARKS,
  setCourse,
  startGeometry,
  validCoursePoint,
  validateCourse,
  type CoursePoint,
  type RaceCourse,
} from "./course";
import { eventsFor, id, type Series } from "./domain";
import { t } from "./i18n";
import { StartLinePosition, StartLineCompass } from "./StartLineTools";
function PositionFields({
  point,
  onChange,
}: {
  point: CoursePoint;
  onChange: (point: CoursePoint) => void;
}) {
  const [lat, setLat] = useState(String(point.latitude)),
    [lng, setLng] = useState(String(point.longitude));
  useEffect(() => {
    setLat(String(point.latitude));
    setLng(String(point.longitude));
  }, [point.latitude, point.longitude]);
  const update = (latitude: string, longitude: string) => {
    setLat(latitude);
    setLng(longitude);
    const next = { latitude: Number(latitude), longitude: Number(longitude) };
    if (latitude.trim() && longitude.trim() && validCoursePoint(next))
      onChange(next);
  };
  return (
    <div className="course-position-fields">
      <label>
        {t("Latitude")}
        <input
          type="number"
          step="any"
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") event.preventDefault();
          }}
          min="-90"
          max="90"
          required
          value={lat}
          onChange={(e) => update(e.target.value, lng)}
        />
      </label>
      <label>
        {t("Longitude")}
        <input
          type="number"
          step="any"
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") event.preventDefault();
          }}
          min="-180"
          max="180"
          required
          value={lng}
          onChange={(e) => update(lat, e.target.value)}
        />
      </label>
    </div>
  );
}
export function CourseEditor({
  series,
  eventId,
  save,
  onBack,
}: {
  series: Series;
  eventId: string;
  save: (change: (series: Series) => void) => Promise<void>;
  onBack: () => void;
}) {
  const event = eventsFor(series).find((e) => e.id === eventId);
  const [original] = useState(() =>
    structuredClone(courseFor(series, eventId)),
  );
  const [marks, setMarks] = useState(() => original?.marks ?? []);
  const [startA, setStartA] = useState<CoursePoint | undefined>(
    original?.startLine?.[0] ?? original?.startBearing?.origin,
  );
  const [startB, setStartB] = useState<CoursePoint | undefined>(
    original?.startLine?.[1],
  );
  const [notes, setNotes] = useState(original?.notes ?? "");
  const [startMode, setStartMode] = useState(
    original?.startBearing ? "bearing" : "points",
  );
  const [bearing, setBearing] = useState(
    String(original?.startBearing?.degrees ?? ""),
  );
  const [distance, setDistance] = useState(
    String(original?.startBearing?.distanceMetres ?? ""),
  );
  const [target, setTarget] = useState<CourseTarget | "new" | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const course: RaceCourse = {
    marks,
    ...(startMode === "points" && startA && startB
      ? { startLine: [startA, startB] as [CoursePoint, CoursePoint] }
      : {}),
    ...(startMode === "bearing" &&
    startA &&
    bearing.trim() &&
    Number.isFinite(Number(bearing)) &&
    Number(bearing) >= 0 &&
    Number(bearing) < 360
      ? {
          startBearing: {
            origin: startA,
            degrees: Number(bearing),
            ...(distance.trim() &&
            Number(distance) > 0 &&
            Number(distance) <= 10000
              ? { distanceMetres: Number(distance) }
              : {}),
          },
        }
      : {}),
    ...(notes.trim() ? { notes: notes.trim() } : {}),
  };
  const move = (target: CourseTarget, point: CoursePoint) => {
    if (target === "startA") setStartA(point);
    else if (target === "startB") {
      setStartMode("points");
      setStartB(point);
    } else
      setMarks((current) =>
        current.map((m) =>
          `mark:${m.id}` === target ? { ...m, ...point } : m,
        ),
      );
  };
  const pick = (point: CoursePoint) => {
    if (!target || busy) return;
    if (target === "new") {
      if (marks.length >= MAX_COURSE_MARKS) return;
      setMarks((current) => [
        ...current,
        {
          id: id(),
          name: t("Mark {number}", { number: current.length + 1 }),
          rounding: "port",
          ...point,
        },
      ]);
    } else move(target, point);
    setTarget(
      target === "startA" && startMode === "points" && !startB
        ? "startB"
        : null,
    );
  };
  const reorder = (index: number, delta: number) =>
    setMarks((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  if (!event)
    return (
      <section>
        <button onClick={onBack}>{t("Back")}</button>
        <p>{t("Race not found")}</p>
      </section>
    );
  return (
    <section className="course-editor">
      <button type="button" disabled={busy} onClick={onBack}>
        ← {t("Back to race")}
      </button>
      <h1>
        {t("Edit course")} · {event.name}
      </h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setError("");
            setBusy(true);
            try {
              if (startMode === "points" && Boolean(startA) !== Boolean(startB))
                throw new Error("Place both ends of the start line");
              if (startMode === "bearing" && !course.startBearing)
                throw new Error("Set the referee position and a bearing");
              validateCourse(course);
              const next =
                marks.length ||
                course.startLine ||
                course.startBearing ||
                course.notes
                  ? course
                  : undefined;
              await save((series) =>
                setCourse(series, eventId, next, courseFingerprint(original)),
              );
              onBack();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <fieldset disabled={busy} className="course-editor-fields">
          <div className="course-placement-actions">
            {!startA && <button type="button" onClick={() => setTarget("startA")}>{t("Place start A")}</button>}
            {startMode === "points" && !startB && <button type="button" onClick={() => setTarget("startB")}>{t("Place start B")}</button>}
            {target && <button type="button" onClick={() => setTarget(null)}>{t("Cancel placement")}</button>}
          </div>
          {target && <p className="course-placement-hint" role="status">
            {t(
              target === "new"
                ? "Tap the map to add the next mark."
                : target === "startA"
                  ? "Tap the map to place start line end A."
                  : target === "startB"
                    ? "Tap the map to place start line end B."
                    : target
                      ? "Tap the map to move the selected mark."
                      : "Drag a point to move it. Drag the background to pan the map.",
            )}
          </p>}
          <div className="course-plan">
            <CourseMap
              course={course}
              startDraft={
                startMode === "points"
                  ? [startA, startB]
                  : course.startBearing
                    ? undefined
                    : [startA, undefined]
              }
              onPick={pick}
              onMove={busy ? undefined : move}
              picking={!!target}
              actions={<button type="button" title={t("Add mark")} aria-label={t("Add mark")} disabled={marks.length >= MAX_COURSE_MARKS} onClick={() => setTarget("new")}><MapPinPlus size={19} aria-hidden="true" /></button>}
            />
          </div>
          <div className="course-start-fields">
            {[startA].map(
              (p, i) => (
                <fieldset key={i} className="course-start-a">
                  <legend>
                    {t(i === 0 ? "Start line end A" : "Start line end B")}
                  </legend>
                  {p ? (
                    <PositionFields
                      point={p}
                      onChange={(value) =>
                        move(i === 0 ? "startA" : "startB", value)
                      }
                    />
                  ) : (
                    <p>{t("Not placed yet")}</p>
                  )}
                  <StartLinePosition end="startA" onPosition={(point, end) => move(end, point)} />
                  {p && <button type="button" className="course-end-remove" aria-label={t("Remove A")} title={t("Remove A")} onClick={() => {
                    if (course.startBearing?.distanceMetres) setStartB(startGeometry(course)[1]);
                    setStartMode("points"); setStartA(undefined); setTarget(null);
                  }}><Trash2 size={18} aria-hidden="true" /></button>}
                  {!p && <button
                    type="button"
                    onClick={() => setTarget(i === 0 ? "startA" : "startB")}
                  >
                    {t("Place on map")}
                  </button>}
                </fieldset>
              ),
            )}
            <fieldset className="course-start-setup" data-method={startMode}>
              <legend>{t("Start line end B")}</legend>
          <div className="course-method">
            <label>
              {t("Start-line method")}
              <select value={startMode} onChange={e => {
                if (e.target.value === "points" && course.startBearing?.distanceMetres)
                  setStartB(startGeometry(course)[1]);
                setStartMode(e.target.value);
                setTarget(null);
              }}>
                <option value="points">{t("Place both ends")}</option>
                <option value="bearing">{t("Bearing and length")}</option>
              </select>
            </label>
            <p>{t(startMode === "points"
              ? "Drag A (referee) and B (buoy) separately. Moving one leaves the other in place."
              : "A is the referee. B is an estimate from the bearing and length. Moving A moves both ends; change the length to move B.")}</p>
          </div>
              {startMode === "points" && (startB ? <PositionFields point={startB} onChange={p => move("startB", p)} /> : <><p>{t("Not placed yet")}</p><button type="button" onClick={() => setTarget("startB")}>{t("Place on map")}</button></>)}
              {startMode === "points" && <StartLinePosition end="startB" onPosition={(point, end) => move(end, point)} />}
              {(startB || (startMode === "bearing" && bearing.trim())) && <button type="button" className="course-end-remove" aria-label={t("Remove B")} title={t("Remove B")} onClick={() => {
                setStartB(undefined); setBearing(""); setDistance(""); setStartMode("points"); setTarget(null);
              }}><Trash2 size={18} aria-hidden="true" /></button>}
              {startMode === "bearing" && (
                <div className="start-bearing-fields">
                  <div className="start-bearing-entry">
                    <label>
                      {t("Bearing toward buoy (° true)")}
                      <input
                        type="number"
                        required
                        min="0"
                        max="359.999999"
                        step="any"
                        value={bearing}
                        onChange={(e) => setBearing(e.target.value)}
                      />
                    </label>
                    <StartLineCompass
                      onBearing={(degrees) =>
                        setBearing(String(Math.round(degrees * 10) / 10))
                      }
                    />
                  </div>
                  {distance.trim() &&
                  Number(distance) > 0 &&
                  Number(distance) <= 10000 ? (
                    <label className="start-length-slider">
                      {t("Adjust estimated length")}: {Number(distance)} m
                      <input
                        type="range"
                        min="1"
                        max={Math.max(
                          1000,
                          Math.ceil(Number(distance) / 1000) * 1000,
                        )}
                        step="1"
                        value={Number(distance)}
                        onChange={(e) => setDistance(e.target.value)}
                        aria-label={t("Adjust estimated length")}
                        aria-valuetext={`${Number(distance)} m`}
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      className="start-length-estimate"
                      onClick={() => setDistance("250")}
                    >
                      {t("Start with an estimated 250 m")}
                    </button>
                  )}
                  <label className="start-length-value">
                    {t("Estimated start-line length (m, optional)")}
                    <input
                      type="number"
                      min="0.01"
                      max="10000"
                      step="any"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                    />
                  </label>
                  {!distance.trim() && <p>{t("No length set: the map shows direction only.")}</p>}
                </div>
              )}
            </fieldset>
          </div>
          <h2>{t("Marks in sailing order")}</h2>
          {!marks.length && (
            <p>{t("No marks yet. Choose Add mark, then tap the map.")}</p>
          )}
          <div className="course-mark-editors">
            {marks.map((mark, index) => (
              <fieldset key={mark.id}>
                <legend>{t("Mark {number}", { number: index + 1 })}</legend>

                <div className="course-mark-fields">
                  <label>
                    {t("Rounding side")}
                    <select
                      value={mark.rounding}
                      onChange={(e) =>
                        setMarks((current) =>
                          current.map((m) =>
                            m.id === mark.id
                              ? {
                                  ...m,
                                  rounding: e.target.value as
                                    "port" | "starboard",
                                }
                              : m,
                          ),
                        )
                      }
                    >
                      <option value="port">{t("Leave to port (left)")}</option>
                      <option value="starboard">
                        {t("Leave to starboard (right)")}
                      </option>
                    </select>
                  </label>
                  <PositionFields
                    point={mark}
                    onChange={(value) => move(`mark:${mark.id}`, value)}
                  />
                <div className="course-mark-actions">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={t("Move mark {number} earlier", {
                      number: index + 1,
                    })}
                    onClick={() => reorder(index, -1)}
                  >
                    <ArrowUp size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={index === marks.length - 1}
                    aria-label={t("Move mark {number} later", {
                      number: index + 1,
                    })}
                    onClick={() => reorder(index, 1)}
                  >
                    <ArrowDown size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("Remove mark {number}", {
                      number: index + 1,
                    })}
                    onClick={() => {
                      setMarks((current) =>
                        current.filter((m) => m.id !== mark.id),
                      );
                      setTarget(null);
                    }}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
                </div>

              </fieldset>
            ))}
          </div>
          <label>
            {t("Course notes")}
            <textarea
              value={notes}
              maxLength={1000}
              rows={3}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t(
                "Optional instructions, such as laps or repeated marks",
              )}
            />
          </label>
          <p>
            {t(
              "This race course is shared by all its heats. Saving makes it visible with published race details.",
            )}
          </p>
          {error && <p role="alert">{t(error)}</p>}
          <div className="course-save-actions">
            <button type="submit">{t(busy ? "Saving…" : "Save course")}</button>
            <button type="button" onClick={onBack}>
              {t("Cancel")}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
