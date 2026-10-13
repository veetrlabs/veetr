import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Svg, { Line } from "react-native-svg";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { t, locale, useLanguageRefresh, translateMessage } from "../i18n";
import PolarDiagram from "./PolarDiagram";
import { trackingStore } from "../tracking/database";
import PolarCsvEditor from "./PolarCsvEditor";
import type { Polar } from "../../../packages/shared/src/polar/model";
import {
  boatPolarCurves,
  type BoatPolars,
} from "../../../packages/shared/src/polar/repository";
import { boatTripPolars, refreshBoatTripPolar } from "./tripPolars";
import type { Trip } from "../tracking/trip";

export default function BoatPolarDetails({
  boatId,
  onInteractionChange,
}: {
  boatId: string;
  onInteractionChange?: (active: boolean) => void;
}) {
  useLanguageRefresh();
  const c = themeColors[useTheme().theme];
  const [library, setLibrary] = useState<BoatPolars>({
    polars: [],
    observationSets: [],
  });
  const [trips, setTrips] = useState<Trip[]>([]),
    [hiddenTrips, setHiddenTrips] = useState<string[]>([]);
  const [preview, setPreview] = useState<Polar>();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const { reference, measured } = boatPolarCurves(library);
  const entries = useMemo(() => boatTripPolars(trips, boatId), [trips, boatId]);
  const comparisons = entries
    .filter((e) => e.polar && !hiddenTrips.includes(e.trip.session.id))
    .map((e) => ({ polar: e.polar!, dash: e.dash }));
  // Restored measured polars can still be viewed when their source trips are on another device.
  const cachedMeasured = entries.length === 0 ? measured : undefined;
  useEffect(() => {
    setHiddenTrips([]);
    setTrips([]);
    setLibrary({ polars: [], observationSets: [] });
    setPreview(undefined);
    setError("");
  }, [boatId]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const stored = await (await trackingStore()).localRecordings();
        const next = await refreshBoatTripPolar(stored, boatId);
        if (alive) {
          setTrips(stored);
          setLibrary(next);
        }
      })().catch((e) => {
        if (alive) setError(e.message);
      });
      return () => {
        alive = false;
      };
    }, [boatId]),
  );
  async function act(action: () => Promise<BoatPolars>) {
    setBusy(true);
    setError("");
    try {
      setLibrary(await action());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const button = (label: string, action: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={action}
      style={({ pressed }) => ({
        padding: 14,
        minHeight: 48,
        borderRadius: 10,
        backgroundColor: c.buttonBg,
        borderWidth: 1,
        borderColor: c.border,
        opacity: busy || disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: c.text }}>{t(label)}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 14 }}>
      <Text
        accessibilityRole="header"
        style={{ color: c.text, fontSize: 22, fontWeight: "700" }}
      >
        {t("Polar performance")}
      </Text>
      {!!boatId && (
        <>
          {preview ||
          reference ||
          cachedMeasured ||
          entries.some((e) => e.polar) ? (
            <PolarDiagram
              key={boatId}
              onInteractionChange={onInteractionChange}
              polar={preview ?? reference ?? cachedMeasured}
              measured={preview || reference ? cachedMeasured : undefined}
              comparisons={comparisons}
            />
          ) : (
            <Text style={{ color: c.textMuted }}>
              {t("Import a polar or learn one from your sailing trips.")}
            </Text>
          )}
          <Text style={{ color: c.text, fontWeight: "600" }}>
            {t("Compare trips")}
          </Text>
          {!entries.length && (
            <Text style={{ color: c.textMuted }}>
              {t("No completed trips for this boat on this device.")}
            </Text>
          )}
          {entries.map((entry) => {
            const session = entry.trip.session,
              checked = !!entry.polar && !hiddenTrips.includes(session.id);
            return (
              <View
                key={session.id}
                style={{
                  gap: 6,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 12,
                }}
              >
                <Pressable
                  accessible
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${session.tripTitle || session.boatName} · ${new Date(session.startedAt).toLocaleDateString(locale())}`}
                  accessibilityState={{ checked, disabled: !entry.polar }}
                  disabled={!entry.polar}
                  onPress={() =>
                    setHiddenTrips((previous) =>
                      previous.includes(session.id)
                        ? previous.filter((id) => id !== session.id)
                        : [...previous, session.id],
                    )
                  }
                  style={({ pressed }) => ({
                    minHeight: 44,
                    opacity: pressed ? 0.65 : 1,
                    gap: 6,
                  })}
                >
                  <Text
                    style={{
                      color: checked ? c.text : c.textMuted,
                      fontWeight: "600",
                    }}
                  >
                    {checked ? "☑ " : "☐ "}
                    {session.tripTitle || session.boatName} ·{" "}
                    {new Date(session.startedAt).toLocaleDateString(locale())}
                  </Text>
                  {!!entry.polar && (
                    <Svg width={80} height={8}>
                      <Line
                        x1={0}
                        x2={80}
                        y1={4}
                        y2={4}
                        stroke={c.text}
                        strokeWidth={2}
                        strokeDasharray={entry.dash}
                      />
                    </Svg>
                  )}
                </Pressable>
                {entry.unknown && (
                  <Text style={{ color: c.textMuted }}>
                    {t("Engine use unknown. This curve may include motoring.")}
                  </Text>
                )}
                {session.engineUse === "engine-used" && (
                  <Text style={{ color: c.textMuted }}>
                    {t(
                      "Engine used. This trip is excluded from sailing comparisons.",
                    )}
                  </Text>
                )}
                {!entry.polar && session.engineUse !== "engine-used" && (
                  <Text style={{ color: c.textMuted }}>
                    {t("Not enough stable wind and speed data for a curve.")}
                  </Text>
                )}
                {button("Trip details", () =>
                  router.push({
                    pathname: "/trip/[id]",
                    params: { id: session.id },
                  }),
                )}
              </View>
            );
          })}
          {!!entries.length && (
            <Text style={{ color: c.textMuted }}>
              {t(
                "Trip toggles change this comparison. Live performance uses the learned polar from all eligible trips when no reference polar is available.",
              )}
            </Text>
          )}
          <PolarCsvEditor
            key={`csv:${boatId}`}
            boatId={boatId}
            reference={reference}
            onPreview={setPreview}
            onSaved={setLibrary}
          />
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: c.text }}>
          {translateMessage(error)}
        </Text>
      )}
    </View>
  );
}
