import { validateCourse, type RaceCourse } from "./course";
import { usableFix, type StartFix } from "./startSensors";
export type UpdateStart = (
  expected: RaceCourse,
  fix: StartFix | null,
) => Promise<RaceCourse>;
export function createStartPublisher(
  initial: RaceCourse,
  update: UpdateStart,
  onUpdate: (course: RaceCourse) => void,
  onError: (error: Error) => void,
  now = Date.now,
) {
  let expected = structuredClone(initial),
    active = true,
    failed = false,
    published = false,
    last = -Infinity;
  let pending: Promise<void> | null = null,
    stopping: Promise<void> | null = null;
  const fail = (e: unknown) => {
    failed = true;
    active = false;
    onError(e instanceof Error ? e : new Error(String(e)));
  };
  return {
    publish(fix: StartFix) {
      if (!active || pending || !usableFix(fix, now()) || now() - last < 5000)
        return;
      last = now();
      pending = (async () => {
        try {
          const next = await update(expected, fix);
          validateCourse(next);
          expected = next;
          published = true;
          onUpdate(next);
        } catch (e) {
          fail(e);
        }
      })().finally(() => {
        pending = null;
      });
    },
    stop(): Promise<void> {
      if (stopping) return stopping;
      active = false;
      stopping = (async () => {
        await pending;
        if (published && !failed)
          try {
            const next = await update(expected, null);
            validateCourse(next);
            expected = next;
            onUpdate(next);
          } catch (e) {
            fail(e);
          }
      })();
      return stopping;
    },
  };
}
