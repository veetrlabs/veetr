import type { MapRegion } from "../maps/headingRay";
import BoatMarker from "../maps/BoatMarker";
import { locale, t, useLanguageRefresh } from '../i18n';
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "react-native";
import { MapView, Marker, Polyline } from "../components/NativeMap";
import type { TrackingPoint } from "./model";
import { routeSegments, validCoordinate } from "./trip";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default memo(function TripMap({
  points,
  selected,
  thumbnail = false,
  onViewportChange,
  fitRequest = 0,
}: {
  points: TrackingPoint[];
  selected?: TrackingPoint;
  thumbnail?: boolean;
  onViewportChange?: (region: MapRegion) => void;
  fitRequest?: number;
}) {
  useLanguageRefresh();
  const [mapRegion, setMapRegion] = useState<MapRegion | undefined>();
  const { theme } = useTheme(),
    c = themeColors[theme],
    ref = useRef<MapView>(null);
  const [viewport, setViewport] = useState("");
  const segments = useMemo(() => routeSegments(points), [points]);
  const coordinates = useMemo(() => segments.flat(), [segments]);
  function fit() {
    if (coordinates.length)
      ref.current?.fitToCoordinates(coordinates, {
        edgePadding: {
          top: thumbnail ? 14 : 64,
          bottom: thumbnail ? 14 : 64,
          left: thumbnail ? 14 : 64,
          right: thumbnail ? 14 : 64,
        },
        animated: false,
      });
  }
  useEffect(() => {
    fit();
  }, [coordinates, fitRequest]);
  if (!MapView || !coordinates.length)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.chartBg,
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
        }}
      >
        <Text style={{ color: c.textMuted, textAlign: "center", fontSize: 12 }}>
          {coordinates.length
            ? t("Route preview is available in the iPhone app")
            : t("No GPS positions")}
        </Text>
      </View>
    );
  return (
    <MapView
      onRegionChange={setMapRegion}
      ref={ref}
      style={{ flex: 1 }}
      userInterfaceStyle={theme}
      mapType="standard"
      initialRegion={{
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }}
      onMapReady={fit}
      onRegionChangeComplete={region => {
        setViewport(`${region.latitude},${region.longitude},${region.latitudeDelta},${region.longitudeDelta}`);
        onViewportChange?.(region);
      }}
      scrollEnabled={!thumbnail}
      zoomEnabled={!thumbnail}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      liteMode={thumbnail}
    >
      {segments
        .filter((s) => s.length > 1)
        .map((segment, i) => (
          <Polyline
            key={i}
            coordinates={segment}
            strokeColor="#008c80"
            strokeWidth={thumbnail ? 3 : 4}
          />
        ))}
      {!thumbnail && (
        <Marker coordinate={coordinates[0]} title={t("Start")} pinColor="#008c80" />
      )}
      {!thumbnail && coordinates.length > 1 && (
        <Marker
          coordinate={coordinates[coordinates.length - 1]}
          title={t("Finish")}
          pinColor="#64748b"
        />
      )}
      {selected && validCoordinate(selected) && (
        <BoatMarker region={mapRegion} key={viewport} coordinate={selected} reading={selected}
          title={new Date(selected.recordedAt).toLocaleTimeString(locale())} />
      )}
    </MapView>
  );
});
