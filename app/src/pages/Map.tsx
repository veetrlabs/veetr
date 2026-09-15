import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBLE } from "../context/BLEContext";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { useNavigation } from "../navigation/NavigationContext";
import NavigationStatus from "../navigation/NavigationStatus";
let MapView: any, Marker: any, Polyline: any, Circle: any;
if (Platform.OS !== "web") {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
  Circle = maps.Circle;
}
export default function Map({ onBack }: { onBack?: () => void }) {
  const nav = useNavigation(),
    { state } = useBLE(),
    { theme } = useTheme(),
    colors = themeColors[theme];
  const insets = useSafeAreaInsets(),
    ref = useRef<any>(null);
  const [follow, setFollow] = useState(true),
    [ready, setReady] = useState(false);
  const fix = nav.fix;
  const trail = nav.trail;
  const last = trail.at(-1);
  const position =
    fix ??
    (last ? { latitude: last.latitude, longitude: last.longitude } : null);
  useEffect(() => {
    if (ready && follow && position)
      ref.current?.animateToRegion(
        { ...position, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500,
      );
  }, [ready, follow, position?.latitude, position?.longitude]);
  const d = state.sailingData;
  const coordinate = (lat: number | null, lon: number | null) =>
    lat !== null &&
    lon !== null &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180;
  const line =
    nav.deviceFresh &&
    coordinate(d.portLat, d.portLon) &&
    coordinate(d.starboardLat, d.starboardLon);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {MapView ? (
        <MapView
          ref={ref}
          style={StyleSheet.absoluteFill}
          onMapReady={() => setReady(true)}
          onPanDrag={() => setFollow(false)}
          initialRegion={{
            latitude: position?.latitude ?? 50,
            longitude: position?.longitude ?? 14,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          {trail.length > 1 && (
            <Polyline
              coordinates={trail.map((p) => ({
                latitude: p.latitude,
                longitude: p.longitude,
              }))}
              strokeColor="#008c80"
              strokeWidth={4}
            />
          )}
          {position && (
            <Marker
              coordinate={position}
              title={fix ? fix.source : "Last recorded position"}
              description={
                fix?.sogKnots == null
                  ? "Speed unavailable"
                  : `${fix.sogKnots.toFixed(1)} kn`
              }
              pinColor={fix ? "#008c80" : "#64748b"}
            />
          )}
          {fix?.accuracy != null && (
            <Circle
              center={fix}
              radius={fix.accuracy}
              fillColor="rgba(0,140,128,0.12)"
              strokeColor="#008c80"
            />
          )}
          {line && (
            <>
              <Marker
                coordinate={{ latitude: d.portLat!, longitude: d.portLon! }}
                title="Port"
                pinColor="red"
              />
              <Marker
                coordinate={{
                  latitude: d.starboardLat!,
                  longitude: d.starboardLon!,
                }}
                title="Starboard"
                pinColor="green"
              />
              <Polyline
                coordinates={[
                  { latitude: d.portLat!, longitude: d.portLon! },
                  { latitude: d.starboardLat!, longitude: d.starboardLon! },
                ]}
                strokeColor="red"
                strokeWidth={3}
              />
            </>
          )}
        </MapView>
      ) : (
        <Text style={{ color: colors.text, marginTop: 300 }}>
          Map requires a native build.
        </Text>
      )}
      <View
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 12,
          right: 12,
          gap: 8,
        }}
      >
        <NavigationStatus />
        <View
          style={{
            padding: 12,
            backgroundColor: colors.panelBg,
            borderRadius: 12,
            gap: 6,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "600" }}>
            SOG {fix?.sogKnots == null ? "—" : fix.sogKnots.toFixed(1)} kn · COG{" "}
            {fix?.course == null ? "—" : `${Math.round(fix.course)}°`}
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            {trail.length
              ? "Saved recording trail"
              : "No saved fixes yet · use Recording controls to start"}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!position}
            onPress={() => {
              setFollow(true);
              if (position)
                ref.current?.animateToRegion({
                  ...position,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                });
            }}
            style={{ paddingVertical: 8 }}
          >
            <Text style={{ color: colors.text }}>
              {follow ? "Following position" : "Recenter and follow"}
            </Text>
          </Pressable>
          {onBack && (
            <Pressable onPress={onBack}>
              <Text style={{ color: colors.text }}>Back</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
