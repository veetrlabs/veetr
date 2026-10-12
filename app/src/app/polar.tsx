import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PolarSelect as Picker } from "../polar/PolarSelect";
import { router, useFocusEffect } from "expo-router";
import * as Crypto from "expo-crypto";
import BackButton from "../components/BackButton";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import {
  t,
  formatNumber,
  useLanguageRefresh,
  translateMessage,
  locale,
} from "../i18n";
import { privateFleet } from "../boats/privateBoats";
import { useNavigation } from "../navigation/NavigationContext";
import { polarRepository } from "../polar/repository";
import { usePerformance } from "../polar/usePerformance";
import PolarDiagram from "../polar/PolarDiagram";
import { trackingStore } from "../tracking/database";
import { tripObservations } from "../polar/observations";
import { syncPolars, restorePolars } from "../polar/sync";
import { importPolar } from "../../../packages/shared/src/polar/import";
import { buildLearnedPoints } from "../../../packages/shared/src/polar/learning";
import type { BoatPolars } from "../../../packages/shared/src/polar/repository";

export default function PolarScreen() {
  useLanguageRefresh();
  const c = themeColors[useTheme().theme],
    nav = useNavigation();
  const [boats, setBoats] = useState<{ id: string; name: string }[]>([]),
    [boatId, setBoatId] = useState("");
  const [library, setLibrary] = useState<BoatPolars>({
    polars: [],
    observationSets: [],
  });
  const [text, setText] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [chartWind, setChartWind] = useState(8),
    [sailingOnly, setSailingOnly] = useState(false),
    [tripId, setTripId] = useState("");
  const [trips, setTrips] = useState<
    Awaited<
      ReturnType<Awaited<ReturnType<typeof trackingStore>>["localRecordings"]>
    >
  >([]);
  const polar = library.polars.find((p) => p.id === library.selectedId),
    { result } = usePerformance({ boatId, polar });
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const fleet = await privateFleet(),
          session = nav.session;
        const list = [...fleet.boats];
        if (session?.boatId && !list.some((b) => b.id === session.boatId))
          list.push({
            id: session.boatId,
            name: session.boatName,
            className: "",
            sailNumber: "",
          });
        if (alive) {
          setBoats(list);
          setBoatId(
            (old) =>
              old || session?.boatId || fleet.activeId || list[0]?.id || "",
          );
        }
        const stored = await (await trackingStore()).localRecordings();
        if (alive) setTrips(stored);
      })().catch((e) => {
        if (alive) setError(e.message);
      });
      return () => {
        alive = false;
      };
    }, [nav.session?.boatId]),
  );
  useEffect(() => {
    let alive = true;
    setLibrary({ polars: [], observationSets: [] });
    setTripId("");
    setSailingOnly(false);
    void polarRepository
      .read(boatId)
      .then((v) => {
        if (alive) setLibrary(v);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [boatId]);
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
  const input = {
    padding: 12,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    color: c.text,
    minHeight: 48,
  };
  const label = (value: string) => (
    <Text style={{ color: c.text, fontWeight: "600" }}>{t(value)}</Text>
  );
  const winds = polar
    ? [...new Set(polar.points.map((p) => p.tws))].sort((a, b) => a - b)
    : [];
  const diagramWind =
    result?.tws ?? (winds.includes(chartWind) ? chartWind : (winds[0] ?? 8));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          gap: 14,
          maxWidth: 720,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <BackButton onPress={() => router.back()} />
        <Text
          accessibilityRole="header"
          style={{ color: c.text, fontSize: 28, fontWeight: "700" }}
        >
          {t("Polar performance")}
        </Text>
        {label("Boat")}
        <Picker
          accessibilityLabel={t("Boat")}
          enabled={!busy}
          selectedValue={boatId}
          onValueChange={setBoatId}
          style={{ color: c.text }}
        >
          {boats.map((b) => (
            <Picker.Item key={b.id} label={b.name} value={b.id} />
          ))}
        </Picker>
        {!boats.length &&
          button("Create private boat", () => router.push("/my-boats"))}
        {!!boatId && (
          <>
            {label("Performance benchmark")}
            <Picker
              accessibilityLabel={t("Performance benchmark")}
              enabled={!busy}
              selectedValue={library.selectedId ?? ""}
              onValueChange={(id) =>
                void act(() => polarRepository.select(boatId, id || undefined))
              }
              style={{ color: c.text }}
            >
              <Picker.Item label={t("No polar selected")} value="" />
              {library.polars.map((p) => (
                <Picker.Item
                  key={p.id}
                  label={`${p.name} · ${t(p.source)} · ${new Date(p.createdAt).toLocaleDateString(locale())}`}
                  value={p.id}
                />
              ))}
            </Picker>
            <Text
              style={{
                color: c.text,
                fontSize: 64,
                fontWeight: "800",
                textAlign: "center",
              }}
            >
              {result ? `${formatNumber(result.performancePercent)}%` : "—"}
            </Text>
            <Text style={{ color: c.text, textAlign: "center" }}>
              {t("Target")} {result ? formatNumber(result.targetSpeed, 1) : "—"}{" "}
              kn · {t("Actual")}{" "}
              {result ? formatNumber(result.actualSpeed, 1) : "—"} kn
            </Text>
            <Text style={{ color: c.textMuted, textAlign: "center" }}>
              TWS {result ? formatNumber(result.tws, 1) : "—"} kn · TWA{" "}
              {result ? formatNumber(result.twa) : "—"}°
            </Text>
            {!result && (
              <Text style={{ color: c.textMuted }}>
                {t(
                  polar
                    ? "Waiting for fresh GPS and wind within the polar range."
                    : "Import a polar to see your target speed.",
                )}
              </Text>
            )}
            <Text style={{ color: c.textMuted }}>
              {t(
                "Actual speed uses GPS (SOG). Currents can affect the comparison.",
              )}
            </Text>
            {polar && (
              <>
                {!result && (
                  <>
                    <Text style={{ color: c.text }}>
                      {t("Diagram wind speed")}
                    </Text>
                    <Picker
                      accessibilityLabel={t("Diagram wind speed")}
                      selectedValue={diagramWind}
                      onValueChange={setChartWind}
                      style={{ color: c.text }}
                    >
                      {winds.map((w) => (
                        <Picker.Item key={w} value={w} label={`${w} kn`} />
                      ))}
                    </Picker>
                  </>
                )}
                <PolarDiagram
                  polar={polar}
                  tws={diagramWind}
                  actual={
                    result
                      ? { twa: result.twa, speed: result.actualSpeed }
                      : undefined
                  }
                />
                <Text style={{ color: c.textMuted }}>
                  {t("Target curve · orange dot is actual speed")} ·{" "}
                  {formatNumber(diagramWind, 1)} kn TWS
                </Text>
                {polar.source === "learned" && (
                  <Text style={{ color: c.textMuted }}>
                    {t(
                      "Learned from stable sailing. Gaps indicate insufficient observations.",
                    )}{" "}
                    {
                      polar.points.filter(
                        (p) => p.confidence?.level !== "unknown",
                      ).length
                    }
                    /{polar.points.length}
                  </Text>
                )}
              </>
            )}
            {label("Import polar")}
            <Text style={{ color: c.textMuted }}>
              {t(
                "Paste CSV, POL or JSON. Speeds in knots; angles in degrees. Each import stays separate.",
              )}
            </Text>
            <TextInput
              accessibilityLabel={t("Polar name")}
              placeholder={t("Polar name")}
              placeholderTextColor={c.textMuted}
              value={name}
              onChangeText={setName}
              style={input}
            />
            <TextInput
              accessibilityLabel={t("Polar table")}
              multiline
              value={text}
              onChangeText={setText}
              placeholder={
                "TWS,TWA,speed\n6,45,4.2\n6,90,5.1\n8,45,4.8\n8,90,5.8"
              }
              placeholderTextColor={c.textMuted}
              style={{ ...input, minHeight: 150, textAlignVertical: "top" }}
            />
            {button(
              "Import polar",
              () =>
                void act(async () => {
                  const p = importPolar(text, {
                    id: Crypto.randomUUID(),
                    name: name.trim(),
                    version: new Date().toISOString(),
                    source: "upload",
                    createdAt: new Date().toISOString(),
                  });
                  const next = await polarRepository.add(boatId, p);
                  setText("");
                  setName("");
                  return next;
                }),
              !name.trim() || !text.trim(),
            )}
            {label("Learn from saved sailing")}
            <Text style={{ color: c.textMuted }}>
              {t(
                "Choose a sailing-only trip. Original observations are kept so the learned polar can be rebuilt offline.",
              )}
            </Text>
            <Picker
              accessibilityLabel={t("Sailing trip")}
              enabled={!busy}
              selectedValue={tripId}
              onValueChange={(v) => {
                setTripId(v);
                setSailingOnly(false);
              }}
              style={{ color: c.text }}
            >
              <Picker.Item value="" label={t("Choose a trip")} />
              {trips
                .filter(
                  (r) =>
                    r.session.boatId === boatId &&
                    r.session.phase === "stopping",
                )
                .map((r) => (
                  <Picker.Item
                    key={r.session.id}
                    value={r.session.id}
                    label={`${r.session.tripTitle || r.session.boatName} · ${r.session.startedAt.slice(0, 10)}`}
                  />
                ))}
            </Picker>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Switch
                accessibilityLabel={t("Engine was off for this entire trip")}
                disabled={busy}
                value={sailingOnly}
                onValueChange={setSailingOnly}
              />
              <Text style={{ color: c.text, flex: 1 }}>
                {t("Engine was off for this entire trip")}
              </Text>
            </View>
            {button(
              "Add trip and rebuild learned polar",
              () =>
                void act(async () => {
                  const trip = trips.find((r) => r.session.id === tripId);
                  if (!trip) throw new Error("Choose a trip");
                  await polarRepository.saveObservations(
                    boatId,
                    tripId,
                    tripObservations(trip.session, trip.points),
                  );
                  const learned = buildLearnedPoints(
                    await polarRepository.observations(boatId),
                    boatId,
                  );
                  if (!learned.points.length)
                    throw new Error(
                      "Not enough stable sailing yet. Observations were saved.",
                    );
                  return polarRepository.add(boatId, {
                    id: Crypto.randomUUID(),
                    name: t("Learned polar"),
                    version: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    source: "learned",
                    speedBasis: "ground",
                    points: learned.points,
                    learning: learned.config,
                  });
                }),
              !tripId || !sailingOnly,
            )}
            <Text style={{ color: c.textMuted }}>
              {t(
                "Polars stay on this device. Sync copies them to your private account; trip observations remain local unless you share the trip.",
              )}
            </Text>
            {button(
              "Sync polars with my account",
              () => void act(() => syncPolars(boatId)),
            )}
          </>
        )}
        {button("Restore polars from my account", () => {
          setBusy(true);
          setError("");
          void restorePolars()
            .then(async (fleet) => {
              setBoats(fleet.boats);
              const restoredId = fleet.activeId ?? fleet.boats[0]?.id ?? "";
              setBoatId(restoredId);
              setLibrary(await polarRepository.read(restoredId));
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        })}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: c.text }}>
            {translateMessage(error)}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
