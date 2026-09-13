import { useRouter } from "expo-router";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import type { TrackingSession } from "./model";
import { trackingStore } from "./database";
import {
  startLocalTracking,
  stopTracking,
  resumeTracking,
  enableBackgroundTracking,
  discardStoppedTracking,
} from "./service";
export default function LocalRecording({
  session,
  count,
  now,
  busy,
  run,
}: {
  session: TrackingSession | null;
  count: number;
  now: number;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const colors = themeColors[theme];
  const button = (label: string, action: () => void, disabled = busy) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={action}
      style={{
        padding: 16,
        borderRadius: 8,
        backgroundColor: colors.buttonBg,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{ color: colors.text, textAlign: "center", fontWeight: "600" }}
      >
        {label}
      </Text>
    </Pressable>
  );
  async function exportRecording() {
    if (!session) return;
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("File sharing is unavailable on this device.");
    const data = await (await trackingStore()).exportLocal(session.id);
    const file = new File(Paths.cache, `veetr-gps-${session.id}.json`);
    try {
      file.write(JSON.stringify(data, null, 2));
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        UTI: "public.json",
      });
    } finally {
      if (file.exists) file.delete();
    }
  }
  return (
    <View
      style={{
        gap: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
        Record locally
      </Text>
      <Text style={{ color: colors.textSecondary }}>
        Record phone GPS without an account or internet. Positions stay on this
        phone and are never automatically uploaded.
      </Text>
      {!session && (
        <>
          <Text style={{ color: colors.textSecondary }}>
            On iPhone, choose Allow While Using App in the first prompt, then
            Always when asked. You can still record with the app open if you
            allow only foreground access. Keep Precise Location on.
          </Text>
          {button("Location settings", () => void Linking.openSettings())}
        </>
      )}
      {!session ? (
        button("Start local recording", () =>
          Alert.alert(
            "Record GPS on this phone?",
            "Allow background location to record with the screen locked. Recording stops after 12 hours. You can export or delete it after stopping.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Record", onPress: () => void run(startLocalTracking) },
            ],
          ),
        )
      ) : (
        <>
          <Text style={{ color: colors.text }}>
            {session.phase === "recording" ? "Recording" : "Recording stopped"}{" "}
            · {count} saved positions
          </Text>
          <Text style={{ color: colors.text }}>
            {session.lastRecordedAt
              ? `Last GPS fix ${Math.max(0, Math.floor((now - Date.parse(session.lastRecordedAt)) / 1000))}s ago`
              : "Waiting for an accurate GPS fix"}
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            Started {new Date(session.startedAt).toLocaleString()}. Automatic
            stop at {new Date(session.expiresAt).toLocaleTimeString()}. Keep the
            app installed; force-closing it can stop GPS.
          </Text>
          {session.phase === "recording" &&
            session.backgroundEnabled === false && (
              <>
                <Text style={{ color: colors.text }}>
                  Foreground recording only. Keep Veetr open; recording pauses
                  when you lock the screen or switch apps.
                </Text>
                {button(
                  "Enable background recording",
                  () => void run(enableBackgroundTracking),
                )}
              </>
            )}
          {button("View map and track", () => router.push("/(tabs)/map"))}
          {button("View live instruments", () => router.push("/(tabs)"))}
          {session.error && (
            <Text accessibilityRole="alert" style={{ color: colors.text }}>
              {session.error}
            </Text>
          )}
          {session.phase === "recording" ? (
            <>
              {button("Stop recording", () => void run(stopTracking), false)}
              {button("Resume GPS", () => void run(resumeTracking))}
            </>
          ) : (
            <>
              {button("Export recording", () => void run(exportRecording))}
              {button("Delete recording", () =>
                Alert.alert(
                  "Delete local recording?",
                  "All saved positions will be permanently removed from this phone. Export first if you want to keep them.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => void run(discardStoppedTracking),
                    },
                  ],
                ),
              )}
            </>
          )}
          {button("Location settings", () => void Linking.openSettings())}
        </>
      )}
    </View>
  );
}
