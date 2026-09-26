import { useEffect, useRef } from "react";
import { MapView, Marker, Polyline, UrlTile } from "../components/NativeMap";
import type { TrackingPosition } from "./positions";
export default function FleetMap({
  positions,
  at,
  ownBoatId,
}: {
  positions: TrackingPosition[];
  at: number;
  ownBoatId?: string;
}) {
  const ref = useRef<any>(null);
  const fitted = useRef(false);
  useEffect(() => {
    if (!positions.length || fitted.current) return;
    ref.current?.fitToCoordinates(positions, {
      edgePadding: { top: 50, bottom: 50, left: 50, right: 50 },
      animated: false,
    });
    fitted.current = true;
  }, [positions]);
  return (
    <MapView
      ref={ref}
      style={{ flex: 1 }}
      initialRegion={{
        latitude: 49.7,
        longitude: 14.2,
        latitudeDelta: 2,
        longitudeDelta: 2,
      }}
      onMapReady={() => {
        if (positions.length)
          ref.current?.fitToCoordinates(positions, {
            edgePadding: { top: 50, bottom: 50, left: 50, right: 50 },
            animated: false,
          });
      }}
    >
      <UrlTile
        urlTemplate="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        maximumNativeZ={18}
        maximumZ={22}
        tileSize={256}
      />
      {positions.map((p) => (
        <Marker
          key={p.boatId}
          coordinate={p}
          title={p.boatName}
          description={`${p.sogMps === null ? "—" : (p.sogMps * 1.94384449).toFixed(1)} kn`}
          pinColor={
            at - Date.parse(p.recordedAt) > 60000
              ? "#64748b"
              : p.boatId === ownBoatId
                ? "#009688"
                : "#3b82f6"
          }
        />
      ))}
      {positions.flatMap((p) =>
        (p.trailSegments ?? [p.trail])
          .filter((s) => s.length > 1)
          .map((segment, i) => (
            <Polyline
              key={`${p.boatId}-${i}`}
              coordinates={segment.map(([latitude, longitude]) => ({
                latitude,
                longitude,
              }))}
              strokeColor={p.boatId === ownBoatId ? "#009688" : "#3b82f6"}
              strokeWidth={3}
            />
          )),
      )}
    </MapView>
  );
}
