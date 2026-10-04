import type { MapRegion } from "../maps/headingRay";
import { routeSegments } from "../tracking/trip";
import type { TrackingPoint } from "../tracking/model";
import BoatMarker from "../maps/BoatMarker";
import { formatNumber, useLanguageRefresh } from '../i18n';
import { useEffect, useRef, useState } from "react";
import { MapView, Polyline, UrlTile } from "../components/NativeMap";
import type { TrackingPosition } from "./positions";
export default function FleetMap({
  positions,
  at,
  ownBoatId,
  onViewportChange,
  fitRequest = 0,
  route = [],
}: {
  positions: TrackingPosition[];
  at: number;
  ownBoatId?: string;
  onViewportChange?: (region: MapRegion) => void;
  fitRequest?: number;
  route?: TrackingPoint[];
}) {
  useLanguageRefresh();
  const [mapRegion, setMapRegion] = useState<MapRegion | undefined>();
  const ref = useRef<any>(null);
  const fitted = useRef(false);
  useEffect(() => { fitted.current = false; }, [fitRequest, route.length]);
  useEffect(() => {
    if (!positions.length || fitted.current) return;
    ref.current?.fitToCoordinates(route.length ? route : positions, {
      edgePadding: { top: 50, bottom: 50, left: 50, right: 50 },
      animated: false,
    });
    fitted.current = true;
  }, [positions, fitRequest, route]);
  return (
    <MapView
      onRegionChange={setMapRegion}
      onRegionChangeComplete={region => { setMapRegion(region); onViewportChange?.(region); }}
      rotateEnabled={false}
      pitchEnabled={false}
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
          ref.current?.fitToCoordinates(route.length ? route : positions, {
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
      {routeSegments(route).filter(segment => segment.length > 1).map((segment, i) => <Polyline key={`overview-${i}`} coordinates={segment} strokeColor="rgba(59,130,246,0.3)" strokeWidth={2} />)}
      {positions.map((p) => (
        <BoatMarker region={mapRegion ?? { latitude: 49.7, longitude: 14.2, latitudeDelta: 2, longitudeDelta: 2 }}
          key={p.boatId}
          coordinate={p}
          reading={p}
          title={p.boatName}
          description={`${p.sogMps === null ? "—" : formatNumber((p.sogMps * 1.94384449), 1)} kn`}
          color={
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
