import { useEffect, useState } from "react";
import {
  Alert,
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
        {button("Back", () =>
          router.canGoBack() ? router.back() : router.replace("/regattas"),
        )}
        {!loaded ? (
          <Text style={{ color: c.text }}>Opening your invitation…</Text>
        ) : !phone ? (
          <View style={{ gap: 12 }}>
            <Text
              accessibilityRole="header"
              style={{ color: c.text, fontSize: 28, fontWeight: "700" }}
            >
              Join your boat
            </Text>
            <Text style={{ color: c.text }}>
              Open the boat invitation your referee sent through WhatsApp or
              email, or paste it below. It connects this phone to the right boat
              and race. No account needed.
            </Text>
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
              Expected start: {new Date(phone.scheduledStart).toLocaleString()}
            </Text>
            {!phone.valid && !own ? (
              <Text style={{ color: c.text }}>
                This invitation has expired or been revoked. Ask the referee for
                a new link.
              </Text>
            ) : own ? (
              <View style={{ gap: 16 }}>
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: c.text, fontSize: 24, fontWeight: "700" }}
                >
                  {!phone.valid
                    ? "Race tracking ended"
                    : own.phase === "starting"
                      ? "Connecting…"
                      : own.phase === "stopping"
                        ? "Stopped on this phone"
                        : own.raceActive
                          ? `Sharing ${phone.boatName}`
                          : "Ready — waiting for the referee"}
                </Text>
                <Text style={{ color: c.textSecondary }}>
                  {own.raceCheckedAt &&
                  Date.now() - Date.parse(own.raceCheckedAt) < 60000
                    ? "Connected to race control."
                    : "Waiting for connection to race control. Automatic sharing needs internet."}
                </Text>
                {!phone.eligible && (
                  <Text style={{ color: c.text }}>
                    Waiting for the referee to add your boat to a published
                    heat.
                  </Text>
                )}
                <Text style={{ color: c.textSecondary }}>
                  Keep Veetr running in the background. You can lock the screen.
                  Do not force-close the app. Readiness ends at{" "}
                  {new Date(own.expiresAt).toLocaleString()}.
                </Text>
                {own.error && (
                  <Text accessibilityRole="alert" style={{ color: c.text }}>
                    {own.error}
                  </Text>
                )}
                {own.phase !== "stopping" &&
                  button(
                    "Stop / leave race",
                    () => void run(() => stopTracking()),
                    true,
                    false,
                  )}
                {button(
                  own.phase === "stopping"
                    ? "Finish syncing"
                    : "Check connection / retry",
                  () => void run(resumeTracking),
                )}
              </View>
            ) : (
              <>
                <Text style={{ color: c.text }}>
                  Get ready now. GPS stays on while you wait, using battery.
                  Your position becomes public on the live map and in replay
                  only while the referee enables tracking for this race.
                </Text>
                <Text style={{ color: c.textSecondary }}>
                  Allow background location and keep internet available. You
                  will not need to press another button at the start. Closing
                  the app or losing connectivity can delay or prevent sharing.
                </Text>
                {session &&
                !(session.mode === "local" && session.phase === "stopping") ? (
                  <Text style={{ color: c.text }}>
                    Finish the current recording or sharing session before
                    getting ready for this race.
                  </Text>
                ) : (
                  button(
                    "Ready to race",
                    () =>
                      Alert.alert(
                        "Get ready to share your position?",
                        `This phone will track ${phone.boatName}. Sharing starts automatically when the referee opens tracking and pauses when they close it. Your shared route is available in replay.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Ready to race",
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
              accessibilityLabel="Boat invitation link"
              placeholder="Paste your Veetr invitation link"
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
              "Open invitation",
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
          button("Use another invitation", () => setShowInvitation(true))}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: c.text }}>
            {error}
          </Text>
        )}
        {session && session.mode !== "race" && session.mode !== "local" &&
          button("Manage existing live sharing", () => router.push("/regatta-sharing"))}
        {session?.mode === "race" &&
          !own &&
          button("Open current race", () => router.replace("../race-phone"))}
        {session?.mode === "race" &&
          !own &&
          session.phase !== "stopping" &&
          button(
            "Stop current race tracking",
            () => void run(() => stopTracking()),
            true,
            false,
          )}
        {button("Location settings", () => void Linking.openSettings())}
      </ScrollView>
    </SafeAreaView>
  );
}
