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
        backgroundColor: label === "Start tracking" || label === "Stop tracking" ? "#006b62" : colors.buttonBg,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={{ color: label === "Start tracking" || label === "Stop tracking" ? "white" : colors.text, textAlign: "center", fontWeight: "600" }}
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
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>Your sailing</Text>
      <Text style={{ color: colors.textMuted }}>Private · saved on this phone</Text>
      {!session ? (
        button("Start tracking", () => void run(startLocalTracking))
      ) : (
        <>
          <Text style={{ color: colors.text }}>
            {session.phase === "recording"
              ? "● RECORDING"
              : "NOT RECORDING — saved session"}{" "}
            · {count} saved positions
          </Text>
          <Text style={{ color: colors.text }}>
            {session.lastRecordedAt
              ? `Last GPS fix ${Math.max(0, Math.floor((now - Date.parse(session.lastRecordedAt)) / 1000))}s ago`
              : "Waiting for an accurate GPS fix"}
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            Started {new Date(session.startedAt).toLocaleString()}. Automatic
            stop at {new Date(session.expiresAt).toLocaleTimeString()}.
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
          {session.phase === "recording" && (
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              {session.backgroundEnabled
                ? "Screen-lock recording ready"
                : "Screen-lock recording is NOT enabled"}
            </Text>
          )}
          {session.stopReason && (
            <Text style={{ color: colors.text }}>
              Stopped:{" "}
              {session.stopReason === "expired"
                ? "12-hour recording limit reached"
                : "Stop button"}
            </Text>
          )}
          {session.phase === "stopping" &&
            button("Start tracking", () =>
              Alert.alert(
                "Start a new recording?",
                "The previous recording will stay in History. Allow background location to record with the screen locked.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Start recording",
                    onPress: () => void run(startLocalTracking),
                  },
                ],
              ),
            )}
          {session.lastTaskError && (
            <Text style={{ color: colors.text }}>
              Last background task error: {session.lastTaskError}
            </Text>
          )}
          {session.error && (
            <Text accessibilityRole="alert" style={{ color: colors.text }}>
              {session.error}
            </Text>
          )}
          {session.phase === "recording" ? (
            <>
              {button("Stop tracking", () => void run(stopTracking), false)}
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
