import { translateMessage, t, useLanguageRefresh } from '../i18n';
import { useCallback, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trackingClient } from "../tracking/client";
import {
  tripBoats,
  setTripSharing,
  type TripVisibility,
  type TripBoat,
} from "../tracking/tripSharing";
import { TripOptions, TripAccountLink } from "../tracking/TripOptions";
import { trackingStore } from "../tracking/database";
import { rememberTripBoat } from "../tracking/recentTripBoats";
import { privateFleet, type PrivateBoat } from "../boats/privateBoats";
import TripBoatPicker from "../tracking/TripBoatPicker";
import { startLocalTracking } from "../tracking/service";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function StartTrip() {
  useLanguageRefresh();
  const c = themeColors[useTheme().theme];
  const [boat, setBoat] = useState<TripBoat>(),
    [title, setTitle] = useState(t("My sailing trip")),
    [visibility, setVisibility] = useState<TripVisibility>("private"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [privateBoat, setPrivateBoat] = useState<PrivateBoat>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [privateBoats, setPrivateBoats] = useState<PrivateBoat[]>([]);
  useFocusEffect(useCallback(() => {
    let alive = true;
    void (async () => {
      const local = await privateFleet();
      if (alive) {
        setPrivateBoats(local.boats);
        setPrivateBoat(local.boats.find(b => b.id === local.activeId));
      }
      const auth = await trackingClient?.auth.getSession();
      if (!auth?.data.session) return;
      const key = `veetr-last-trip-boat:${auth.data.session.user.id}`;
      const last = await AsyncStorage.getItem(key);
      const boats = await tripBoats();
      if (alive) setBoat(boats.find((b) => b.id === last));
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, []));
  async function start() {
    setBusy(true);
    setError("");
    let startedId: string | undefined;
    try {
      if (visibility !== "private") {
        const auth = await trackingClient?.auth.getSession();
        if (!auth?.data.session)
          throw new Error("Sign in before sharing a trip.");
        if (!boat) throw new Error("Choose a boat before sharing.");
      }
      startedId = await startLocalTracking(visibility === "private" && privateBoats.length ? (privateBoat ? { ...privateBoat, localOnly: true } : undefined) : boat);
      await (
        await trackingStore()
      ).updateTrip(startedId, { tripTitle: title.trim() || t("My sailing trip") });
      if (visibility !== "private")
        await setTripSharing(startedId, visibility, title);
      const auth = await trackingClient?.auth.getSession();
      if (boat && !(visibility === "private" && privateBoats.length) && auth?.data.session)
        await rememberTripBoat(boat.id).catch(() => {});
      if (visibility === "private") router.back();
      else
        router.replace({
          pathname: "/trip-sharing",
          params: { id: startedId },
        });
    } catch (e) {
      if (startedId) {
        // Recording already started: continue to its controls, never start a duplicate on retry.
        router.replace({
          pathname: "/trip-sharing",
          params: { id: startedId },
        });
      } else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: c.text }}>{t("‹ Trips")}</Text>
        </Pressable>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: "700" }}>
          {t("Start a trip")}</Text>
        <Text style={{ color: c.textMuted }}>
          {t("Choose your boat and who can watch. Private trips stay on this device.")}</Text>
        {visibility === "private" && privateBoats.length > 0 ? <View style={{ gap: 10 }}>
          <Text style={{ color: c.text, fontWeight: "600" }}>{t("Boat for this trip")}</Text>
          {Platform.OS === "ios" ? <><Pressable accessibilityRole="button" accessibilityLabel={t("Boat for this trip")}
            accessibilityValue={{ text: privateBoat?.name ?? t("No boat selected") }} disabled={busy}
            onPress={() => setPickerOpen(true)}
            style={{ padding: 14, minHeight: 48, borderRadius: 12, backgroundColor: c.buttonBg, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: c.text, flex: 1 }}>{privateBoat?.name ?? t("No boat selected")}</Text>
            <Text style={{ color: c.text }} accessibilityElementsHidden>⌄</Text>
          </Pressable>
          <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
            <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" }}>
              <Pressable style={{ flex: 1 }} accessibilityLabel={t("Close")} onPress={() => setPickerOpen(false)} />
              <SafeAreaView style={{ backgroundColor: c.bg }}>
                <View style={{ padding: 16, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: c.text, fontWeight: "600" }}>{t("Boat for this trip")}</Text>
                  <Pressable accessibilityRole="button" onPress={() => setPickerOpen(false)}><Text style={{ color: c.text }}>{t("Done")}</Text></Pressable>
                </View>
                <Picker accessibilityLabel={t("Boat for this trip")} selectedValue={privateBoat?.id ?? ""}
                  itemStyle={{ color: c.text }} onValueChange={id => setPrivateBoat(privateBoats.find(option => option.id === id))}>
                  <Picker.Item label={t("No boat selected")} value="" />
                  {privateBoats.map(option => <Picker.Item key={option.id} label={option.name} value={option.id} />)}
                </Picker>
              </SafeAreaView>
            </View>
          </Modal></> : <View style={{ borderRadius: 12, backgroundColor: c.buttonBg }}>
            <Picker accessibilityLabel={t("Boat for this trip")} selectedValue={privateBoat?.id ?? ""}
              enabled={!busy} mode="dropdown" style={{ color: c.text }} dropdownIconColor={c.text}
              onValueChange={id => setPrivateBoat(privateBoats.find(option => option.id === id))}>
              <Picker.Item label={t("No boat selected")} value="" />
              {privateBoats.map(option => <Picker.Item key={option.id} label={option.name} value={option.id} />)}
            </Picker>
          </View>}
        </View> : <TripBoatPicker selected={boat?.id} onSelect={setBoat} />}
        <TripOptions
          title={title}
          onTitle={setTitle}
          visibility={visibility}
          onVisibility={setVisibility}
          disabled={busy}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy || (visibility !== "private" && !boat)}
          onPress={() => void start()}
          style={{
            padding: 16,
            minHeight: 48,
            backgroundColor: "#006b62",
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "white", textAlign: "center" }}>
            {busy
              ? t("Starting…")
              : visibility === "private"
                ? t("Start private recording")
                : visibility === "public"
                  ? t("Start recording · share publicly")
                  : t("Start recording · share by link")}
          </Text>
        </Pressable>
        <TripAccountLink />
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: c.text }}>
            {translateMessage(error)}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
