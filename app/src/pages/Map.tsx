import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBLE } from "../context/BLEContext";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { useNavigation } from "../navigation/NavigationContext";
import GPSStatusButton from "../components/GPSStatusButton";
import Svg, { Circle as IconCircle, Path } from "react-native-svg";
import { MapView, Marker, Polyline, Circle, UrlTile } from "../components/NativeMap";
export default function Map({ onBack }: { onBack?: () => void }) {
  const nav = useNavigation(),
    { state } = useBLE(),
    { theme } = useTheme(),
    colors = themeColors[theme];
  const insets = useSafeAreaInsets(),
    ref = useRef<any>(null);
  const [follow, setFollow] = useState(true),
    [ready, setReady] = useState(false);
  const [seamarks, setSeamarks] = useState(true);
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
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
  const local = nav.phoneStartLine.line;
  const d = state.isConnected ? state.sailingData : {
    portLat: local.port?.latitude ?? null, portLon: local.port?.longitude ?? null,
    starboardLat: local.starboard?.latitude ?? null, starboardLon: local.starboard?.longitude ?? null,
  };
  const coordinate = (lat: number | null, lon: number | null) =>
    lat !== null &&
    lon !== null &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180;
  const line =
    coordinate(d.portLat, d.portLon) &&
    coordinate(d.starboardLat, d.starboardLon);
  const lineKey = line ? `${d.portLat},${d.portLon}/${d.starboardLat},${d.starboardLon}` : '';
  useEffect(() => {
    if (!ready || !lineKey) return;
    setFollow(false);
    ref.current?.fitToCoordinates([
      { latitude: d.portLat!, longitude: d.portLon! },
      { latitude: d.starboardLat!, longitude: d.starboardLon! },
    ], { edgePadding: { top: insets.top + 60, right: 50, bottom: 100, left: 50 }, animated: true });
  }, [ready, lineKey]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {MapView ? (
        <MapView
          ref={ref}
          mapType={mapType}
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
          {seamarks && <UrlTile
            urlTemplate="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
            tileSize={256}
            maximumNativeZ={18}
            maximumZ={22}
            shouldReplaceMapContent={false}
            zIndex={0}
          />}
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
                title="Port · start line"
                pinColor="red"
              />
              <Marker
                coordinate={{
                  latitude: d.starboardLat!,
                  longitude: d.starboardLon!,
                }}
                title="Starboard · start line"
                pinColor="green"
              />
              <Polyline
                coordinates={[
                  { latitude: d.portLat!, longitude: d.portLon! },
                  { latitude: d.starboardLat!, longitude: d.starboardLon! },
                ]}
                strokeColor="#f97316"
                strokeWidth={4}
                zIndex={10}
              />
            </>
          )}
        </MapView>
      ) : null}
      <GPSStatusButton />
      <Pressable accessibilityRole="button" accessibilityLabel="Recenter and follow GPS" accessibilityState={{ selected: follow, disabled: !position }} disabled={!position} onPress={() => {
        setFollow(true);
        if (position) ref.current?.animateToRegion({ ...position, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      }} style={{ position: 'absolute', top: insets.top + 4, right: Math.max(8, insets.right), width: 44, height: 44, borderRadius: 22, backgroundColor: colors.panelBg, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={!position ? colors.textMuted : follow ? '#008c80' : colors.text} strokeWidth={2}>
          <IconCircle cx="12" cy="12" r="6" /><IconCircle cx="12" cy="12" r="2" /><Path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
        </Svg>
      </Pressable>
      <View style={{ position: 'absolute', bottom: 32, right: Math.max(12, insets.right), gap: 8, alignItems: 'flex-end' }}>
        {line && <Pressable accessibilityRole="button" accessibilityLabel="Show start line" onPress={() => {
          setFollow(false);
          ref.current?.fitToCoordinates([
            { latitude: d.portLat!, longitude: d.portLon! },
            { latitude: d.starboardLat!, longitude: d.starboardLon! },
          ], { edgePadding: { top: insets.top + 60, right: 50, bottom: 100, left: 50 }, animated: true });
        }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.panelBg }}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 20V4l7 3-7 3 M20 20V4l-7 3 7 3 M4 18h16" /></Svg>
        </Pressable>}
        <View style={{ flexDirection: 'row', borderRadius: 12, padding: 2, backgroundColor: colors.panelBg, gap: 2 }}>
          {(['standard', 'satellite'] as const).map(type => <Pressable key={type} accessibilityRole="button" accessibilityLabel={type === 'standard' ? 'Standard map' : 'Satellite map'} accessibilityState={{ selected: mapType === type }} onPress={() => setMapType(type)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: mapType === type ? colors.buttonBg : 'transparent' }}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={mapType === type ? '#008c80' : colors.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              {type === 'standard' ? <Path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5z M9 3v16 M15 5v16" /> : <><Path d="M9 10l5-5 5 5-5 5z M6 5l3-3 3 3-3 3z M16 17l3-3 3 3-3 3z M3 14a7 7 0 007 7 M3 18a3 3 0 003 3 M7 13l4 4" /></>}
            </Svg>
          </Pressable>)}
          <View style={{ width: 1, marginVertical: 10, backgroundColor: colors.border }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Nautical seamarks" accessibilityState={{ selected: seamarks }} onPress={() => setSeamarks(value => !value)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: seamarks ? colors.buttonBg : 'transparent' }}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={seamarks ? '#008c80' : colors.textMuted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 3v4 M9 7h6l2 11H7L9 7z M9 11h6 M3 20q3-3 6 0t6 0t6 0" />
              <IconCircle cx="12" cy="3" r="1" />
            </Svg>
          </Pressable>
        </View>
        {onBack && <Pressable accessibilityRole="button" onPress={onBack} style={{ padding: 12, backgroundColor: colors.panelBg }}><Text style={{ color: colors.text }}>Back</Text></Pressable>}
      </View>
      {seamarks && <Pressable accessibilityRole="link" accessibilityLabel="OpenSeaMap attribution" onPress={() => void Linking.openURL('https://www.openseamap.org/')} style={{ position: 'absolute', left: Math.max(8, insets.left), bottom: 30, padding: 4, backgroundColor: colors.panelBg, borderRadius: 4 }}>
        <Text style={{ fontSize: 10, color: colors.textSecondary }}>© OpenSeaMap contributors</Text>
      </Pressable>}
    </View>
  );
}
