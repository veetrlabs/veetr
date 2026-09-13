import LocalRecording from "../../tracking/LocalRecording";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { useTheme } from "../../context/ThemeContext";
import { themeColors } from "../../constants/colors";
import { trackingClient, trackingRpc } from "../../tracking/client";
import { trackingStore } from "../../tracking/database";
import {
  startTracking,
  stopTracking,
  resumeTracking,
  discardStoppedTracking,
} from "../../tracking/service";
import type { TrackingEntry, TrackingSession } from "../../tracking/model";
const site = (process.env.EXPO_PUBLIC_SITE_URL || "https://veetr.org").replace(
  /\/$/,
  "",
);
export default function TrackingScreen() {
  const { theme } = useTheme(),
    colors = themeColors[theme];
  const [auth, setAuth] = useState<Session | null>(null),
    [ready, setReady] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [entries, setEntries] = useState<TrackingEntry[]>([]),
    [selected, setSelected] = useState<TrackingEntry | null>(null);
  const [session, setSession] = useState<TrackingSession | null>(null),
    [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now());
  async function refresh() {
    const store = await trackingStore();
    setSession(await store.get());
    setPending(await store.count());
    setNow(Date.now());
  }
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      await refresh().catch(() => {});
      setBusy(false);
    }
  }
  useEffect(() => {
    const timer = setInterval(() => {
      void refresh().catch((e) => setError(String(e)));
    }, 2000);
    void refresh().catch((e) => setError(String(e)));
    if (!trackingClient) {
      setReady(true);
      return () => clearInterval(timer);
    }
    let alive = true;
    void trackingClient.auth.getSession().then(({ data, error }) => {
      if (alive) {
        setAuth(data.session);
        setReady(true);
        if (error) setError(error.message);
      }
    });
    const {
      data: { subscription },
    } = trackingClient.auth.onAuthStateChange((_event, s) => {
      setAuth(s);
      setReady(true);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    setEntries([]);
    setSelected(null);
    if (!auth) return;
    let alive = true;
    void trackingRpc<TrackingEntry[]>("my_tracking_entries")
      .then((rows) => {
        if (alive) setEntries(rows);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [auth?.user.id]);
  const ownSession =
    session && session.userId === auth?.user.id ? session : null;
  const text = { color: colors.text };
  const button = (
    title: string,
    action: () => void,
    primary = false,
    disabled = busy,
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={action}
      style={[
        styles.button,
        {
          backgroundColor: primary ? "#006b62" : colors.buttonBg,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: primary ? "white" : colors.text,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
  const active = ownSession?.phase === "recording";
  const fixAge = ownSession?.lastRecordedAt
    ? Math.max(
        0,
        Math.floor((now - Date.parse(ownSession.lastRecordedAt)) / 1000),
      )
    : null;
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, text]}>Regatta tracking</Text>
        <Text style={{ color: colors.textSecondary }}>
          Your phone is your boat’s tracker. No Veetr device needed.
        </Text>
        {(!session || session.mode === "local") && (
          <LocalRecording
            session={session}
            count={pending}
            now={now}
            busy={busy}
            run={run}
          />
        )}
        {session?.mode === "local" ? null : !trackingClient ? (
          <Text style={text}>
            Tracking is not configured in this build. Set the Supabase URL and
            public key, then rebuild the app.
          </Text>
        ) : !ready ? (
          <Text style={text}>Restoring account…</Text>
        ) : !auth ? (
          <View style={styles.section}>
            <Text style={[styles.heading, text]}>
              Sign in to your Veetr account
            </Text>
            <TextInput
              accessibilityLabel="Email"
              placeholder="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                text,
                { borderColor: colors.border, backgroundColor: colors.inputBg },
              ]}
            />
            <TextInput
              accessibilityLabel="Password"
              placeholder="Password"
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                text,
                { borderColor: colors.border, backgroundColor: colors.inputBg },
              ]}
            />
            {button(
              "Sign in",
              () =>
                void run(async () => {
                  const { error } =
                    await trackingClient!.auth.signInWithPassword({
                      email: email.trim(),
                      password,
                    });
                  if (error) throw error;
                  setPassword("");
                  await resumeTracking();
                }),
              true,
              busy || !email.trim() || !password,
            )}
            {button(
              "Create an account or reset password",
              () => void Linking.openURL(`${site}/account/`),
            )}
          </View>
        ) : (
          <>
            <Text style={{ color: colors.textSecondary }}>
              {auth.user.email}
            </Text>
            {session && !ownSession ? (
              <Text style={text}>
                A saved tracking session belongs to another account. Sign in
                with that account to finish syncing.
              </Text>
            ) : ownSession ? (
              <View
                style={[
                  styles.section,
                  styles.card,
                  {
                    backgroundColor: colors.panelBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.heading, text]}>
                  {active
                    ? "● Sharing live location"
                    : ownSession.phase === "starting"
                      ? "Starting session…"
                      : "Tracking stopped on this phone"}
                </Text>
                <Text style={[styles.heading, text]}>
                  {ownSession.boatName}
                </Text>
                <Text style={text}>{ownSession.seriesName}</Text>
                {active && (
                  <Text style={text}>
                    {fixAge === null
                      ? "Waiting for GPS…"
                      : fixAge > 30
                        ? `GPS may be paused · last fix ${fixAge}s ago`
                        : `Last GPS fix ${fixAge}s ago`}{" "}
                    · phone GPS
                  </Text>
                )}
                <Text style={text}>{pending} positions waiting to upload</Text>
                <Text style={{ color: colors.textSecondary }}>
                  {ownSession.lastUploadAt
                    ? `Last upload ${new Date(ownSession.lastUploadAt).toLocaleTimeString()}`
                    : "No positions uploaded yet"}
                </Text>
                {active && (
                  <Text style={{ color: colors.textSecondary }}>
                    Automatic stop at{" "}
                    {new Date(ownSession.expiresAt).toLocaleTimeString()}. Keep
                    the app installed and allow background location;
                    force-closing it may stop tracking.
                  </Text>
                )}
                {ownSession.phase === "stopping" && (
                  <Text style={text}>
                    Reconnect to finish syncing and confirm the stop on the live
                    map. Saved positions stay on this phone until acknowledged.
                  </Text>
                )}
                {ownSession.error && (
                  <Text
                    accessibilityRole="alert"
                    style={{ color: colors.text }}
                  >
                    {ownSession.error}
                  </Text>
                )}
                {button(
                  "View live map",
                  () =>
                    void Linking.openURL(
                      `${site}/races/?series=${encodeURIComponent(ownSession.seriesId)}#tracking`,
                    ),
                )}
                {ownSession.phase !== "stopping" &&
                  button(
                    "Stop sharing",
                    () => void run(stopTracking),
                    true,
                    false,
                  )}
                {button(
                  ownSession.phase === "starting"
                    ? "Retry start"
                    : ownSession.phase === "recording"
                      ? "Resume / sync now"
                      : "Retry final sync",
                  () => void run(resumeTracking),
                )}
                {ownSession.phase === "stopping" &&
                  button("Discard unsent positions", () =>
                    Alert.alert(
                      "Discard unsent positions?",
                      "This removes this phone’s unsent track after the server confirms sharing has stopped.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Discard",
                          style: "destructive",
                          onPress: () => void run(discardStoppedTracking),
                        },
                      ],
                    ),
                  )}
                {button("Location settings", () => void Linking.openSettings())}
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={[styles.heading, text]}>
                  Choose your boat and series
                </Text>
                {!entries.length && (
                  <Text style={text}>
                    No eligible boats yet. Create or join a boat on the website,
                    then ask the organizer to register it in a published heat.
                    Boat owners and editors can track.
                  </Text>
                )}
                {entries.map((entry) => (
                  <Pressable
                    key={`${entry.seriesId}/${entry.boatId}`}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked:
                        selected?.seriesId === entry.seriesId &&
                        selected?.boatId === entry.boatId,
                    }}
                    onPress={() => setSelected(entry)}
                    disabled={busy}
                    style={[
                      styles.card,
                      {
                        borderColor:
                          selected?.seriesId === entry.seriesId &&
                          selected?.boatId === entry.boatId
                            ? "#009688"
                            : colors.border,
                        backgroundColor: colors.panelBg,
                      },
                    ]}
                  >
                    <Text style={[styles.heading, text]}>{entry.boatName}</Text>
                    <Text style={text}>{entry.seriesName}</Text>
                  </Pressable>
                ))}
                {button(
                  "Refresh boats",
                  () =>
                    void run(async () => {
                      setEntries(await trackingRpc("my_tracking_entries"));
                      setSelected(null);
                    }),
                )}
                <Text style={{ color: colors.textSecondary }}>
                  Starting shares your boat’s location, speed and recent trail
                  with anyone viewing this series. Sharing lasts until you stop
                  or 12 hours pass. Uploads target every 20 seconds; offline
                  positions are saved for retry.
                </Text>
                {button(
                  "Start sharing location",
                  () =>
                    selected &&
                    Alert.alert(
                      "Share your boat’s location?",
                      `${selected.boatName} will appear publicly in ${selected.seriesName}. Allow background location to keep tracking with the screen locked.`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Start sharing",
                          onPress: () =>
                            void run(() => startTracking(selected)),
                        },
                      ],
                    ),
                  true,
                  busy || !selected,
                )}
              </View>
            )}
            {button(
              "Sign out",
              () =>
                void run(async () => {
                  const { error } = await trackingClient!.auth.signOut({
                    scope: "local",
                  });
                  if (error) throw error;
                }),
              false,
              busy || Boolean(ownSession),
            )}
            {ownSession && (
              <Text style={{ color: colors.textSecondary }}>
                Finish this tracking session before signing out.
              </Text>
            )}
          </>
        )}
        {error ? (
          <Text accessibilityRole="alert" style={text}>
            {error}
          </Text>
        ) : null}
        {busy && (
          <Text accessibilityLiveRegion="polite" style={text}>
            Working…
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { padding: 20, gap: 16, paddingBottom: 36 },
  title: { fontSize: 28, fontWeight: "700" },
  heading: { fontSize: 18, fontWeight: "600" },
  section: { gap: 12 },
  card: { padding: 16, borderWidth: 1, borderRadius: 12, gap: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 14, fontSize: 16 },
  button: { padding: 16, borderRadius: 8, minHeight: 48 },
});
