import React, { useEffect, useState } from "react";
import { CourseMap } from "./CourseMap";
import { courseFor, startGeometry, type RaceCourse } from "./course";
import { eventsFor, type Series } from "./domain";
import { downloadCourseGpx } from "./courseGpx";
import { t } from "./i18n";
import { LiveStartLine } from "./LiveStartLine";
export function CourseDescription({ course }: { course: RaceCourse }) {
  const [now, setNow] = useState(Date.now);
  const endpoints = startGeometry(course);
  const knownB = !!course.startLine || !!course.startBearing?.distanceMetres;
  useEffect(() => {
    if (!course.startLive) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [course.startLive?.updatedAt]);
  return (
    <>
      {course.startLine && (
        <p className="course-start-legend">
          <strong>{t("Start line")}</strong>: A — B
        </p>
      )}
      {course.startBearing && (
        <p>
          <strong>{t("Start line direction")}</strong>:{" "}
          {course.startBearing.degrees.toFixed(1)}° {t("true north")} ·{" "}
          {course.startBearing.distanceMetres
            ? t("Estimated buoy distance: {metres} m", {
                metres: course.startBearing.distanceMetres,
              })
            : t("Buoy distance unknown — direction only")}
        </p>
      )}
      {course.startLive && (
        <p role="status">
          {t(
            now - Date.parse(course.startLive.updatedAt) <= 15000
              ? "Live referee position"
              : "Referee position is stale; showing the last received position",
          )}{" "}
          ·{" "}
          {t("GPS accuracy: ±{metres} m", {
            metres: Math.round(course.startLive.accuracyMetres),
          })}{" "}
          · {t("Last update")}:{" "}
          {new Date(course.startLive.updatedAt).toLocaleTimeString()}
        </p>
      )}
      {(course.marks.length > 0 || endpoints.length > 0) && (
        <ol
          className="course-mark-list"
          aria-label={t("Marks in sailing order")}
        >
          {endpoints.slice(0, knownB ? 2 : 1).map((point, index) => (
            <li key={`start-${index}`} className="course-start-list-item">
              <strong>{t(index === 0 ? "Start line end A" : "Start line end B")}</strong>
              {index === 1 && course.startBearing && <span> · {t("Estimated position")}</span>}
              <span className="course-mark-coordinates">{t("Latitude")}: {point.latitude.toFixed(6)}° · {t("Longitude")}: {point.longitude.toFixed(6)}°</span>
            </li>
          ))}
          {endpoints.length > 0 && !knownB && <li className="course-start-list-item"><strong>{t("Start line end B")}</strong><span> · {t("Position unknown — set a buoy distance")}</span></li>}
          {course.marks.map((mark, index) => (
            <li key={mark.id} value={index + 1}>
              <strong>{t("Mark {number}", { number: index + 1 })}</strong>{" "}
              <span
                className={`course-rounding course-rounding-${mark.rounding}`}
              >
                {mark.rounding === "port" ? "↶ " : "↷ "}
                {t(
                  mark.rounding === "port"
                    ? "Leave to port (left)"
                    : "Leave to starboard (right)",
                )}
              </span>
              <span className="course-mark-coordinates">{t("Latitude")}: {mark.latitude.toFixed(6)}° · {t("Longitude")}: {mark.longitude.toFixed(6)}°</span>
            </li>
          ))}
        </ol>
      )}
      {course.notes && <p className="course-notes">{course.notes}</p>}
    </>
  );
}
export function CourseDetails({
  series,
  eventId,
  onEdit,
  canManage = false,
  liveReady = false,
  renderMap,
}: {
  series: Series;
  eventId: string;
  onEdit?: () => void;
  canManage?: boolean;
  liveReady?: boolean;
  renderMap?: (course: RaceCourse | undefined) => React.ReactNode;
}) {
  const [liveCourse, setLiveCourse] = useState<RaceCourse | undefined>();
  const [active, setActive] = useState(false);
  const savedCourse = courseFor(series, eventId);
  const course = liveCourse ?? savedCourse;
  useEffect(() => {
    if (!active) setLiveCourse(undefined);
  }, [savedCourse]);
  if (!course && !onEdit && !renderMap) return null;
  return (
    <section className={`course-details${renderMap ? " course-details-combined" : ""}`}>
      {renderMap?.(course)}
      <div className="course-heading">
        <h2>{t(renderMap ? "Course" : "Course map")}</h2>
        {onEdit && (
          <button type="button" disabled={active} onClick={onEdit}>
            {t(course ? "Edit course" : "Set course")}
          </button>
        )}
      </div>
      {course ? (
        <>
          <p>
            {t(
              "Approximate mark positions. Follow the marks in numbered order and leave each on the indicated side.",
            )}
          </p>
          {!renderMap && (course.marks.length > 0 ||
            course.startLine ||
            course.startBearing) && <CourseMap key={eventId} course={course} />}
          <CourseDescription course={course} />
          {(course.marks.length > 0 || course.startLine || course.startBearing) && <div className="course-export">
            <button type="button" onClick={() => downloadCourseGpx(course, eventsFor(series).find(event => event.id === eventId)?.name ?? series.name)}>{t("Export GPX")}</button>
            <p>{t("Includes waypoints and sailing order. Rounding sides are in point descriptions; estimated positions remain approximate.")}</p>
          </div>}
          {(canManage || onEdit) && (course.startLine || course.startBearing) && (
            <LiveStartLine
              key={eventId}
              seriesId={series.id}
              eventId={eventId}
              course={course}
              ready={liveReady}
              onUpdate={setLiveCourse}
              onActive={setActive}
            />
          )}
          <p className="course-shared-note">
            {t("This race course is shared by all its heats.")}
          </p>
        </>
      ) : (
        <p>{t("No course has been set for this race yet.")}</p>
      )}
    </section>
  );
}
