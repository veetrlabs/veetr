import ReadyRaceOptions from "../tracking/ReadyRaceOptions";
import AccountSignIn from "../components/AccountSignIn";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { trackingClient, trackingRpc } from "../tracking/client";
import { trackingStore } from "../tracking/database";
import {
  startTracking,
  stopTracking,
  resumeTracking,
  discardStoppedTracking,
} from "../tracking/service";
import type { TrackingEntry, TrackingSession } from "../tracking/model";
const site = (process.env.EXPO_PUBLIC_SITE_URL || "https://veetr.org").replace(
  /\/$/,
  "",
);
export default function RegattaSharingScreen() {
  const { theme } = useTheme(),
    colors = themeColors[theme];
  const [auth, setAuth] = useState<Session | null>(null),
    [ready, setReady] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);
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
    if (!auth) {
      setEntriesLoading(false);
      return;
    }
    setEntriesLoading(true);
    let alive = true;
    void trackingRpc<TrackingEntry[]>("my_tracking_entries")
      .then((rows) => {
        if (alive) setEntries(rows);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setEntriesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [auth?.user.id]);
  const ownSession =
    session &&
    session.mode !== "local" &&
    session.mode !== "race" &&
    session.userId === auth?.user.id
      ? session
      : null;
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
        {button("Back", () => router.back())}
        <Text style={[styles.title, text]}>Share boat location</Text>
        {!ownSession && (
          <Text style={{ color: colors.textSecondary }}>
            Choose your boat and regatta, then start live sharing. This starts
            GPS tracking and shares your position on the public map.
          </Text>
        )}
        {!trackingClient ? (
          <Text style={{ color: colors.textMuted }}>
            Regatta sign-in is currently unavailable.
          </Text>
        ) : !ready ? (
          <Text style={text}>Restoring account…</Text>
        ) : !auth && !showSignIn ? (
          button("Sign in for regatta tracking", () => setShowSignIn(true))
        ) : !auth ? (
          <AccountSignIn />
        ) : (
          <>
            <ReadyRaceOptions />
            <Text style={{ color: colors.textSecondary }}>
              {auth.user.email}
            </Text>
            {session && session.mode !== "local" && !ownSession ? (
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
                  "Open spectator map",
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
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={[styles.heading, text]}>
                  Choose a boat to track
                </Text>
                {entriesLoading && <Text style={text}>Loading regattas…</Text>}
                {!entriesLoading && !entries.length && (
                  <Text style={text}>
                    No connected boats yet. Open your referee’s invitation to
                    connect a boat.
                  </Text>
                )}
                {button(
                  "Find regattas",
                  () => void Linking.openURL(`${site}/races/`),
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
                    <Text style={[styles.heading, text]}>
                      {entry.seriesName}
                    </Text>
                    <Text style={text}>{entry.boatName}</Text>
                    {entry.eligible === false ? (
                      <Text style={text}>
                        Waiting for entry in a published heat
                      </Text>
                    ) : entry.open === false ? (
                      <Text style={text}>
                        Waiting for the referee to open tracking
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
                {button(
                  "Refresh regattas",
                  () =>
                    void run(async () => {
                      setEntries(await trackingRpc("my_tracking_entries"));
                      setSelected(null);
                    }),
                )}
                {session?.mode === "local" && session.phase !== "stopping" && (
                  <Text style={{ color: colors.textMuted }}>
                    Stop private tracking before joining a regatta.
                  </Text>
                )}
                {button(
                  selected?.tracking
                    ? "Take over live sharing"
                    : "Start live sharing",
                  () =>
                    selected &&
                    Alert.alert(
                      selected.tracking
                        ? "Take over this boat’s tracking?"
                        : "Share your boat’s location?",
                      `${selected.tracking ? "This stops the other phone’s live session and starts sharing from this phone. " : ""}${selected.boatName} will appear publicly in ${selected.seriesName}, live and in replay after you stop sharing. Private recordings are never shared. Allow background location to keep tracking with the screen locked.`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: selected.tracking
                            ? "Take over"
                            : "Start live sharing",
                          onPress: () =>
                            void run(async () => {
                              if (session?.mode === "local") {
                                if (session.phase !== "stopping")
                                  throw new Error(
                                    "Stop private tracking first.",
                                  );
                                await (await trackingStore()).archiveLocal();
                              }
                              await startTracking(
                                selected,
                                true,
                                Boolean(selected.tracking),
                              );
                            }),
                        },
                      ],
                    ),
                  true,
                  busy ||
                    entriesLoading ||
                    !selected ||
                    selected.open === false ||
                    selected.eligible === false ||
                    Boolean(
                      session?.mode === "local" && session.phase !== "stopping",
                    ),
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
