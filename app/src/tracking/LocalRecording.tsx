import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import type { TrackingSession } from "./model";
import { startLocalTracking, stopTracking } from "./service";
import TrackingIcon from "./TrackingIcon";
import { durationLabel } from "./trip";
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
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [help, setHelp] = useState<number | null>(null);
  const active = session?.phase === "recording";
  const age = session?.lastRecordedAt
    ? Math.max(0, now - Date.parse(session.lastRecordedAt))
    : null;
  const metrics = session
    ? [
        {
          icon: "points" as const,
          value: String(count),
          label: "Saved positions",
          help: "GPS positions saved privately on this phone. Tap a trip below to explore its route.",
        },
        {
          icon: "gps" as const,
          value: age === null ? "Waiting" : `${durationLabel(age)} ago`,
          label: "Last GPS fix",
          help: "Time since the latest saved GPS position. A long delay can mean poor reception or interrupted recording.",
        },
        {
          icon: "clock" as const,
          value: durationLabel(
            (active
              ? now
              : Date.parse(session.stoppedAt || session.startedAt)) -
              Date.parse(session.startedAt),
          ),
          label: "Elapsed time",
          help: "How long this trip has been recording.",
        },
        {
          icon: "stop" as const,
          value: new Date(session.expiresAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          label: "Automatic stop",
          help: "Recording stops automatically at this time, 12 hours after it started.",
        },
      ]
    : [];
  return (
    <View
      style={{
        backgroundColor: c.panelBg,
        borderRadius: 20,
        padding: 16,
        gap: 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: active ? "#008c80" : c.text, fontWeight: "600" }}>
          {active ? "● Recording" : "Ready to sail"}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recording privacy and screen lock help"
          onPress={() => setHelp(help === 4 ? null : 4)}
          style={{
            flexDirection: "row",
            gap: 5,
            padding: 8,
            alignItems: "center",
          }}
        >
          <TrackingIcon name="lock" color={c.textMuted} size={15} />
          <Text style={{ color: c.textMuted, fontSize: 12 }}>Private</Text>
        </Pressable>
      </View>
      {active && (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {metrics.map((m, i) => (
            <Pressable
              key={m.label}
              accessibilityRole="button"
              accessibilityLabel={`${m.label}: ${m.value}`}
              accessibilityHint="Tap for an explanation"
              accessibilityState={{ expanded: help === i }}
              onPress={() => setHelp(help === i ? null : i)}
              style={{
                width: "50%",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 48,
                paddingVertical: 8,
              }}
            >
              <TrackingIcon
                name={m.icon}
                color={
                  i === 1 && (age === null || age > 60000)
                    ? "#b7791f"
                    : c.textMuted
                }
              />
              <Text
                style={{
                  color: c.text,
                  fontSize: 16,
                  fontWeight: "600",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {m.value}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {help !== null && (help === 4 || active) && (
        <View
          accessibilityLiveRegion="polite"
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: c.buttonBg,
            gap: 4,
          }}
        >
          <Text style={{ color: c.text, fontWeight: "600" }}>
            {help === 4 ? "Private recording" : metrics[help]?.label}
          </Text>
          <Text
            style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}
          >
            {help === 4
              ? `Trips stay on this phone. ${active ? (session?.backgroundEnabled ? "Recording can continue with the screen locked." : "Keep Veetr open. Enable background recording in Settings → Location & tracking to record with the screen locked.") : "Allow background location when starting to record with the screen locked."}`
              : metrics[help]?.help}
          </Text>
        </View>
      )}
      {active && session?.backgroundEnabled === false && (
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
        >
          <Text style={{ color: "#b7791f", fontSize: 13 }}>
            Keep app open · background GPS is off ›
          </Text>
        </Pressable>
      )}
      {active && (session?.error || session?.lastTaskError) && (
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
        >
          <Text
            accessibilityRole="alert"
            style={{ color: c.textSecondary, fontSize: 13 }}
          >
            {session.error || session.lastTaskError} · Help in Settings ›
          </Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void run(active ? stopTracking : startLocalTracking)}
        style={{
          backgroundColor: "#006b62",
          borderRadius: 12,
          padding: 16,
          opacity: busy ? 0.5 : 1,
        }}
      >
        <Text
          style={{ color: "white", fontWeight: "600", textAlign: "center" }}
        >
          {busy
            ? "Working…"
            : active
              ? "Stop recording"
              : "Start private recording"}
        </Text>
      </Pressable>
    </View>
  );
}
