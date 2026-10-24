import { useCallback, useState } from 'react';
import type { TrackingPoint } from './model';

/** Follow new samples until the user selects an earlier point in the timeline. */
export function useTripSelection(tripId: string, points: TrackingPoint[]) {
  const [selection, setSelection] = useState<{ tripId: string; recordedAt: string } | null>(null);
  const selectedIndex = selection?.tripId === tripId
    ? points.findIndex(point => point.recordedAt === selection.recordedAt)
    : -1;
  const index = selectedIndex < 0 ? Math.max(0, points.length - 1) : selectedIndex;
  const select = useCallback((next: number) => {
    const point = points[next];
    if (!point) return;
    setSelection(next === points.length - 1 ? null : { tripId, recordedAt: point.recordedAt });
  }, [tripId, points]);
  return { index, select };
}
