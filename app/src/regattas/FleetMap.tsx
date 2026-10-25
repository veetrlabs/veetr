import { routeGeometry } from "../../../veetr.org/src/features/racing/routeGeometry";
import CourseLayer, { courseCoordinates, type RaceCourse } from "../maps/CourseLayer";
import type { MapRegion } from "../maps/headingRay";

import type { BoatTrack } from "../replay/boatTracks";
import BoatMarker from "../maps/BoatMarker";
import { Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { themeColors } from '../constants/colors';
import { formatNumber, t, useLanguageRefresh } from '../i18n';
import { useEffect, useRef, useState } from "react";
import { MapView, Polyline, UrlTile } from "../components/NativeMap";
import type { TrackingPosition } from "./positions";
export default function FleetMap({
  positions,
  at,
  ownBoatId,
  routes = [],
  course,
  loading = false,
}: {
  positions: TrackingPosition[];
  at: number;
  ownBoatId?: string;
  routes?: BoatTrack[];
  course?: RaceCourse | null;
  loading?: boolean;
}) {
  useLanguageRefresh();
  const { theme } = useTheme();
  const c = themeColors[theme];
  const [mapRegion, setMapRegion] = useState<MapRegion | undefined>();
  const ref = useRef<any>(null);
  const route = routes.flatMap(track => track.points);
  const colors = new Map(routes.map(track => [track.id, track.color]));
  const bounds = [...(route.length ? route : positions), ...courseCoordinates(course)];
  const fitted = useRef(false);
  useEffect(() => { fitted.current = false; }, [route.length, course]);
  useEffect(() => {
    if (!bounds.length || fitted.current) return;
    if (!ref.current) return;
    ref.current.fitToCoordinates(bounds, {
      edgePadding: { top: 50, bottom: 50, left: 50, right: 50 },
      animated: false,
    });
    fitted.current = true;
  }, [positions, routes, course]);
  if (!bounds.length && !mapRegion) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.chartBg }}>
    <Text accessibilityRole="text" style={{ color: c.textMuted }}>{t(loading ? "Loading competitors…" : "No GPS positions")}</Text>
  </View>;
  const initialRegion = mapRegion ?? {
    latitude: bounds[0].latitude,
    longitude: bounds[0].longitude,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };
  return (
    <MapView
      onRegionChange={setMapRegion}
      onRegionChangeComplete={setMapRegion}
      rotateEnabled={false}
      pitchEnabled={false}
      ref={ref}
      style={{ flex: 1 }}
      initialRegion={initialRegion}
      onMapReady={() => {
        if (bounds.length)
          ref.current?.fitToCoordinates(bounds, {
            edgePadding: { top: 50, bottom: 50, left: 50, right: 50 },
            animated: false,
          });
      }}
    >
      <CourseLayer course={course} />
      <UrlTile
        urlTemplate="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        maximumNativeZ={18}
        maximumZ={22}
        tileSize={256}
      />
      {routes.flatMap(track => routeGeometry(track.points).filter(section => section.points.length > 1).map((section, i) =>
        <Polyline key={track.id + ":overview:" + i} coordinates={section.points} lineDashPattern={section.estimated ? [6, 6] : undefined} strokeColor={track.color} strokeWidth={2} />))}
      {positions.map((p) => (
        <BoatMarker region={mapRegion ?? initialRegion}
          key={p.boatId}
          coordinate={p}
          reading={p}
          title={p.boatName}
          description={`${p.sogMps === null ? "—" : formatNumber((p.sogMps * 1.94384449), 1)} kn`}
          color={
            at - Date.parse(p.recordedAt) > 60000
              ? "#64748b"
              : colors.get(p.boatId) ?? (p.boatId === ownBoatId
                ? "#009688"
                : "#3b82f6")
          }
        />
      ))}
      {positions.filter(p => !routes.some(track => track.id === p.boatId)).flatMap((p) =>
        (p.trailSegments ?? [p.trail])
          .filter((s) => s.length > 1)
          .map((segment, i) => (
            <Polyline
              key={`${p.boatId}-${i}`}
              coordinates={segment.map(([latitude, longitude]) => ({
                latitude,
                longitude,
              }))}
              strokeColor={colors.get(p.boatId) ?? (p.boatId === ownBoatId ? "#009688" : "#3b82f6")}
              strokeWidth={3}
            />
          )),
      )}
    </MapView>
  );
}
