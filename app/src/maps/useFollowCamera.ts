import { useEffect } from 'react';

/** Automatic camera motion stops completely while the sailor explores the map. */
export function useFollowCamera(
  map: { current: any }, ready: boolean, follow: boolean, heading: number,
  position: { latitude: number; longitude: number } | null,
) {
  useEffect(() => {
    if (!ready || !follow || !position) return;
    // Frequent UIView camera animations can suppress iOS touch delivery.
    // Follow updates must remain immediately interruptible by the sailor.
    map.current?.setCamera({ center: position, heading, pitch: 0 });
  }, [map, ready, follow, heading, position?.latitude, position?.longitude]);
}
