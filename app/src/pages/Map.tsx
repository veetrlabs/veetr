import CourseLayer, { courseCoordinates } from "../maps/CourseLayer";
import { shouldUseDeviceStartLine } from '../navigation/phoneStartLine';
import { useFollowCamera } from '../maps/useFollowCamera';
import { courseUpBearing, KNOTS_PER_MPS } from '../maps/courseVector';
import type { MapRegion } from "../maps/headingRay";
import BoatMarker from "../maps/BoatMarker";
import { formatNumber, translateMessage, t, useLanguageRefresh } from '../i18n';
import { router, type Href } from "expo-router";
import { useRaceTracking } from "../tracking/useRaceTracking";
import { raceTrackingStatus } from "../tracking/raceTrackingStatus";
import { useJoinedFleet } from "../regattas/useJoinedFleet";
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBLE } from "../context/BLEContext";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { useNavigation } from "../navigation/NavigationContext";
import GPSStatusButton from "../components/GPSStatusButton";
import Svg, { Circle as IconCircle, Path } from "react-native-svg";
import {
  MapView,
  Marker,
  Polyline,
  Circle,
  UrlTile,
} from "../components/NativeMap";
export default function Map({ onBack }: { onBack?: () => void }) {
  useLanguageRefresh();
  const [mapRegion, setMapRegion] = useState<MapRegion | undefined>();
  const nav = useNavigation(),
    { state } = useBLE(),
    { theme } = useTheme(),
    colors = themeColors[theme];
  const insets = useSafeAreaInsets(),
    ref = useRef<any>(null);
  const [follow, setFollow] = useState(true),
    [ready, setReady] = useState(false);
  const [courseUp, setCourseUp] = useState(false);
  const [mapBearing, setMapBearing] = useState(0);
  const lastCourse = useRef<number | null>(null);
  const cameraReadPending = useRef(false);
  function updateMapRegion(region: MapRegion) {
    setMapRegion(region);
    if (!cameraReadPending.current && ref.current?.getCamera) {
      cameraReadPending.current = true;
      void ref.current.getCamera().then((camera: { heading?: number }) => {
        if (typeof camera.heading === 'number') setMapBearing(camera.heading);
      }).catch(() => {}).finally(() => { cameraReadPending.current = false; });
    }
  }
  const [seamarks, setSeamarks] = useState(true);
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const [raceExpanded, setRaceExpanded] = useState(false);
  const [racePanelHeight, setRacePanelHeight] = useState(52);
  const raceMapTop = insets.top + 58 + racePanelHeight + 12;
  const race = useRaceTracking();
  const savedLinkId =
    race.session?.mode === "race"
      ? race.session.raceLinkId
      : race.phone?.linkId;
  const fleet = useJoinedFleet(savedLinkId);
  const linkId = fleet.finished ? undefined : savedLinkId;
  const raceCourse = linkId ? (race.phone?.course !== undefined ? race.phone.course : race.session?.course) : undefined;
  const coursePoints = courseCoordinates(raceCourse);
  const fittedRace = useRef<string | undefined>(undefined);
  useEffect(() => {
    fittedRace.current = undefined;
    setFollow(!linkId);
    setRaceExpanded(false);
  }, [linkId]);
  useEffect(() => {
    if (
      !ready ||
      !linkId ||
      (!fleet.positions.length && !coursePoints.length) ||
      fittedRace.current === linkId
    )
      return;
    fittedRace.current = linkId;
    setFollow(false);
    ref.current?.fitToCoordinates([...fleet.positions, ...coursePoints], {
      edgePadding: { top: raceMapTop, right: 50, bottom: 150, left: 50 },
      animated: true,
    });
  }, [ready, linkId, fleet.positions, raceCourse]);
  const ownBoatId =
    race.session?.mode === "race" ? race.session.boatId : race.phone?.boatId;
  const ownBoatName =
    race.session?.mode === "race"
      ? race.session.boatName
      : race.phone?.boatName;
  const raceStatus = raceTrackingStatus(race.session, race.now);
  const localRaceFix =
    linkId && race.session?.mode === "race" ? race.session.recentPoints?.at(-1) : null;
  const publicOwn = fleet.positions.find((p) => p.boatId === ownBoatId);
  const fix = nav.fix;
  const trail = nav.trail;
  const last = trail.at(-1);
  const position =
    fix ??
    localRaceFix ??
    publicOwn ??
    (last ? { latitude: last.latitude, longitude: last.longitude } : null);
  const ownReading = fix ? { cogDeg: fix.course, sogMps: fix.sogKnots == null ? null : fix.sogKnots / KNOTS_PER_MPS,
    instruments: nav.deviceFresh ? state.sailingData.recordingInstruments : undefined } : localRaceFix ?? publicOwn ?? last ?? {};
  const cameraCourse = courseUpBearing(lastCourse.current, ownReading);
  useEffect(() => { lastCourse.current = cameraCourse; }, [cameraCourse]);
  useFollowCamera(ref, ready, follow, courseUp ? cameraCourse : 0, position);
  const local = nav.phoneStartLine.line;
  const d = shouldUseDeviceStartLine(state.isConnected, nav.phoneStartLine)
    ? state.sailingData
    : {
        portLat: local.port?.latitude ?? null,
        portLon: local.port?.longitude ?? null,
        starboardLat: local.starboard?.latitude ?? null,
        starboardLon: local.starboard?.longitude ?? null,
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
  const lineKey = line
    ? `${d.portLat},${d.portLon}/${d.starboardLat},${d.starboardLon}`
    : "";
  useEffect(() => {
    if (!ready || !lineKey) return;
    setFollow(false);
    ref.current?.fitToCoordinates(
      [
        { latitude: d.portLat!, longitude: d.portLon! },
        { latitude: d.starboardLat!, longitude: d.starboardLon! },
      ],
      {
        edgePadding: { top: insets.top + 60, right: 50, bottom: 100, left: 50 },
        animated: true,
      },
    );
  }, [ready, lineKey]);
  const initialRegion = {
    latitude: position?.latitude ?? 50, longitude: position?.longitude ?? 14,
    latitudeDelta: 0.02, longitudeDelta: 0.02,
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {MapView ? (
        <MapView
          onRegionChange={updateMapRegion}
          onRegionChangeComplete={updateMapRegion}
          rotateEnabled={false}
          pitchEnabled={false}
          ref={ref}
          mapType={mapType}
          style={StyleSheet.absoluteFill}
          onMapReady={() => setReady(true)}
          onTouchStart={() => setFollow(false)}
          onPanDrag={() => setFollow(false)}
          scrollEnabled
          zoomEnabled
          initialRegion={initialRegion}
        >
          <CourseLayer course={raceCourse} />
          {seamarks && (
            <UrlTile
              urlTemplate="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
              tileSize={256}
              maximumNativeZ={18}
              maximumZ={22}
              shouldReplaceMapContent={false}
              zIndex={0}
            />
          )}
          {fleet.positions
            .filter((p) => p.boatId !== ownBoatId)
            .map((p) => (
              <BoatMarker mapBearing={mapBearing} region={mapRegion ?? initialRegion}
                key={`fleet-${p.boatId}`}
                showDirectionLines={false}
                coordinate={p}
                reading={p}
                title={p.boatName}
                description={`${p.sogMps === null ? "—" : formatNumber((p.sogMps * 1.94384449), 1)} kn · ${race.now - Date.parse(p.recordedAt) > 60000 ? t("Last reported position") : t("Live position")}`}
                color={
                  race.now - Date.parse(p.recordedAt) > 60000
                    ? "#64748b"
                    : "#2563eb"
                }
              />
            ))}
          {fleet.positions.flatMap((p) =>
            (p.trailSegments ?? [p.trail]).map((segment, index) => (
              <Polyline
                key={`trail-${p.boatId}-${index}`}
                coordinates={segment.map(([latitude, longitude]) => ({
                  latitude,
                  longitude,
                }))}
                strokeColor={p.boatId === ownBoatId ? "#008c80" : "#2563eb"}
                strokeWidth={3}
              />
            )),
          )}
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
            <BoatMarker mapBearing={mapBearing} region={mapRegion ?? initialRegion}
              coordinate={position}
              reading={ownReading}
              title={
                linkId
                  ? t("{{v0}} · You", { v0: ownBoatName ?? "My boat" })
                  : fix
                    ? fix.source
                    : t("Last recorded position")
              }
              color={fix ? "#008c80" : "#64748b"}
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
                title={t("Port · start line")}
                pinColor="red"
              />
              <Marker
                coordinate={{
                  latitude: d.starboardLat!,
                  longitude: d.starboardLon!,
                }}
                title={t("Starboard · start line")}
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
      {linkId && (
        <View
          onLayout={(event) =>
            setRacePanelHeight(event.nativeEvent.layout.height)
          }
          style={{
            position: "absolute",
            top: insets.top + 58,
            left: Math.max(12, insets.left),
            right: Math.max(12, insets.right),
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: colors.panelBg,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("{{v0}}. {{v1}} race details", { v0: raceStatus.label, v1: raceExpanded ? "Hide" : "Show" })}
              accessibilityState={{ expanded: raceExpanded }}
              onPress={() => setRaceExpanded((value) => !value)}
              style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: raceStatus.live ? "#22b994" : colors.text,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                {raceStatus.live ? "● " : ""}
                {translateMessage(raceStatus.label)} {raceExpanded ? "⌃" : "⌄"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Show fleet")}
              disabled={!fleet.positions.length && !coursePoints.length && !position}
              onPress={() => {
                setFollow(false);
                ref.current?.fitToCoordinates(
                  [...fleet.positions, ...coursePoints, ...(position ? [position] : [])],
                  {
                    edgePadding: {
                      top: raceMapTop,
                      right: 50,
                      bottom: 150,
                      left: 50,
                    },
                    animated: true,
                  },
                );
              }}
              style={{
                paddingHorizontal: 10,
                minHeight: 44,
                justifyContent: "center",
                backgroundColor: colors.buttonBg,
                borderRadius: 8,
              }}
            >
              <Text
                style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}
              >
                {t("Show fleet")}</Text>
            </Pressable>
          </View>
          {!!fleet.error && !raceExpanded && (
            <Text
              accessibilityRole="alert"
              style={{
                color: colors.textMuted,
                fontSize: 12,
                paddingBottom: 4,
              }}
            >
              {t("Fleet unavailable · tap status for details")}</Text>
          )}
          {raceExpanded && (
            <View style={{ paddingTop: 6, paddingBottom: 4, gap: 6 }}>
              <Text style={{ color: colors.text }}>
                {ownBoatName} · {race.session?.raceName ?? race.phone?.raceName}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {fleet.error ||
                  (fleet.loading
                    ? t("Loading race boats…")
                    : fleet.positions.length
                      ? t("Green: your boat · Blue: competitors · Grey: stale")
                      : t("No shared race positions yet."))}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Manage race tracking")}
                onPress={() => router.push("/race-phone" as Href)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {t("Manage race tracking ›")}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Recenter and follow GPS")}
        accessibilityState={{ selected: follow, disabled: !position }}
        disabled={!position}
        onPress={() => {
          setFollow(true);
          if (position)
            ref.current?.animateCamera({ center: position, heading: courseUp ? cameraCourse : 0, pitch: 0 }, { duration: 500 });
        }}
        style={{
          position: "absolute",
          top: insets.top + 4,
          right: Math.max(8, insets.right),
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.panelBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          stroke={
            !position ? colors.textMuted : follow ? "#008c80" : colors.text
          }
          strokeWidth={2}
        >
          <IconCircle cx="12" cy="12" r="6" />
          <IconCircle cx="12" cy="12" r="2" />
          <Path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
        </Svg>
      </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Course-up map")} accessibilityState={{ selected: courseUp }}
          onPress={() => {
            setCourseUp(value => !value);
            if (!courseUp) setFollow(true);
            else if (!follow) ref.current?.animateCamera({ heading: 0, pitch: 0 }, { duration: 500 });
          }}
          style={{ position: "absolute", bottom: 32, left: Math.max(12, insets.left), paddingHorizontal: 14, minHeight: 44, justifyContent: "center", borderRadius: 12, backgroundColor: colors.panelBg }}>
          <Text style={{ color: colors.text }}>{courseUp ? t("Course up") : t("North up")}</Text>
        </Pressable>
      <View
        style={{
          position: "absolute",
          bottom: 32,
          right: Math.max(12, insets.right),
          gap: 8,
          alignItems: "flex-end",
        }}
      >

        {line && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Show start line")}
            onPress={() => {
              setFollow(false);
              ref.current?.fitToCoordinates(
                [
                  { latitude: d.portLat!, longitude: d.portLon! },
                  { latitude: d.starboardLat!, longitude: d.starboardLon! },
                ],
                {
                  edgePadding: {
                    top: insets.top + 60,
                    right: 50,
                    bottom: 100,
                    left: 50,
                  },
                  animated: true,
                },
              );
            }}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: colors.panelBg,
            }}
          >
            <Svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.text}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M4 20V4l7 3-7 3 M20 20V4l-7 3 7 3 M4 18h16" />
            </Svg>
          </Pressable>
        )}
        <View
          style={{
            flexDirection: "row",
            borderRadius: 12,
            padding: 2,
            backgroundColor: colors.panelBg,
            gap: 2,
          }}
        >
          {(["standard", "satellite"] as const).map((type) => (
            <Pressable
              key={type}
              accessibilityRole="button"
              accessibilityLabel={
                type === "standard" ? t("Standard map") : t("Satellite map")
              }
              accessibilityState={{ selected: mapType === type }}
              onPress={() => setMapType(type)}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 10,
                backgroundColor:
                  mapType === type ? colors.buttonBg : "transparent",
              }}
            >
              <Svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                fill="none"
                stroke={mapType === type ? "#008c80" : colors.textMuted}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {type === "standard" ? (
                  <Path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5z M9 3v16 M15 5v16" />
                ) : (
                  <>
                    <Path d="M9 10l5-5 5 5-5 5z M6 5l3-3 3 3-3 3z M16 17l3-3 3 3-3 3z M3 14a7 7 0 007 7 M3 18a3 3 0 003 3 M7 13l4 4" />
                  </>
                )}
              </Svg>
            </Pressable>
          ))}
          <View
            style={{
              width: 1,
              marginVertical: 10,
              backgroundColor: colors.border,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Nautical seamarks")}
            accessibilityState={{ selected: seamarks }}
            onPress={() => setSeamarks((value) => !value)}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              backgroundColor: seamarks ? colors.buttonBg : "transparent",
            }}
          >
            <Svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke={seamarks ? "#008c80" : colors.textMuted}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M12 3v4 M9 7h6l2 11H7L9 7z M9 11h6 M3 20q3-3 6 0t6 0t6 0" />
              <IconCircle cx="12" cy="3" r="1" />
            </Svg>
          </Pressable>
        </View>
        {onBack && (
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={{ padding: 12, backgroundColor: colors.panelBg }}
          >
            <Text style={{ color: colors.text }}>{t("Back")}</Text>
          </Pressable>
        )}
      </View>
      {seamarks && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("OpenSeaMap attribution")}
          onPress={() => void Linking.openURL("https://www.openseamap.org/")}
          style={{
            position: "absolute",
            left: Math.max(8, insets.left),
            bottom: 30,
            padding: 4,
            backgroundColor: colors.panelBg,
            borderRadius: 4,
          }}
        >
          <Text style={{ fontSize: 10, color: colors.textSecondary }}>
            {t("© OpenSeaMap contributors")}</Text>
        </Pressable>
      )}
    </View>
  );
}
