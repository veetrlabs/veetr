import { locale, translateMessage, t, useLanguageRefresh } from '../i18n';
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { trackingRpc } from "./client";
import { trackingStore } from "./database";
import { readyForRace, resumeTracking, stopTracking } from "./service";
import {
  claimRacePhone,
  racePhoneRpc,
  savedRacePhone,
  type RacePhone,
} from "./racePhone";
import { invitationToken } from "./invitationLink";
import type { TrackingSession } from "./model";
export default function RacePhoneScreen({ token }: { token?: string }) {
  useLanguageRefresh();
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [invitation, setInvitation] = useState("");
  const [showInvitation, setShowInvitation] = useState(false);
  const [phone, setPhone] = useState<RacePhone | null>(null),
    [session, setSession] = useState<TrackingSession | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const current = await (await trackingStore()).get();
        let info = token
          ? await trackingRpc<RacePhone | null>("preview_race_tracking_link", {
              token,
            })
          : await savedRacePhone();
        if (!token && current?.mode === "race")
          info = await racePhoneRpc<RacePhone>(
            current.raceLinkId!,
            "race_phone_status",
          );
        else if (info && !token)
          info = await racePhoneRpc<RacePhone>(
            info.linkId,
            "race_phone_status",
          );
        if (alive) {
          setSession(current);
          setPhone(info);
          setLoaded(true);
        }
      } catch (e) {
        if (alive) {
          setError((e as Error).message);
          setLoaded(true);
        }
      }
    };
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token]);
  const own =
    session?.mode === "race" && session.raceLinkId === phone?.linkId
      ? session
      : null;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setSession(await (await trackingStore()).get());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const button = (
    label: string,
    fn: () => void,
    primary = false,
    disabled = busy,
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : fn}
      style={{
        padding: 18,
        borderRadius: 12,
        backgroundColor: primary ? "#006b62" : c.buttonBg,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          color: primary ? "white" : c.text,
          fontWeight: "600",
          textAlign: "center",
          fontSize: 18,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        {button(t("Back"), () =>
          router.canGoBack() ? router.back() : router.replace("/regattas"),
        )}
        {!loaded ? (
          <Text style={{ color: c.text }}>{t("Opening your invitation…")}</Text>
        ) : !phone ? (
          <View style={{ gap: 12 }}>
            <Text
              accessibilityRole="header"
              style={{ color: c.text, fontSize: 28, fontWeight: "700" }}
            >
              {t("Join your boat")}</Text>
            <Text style={{ color: c.text }}>
              {t("Open the boat invitation your referee sent through WhatsApp or email, or paste it below. It connects this phone to the right boat and race. No account needed.")}</Text>
          </View>
        ) : (
          <>
            <Text style={{ color: c.text, fontSize: 32, fontWeight: "700" }}>
              {phone.boatName}
            </Text>
            <Text style={{ color: c.text, fontSize: 22 }}>
              {phone.raceName}
            </Text>
            <Text style={{ color: c.textSecondary }}>
              {t("Expected start:")} {new Date(phone.scheduledStart).toLocaleString(locale())}
            </Text>
            {!phone.valid && !own ? (
              <Text style={{ color: c.text }}>
                {t("This invitation has expired or been revoked. Ask the referee for a new link.")}</Text>
            ) : own ? (
              <View style={{ gap: 16 }}>
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: c.text, fontSize: 24, fontWeight: "700" }}
                >
                  {!phone.valid
                    ? t("Race tracking ended")
                    : own.phase === "starting"
                      ? t("Connecting…")
                      : own.phase === "stopping"
                        ? t("Stopped on this phone")
                        : own.raceActive
                          ? t("Sharing {{v0}}", { v0: phone.boatName })
                          : t("Ready — waiting for the referee")}
                </Text>
                <Text style={{ color: c.textSecondary }}>
                  {own.raceCheckedAt &&
                  Date.now() - Date.parse(own.raceCheckedAt) < 60000
                    ? t("Connected to race control.")
                    : t("Waiting for connection to race control. Automatic sharing needs internet.")}
                </Text>
                {!phone.eligible && (
                  <Text style={{ color: c.text }}>
                    {t("Waiting for the referee to add your boat to a published heat.")}</Text>
                )}
                <Text style={{ color: c.textSecondary }}>
                  {t("Keep Veetr running in the background. You can lock the screen. Do not force-close the app. Readiness ends at")}{" "}
                  {new Date(own.expiresAt).toLocaleString(locale())}.
                  {t(" Once the race is active, GPS positions are saved during internet outages and uploaded after reconnection. Offline recording ends at the expiry above or when you stop on this phone.")}
                </Text>
                {own.error && (
                  <Text accessibilityRole="alert" style={{ color: c.text }}>
                    {translateMessage(own.error)}
                  </Text>
                )}
                {own.phase !== "stopping" &&
                  button(
                    t("Stop / leave race"),
                    () => void run(() => stopTracking()),
                    true,
                    false,
                  )}
                {button(
                  own.phase === "stopping"
                    ? t("Finish syncing")
                    : t("Check connection / retry"),
                  () => void run(resumeTracking),
                )}
              </View>
            ) : (
              <>
                <Text style={{ color: c.text }}>
                  {t("Get ready now. GPS stays on while you wait, using battery. Your position becomes public on the live map and in replay only while the referee enables tracking for this race.")}</Text>
                {Platform.OS === 'android' && <Text style={{ color: c.textSecondary }}>{t("Android saves a local backup from five minutes before the planned start. Only positions inside the referee’s tracking window are shared.")}</Text>}
                <Text style={{ color: c.textSecondary }}>
                  {t("Allow background location and keep internet available. You will not need to press another button at the start. Closing the app or losing connectivity can delay or prevent sharing.")}</Text>
                {session &&
                !(session.mode === "local" && session.phase === "stopping") ? (
                  <Text style={{ color: c.text }}>
                    {t("Finish the current recording or sharing session before getting ready for this race.")}</Text>
                ) : (
                  button(
                    t("Ready to race"),
                    () =>
                      Alert.alert(
                        t("Get ready to share your position?"),
                        t("This phone will track {{v0}}. Sharing starts automatically when the referee opens tracking and pauses when they close it. Your shared route is available in replay.", { v0: phone.boatName }),
                        [
                          { text: t("Cancel"), style: "cancel" },
                          {
                            text: t("Ready to race"),
                            onPress: () =>
                              void run(async () => {
                                const paired = token
                                  ? await claimRacePhone(token)
                                  : await racePhoneRpc<RacePhone>(
                                      phone.linkId,
                                      "race_phone_status",
                                    );
                                setPhone(paired);
                                await readyForRace(paired);
                              }),
                          },
                        ],
                      ),
                    true,
                  )
                )}
              </>
            )}
          </>
        )}
        {loaded && !token && (!phone || showInvitation) && (
          <View style={{ gap: 12 }}>
            <TextInput
              accessibilityLabel={t("Boat invitation link")}
              placeholder={t("Paste your Veetr invitation link")}
              placeholderTextColor={c.textSecondary}
              value={invitation}
              onChangeText={setInvitation}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                padding: 16,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 12,
                color: c.text,
              }}
            />
            {button(
              t("Open invitation"),
              () => {
                const nextToken = invitationToken(invitation);
                if (!nextToken) {
                  setError(
                    "Paste the complete Veetr boat invitation link sent by your referee.",
                  );
                  return;
                }
                setError("");
                router.push(`/join/${nextToken}` as Href);
              },
              true,
            )}
          </View>
        )}
        {loaded &&
          !token &&
          phone &&
          !showInvitation &&
          !own &&
          button(t("Use another invitation"), () => setShowInvitation(true))}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: c.text }}>
            {translateMessage(error)}
          </Text>
        )}
        {session && session.mode !== "race" && session.mode !== "local" &&
          button(t("Manage existing live sharing"), () => router.push("/regatta-sharing"))}
        {session?.mode === "race" &&
          !own &&
          button(t("Open current race"), () => router.replace("../race-phone"))}
        {session?.mode === "race" &&
          !own &&
          session.phase !== "stopping" &&
          button(
            t("Stop current race tracking"),
            () => void run(() => stopTracking()),
            true,
            false,
          )}
        {button(t("Location settings"), () => void Linking.openSettings())}
      </ScrollView>
    </SafeAreaView>
  );
}
