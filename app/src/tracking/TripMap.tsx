import { memo, useEffect, useMemo, useRef } from "react";
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
}: {
  points: TrackingPoint[];
  selected?: TrackingPoint;
  thumbnail?: boolean;
}) {
  const { theme } = useTheme(),
    c = themeColors[theme],
    ref = useRef<MapView>(null);
  const segments = useMemo(() => routeSegments(points), [points]);
  const coordinates = useMemo(() => segments.flat(), [segments]);
  function fit() {
    if (coordinates.length)
      ref.current?.fitToCoordinates(coordinates, {
        edgePadding: {
          top: thumbnail ? 14 : 40,
          bottom: thumbnail ? 14 : 40,
          left: thumbnail ? 14 : 40,
          right: thumbnail ? 14 : 40,
        },
        animated: false,
      });
  }
  useEffect(() => {
    fit();
  }, [coordinates]);
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
            ? "Route preview is available in the iPhone app"
            : "No GPS positions"}
        </Text>
      </View>
    );
  return (
    <MapView
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
        <Marker coordinate={coordinates[0]} title="Start" pinColor="#008c80" />
      )}
      {!thumbnail && coordinates.length > 1 && (
        <Marker
          coordinate={coordinates[coordinates.length - 1]}
          title="Finish"
          pinColor="#64748b"
        />
      )}
      {selected && validCoordinate(selected) && (
        <Marker
          coordinate={selected}
          title={new Date(selected.recordedAt).toLocaleTimeString()}
          zIndex={10}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View
            style={{
              height: 22,
              width: 22,
              borderRadius: 11,
              backgroundColor: "#008c80",
              borderWidth: 4,
              borderColor: "white",
            }}
          />
        </Marker>
      )}
    </MapView>
  );
});
