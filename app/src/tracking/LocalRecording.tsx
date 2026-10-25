import { locale, translateMessage, t, useLanguageRefresh } from '../i18n';
import { errorOccurredAt } from "./errorHistory";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import type { TrackingSession } from "./model";
import { stopTracking } from "./service";
import TrackingIcon from "./TrackingIcon";
import { durationLabel } from "./trip";
import { trackingErrorMessage } from "./errorMessage";
import { recordingStatus } from "./recordingStatus";
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
  useLanguageRefresh();
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [help, setHelp] = useState<number | null>(null);
  const active = session?.phase === "recording";
  const recordingError = trackingErrorMessage(session?.error || session?.lastTaskError, errorOccurredAt(session));
  const age = session?.lastRecordedAt
    ? Math.max(0, now - Date.parse(session.lastRecordedAt))
    : null;
  const metrics = session
    ? [
        {
          icon: "points" as const,
          value: String(count),
          label: t("Saved positions"),
          help: t("GPS positions saved privately on this phone. Tap a trip below to explore its route."),
        },
        {
          icon: "gps" as const,
          value: age === null ? t("Waiting") : t("{{v0}} ago", { v0: durationLabel(age) }),
          label: t("Last GPS fix"),
          help: t("Time since the latest saved GPS position. A long delay can mean poor reception or interrupted recording."),
        },
        {
          icon: "clock" as const,
          value: durationLabel(
            (active
              ? now
              : Date.parse(session.stoppedAt || session.startedAt)) -
              Date.parse(session.startedAt),
          ),
          label: t("Elapsed time"),
          help: t("How long this trip has been recording."),
        },
        {
          icon: "stop" as const,
          value: new Date(session.expiresAt).toLocaleTimeString(locale(), {
            hour: "2-digit",
            minute: "2-digit",
          }),
          label: t("Automatic stop"),
          help: t("Recording stops automatically at this time, 12 hours after it started."),
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
      {active && session && (
        <Text style={{ color: "#008c80", fontWeight: "600" }}>
          {`● ${recordingStatus(session, now)}`}
        </Text>
      )}
      {active && (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {metrics.map((m, i) => (
            <Pressable
              key={m.label}
              accessibilityRole="button"
              accessibilityLabel={`${m.label}: ${m.value}`}
              accessibilityHint={t("Tap for an explanation")}
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
      {help !== null && active && (
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
            {metrics[help]?.label}
          </Text>
          <Text
            style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}
          >
            {metrics[help]?.help}
          </Text>
        </View>
      )}
      {active && session?.backgroundEnabled === false && (
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
        >
          <Text style={{ color: "#b7791f", fontSize: 13 }}>
            {t("Keep app open · background GPS is off ›")}</Text>
        </Pressable>
      )}
      {session?.boatId && <Text style={{color:c.text}}>{session.boatName}</Text>}
      {active && session && <Pressable accessibilityRole="button" onPress={() => router.push({pathname:"/trip-sharing",params:{id:session.id}})} style={{paddingVertical:12}}><Text style={{color:c.text}}>{session.sharing?.visibility && session.sharing.visibility!=="private" ? t("● Sharing live · Manage / stop sharing") : t("Share this trip live")} ›</Text></Pressable>}
      {session?.sharing?.error && <Text accessibilityRole="alert" style={{color:c.text}}>{translateMessage(session.sharing.error)}</Text>}
      {active && recordingError && (recordingError.settings ? (
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
        >
          <Text
            accessibilityRole="alert"
            style={{ color: c.textSecondary, fontSize: 13 }}
          >
            {translateMessage(recordingError.text)}  {t("· Help in Settings ›")}</Text>
        </Pressable>
      ) : <Text accessibilityRole="alert" style={{ color: c.textSecondary, fontSize: 13 }}>{translateMessage(recordingError.text)}</Text>)}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => active ? void run(stopTracking) : router.push("/start-trip")}
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
            ? t("Working…")
            : active
              ? t("Stop recording")
              : t("Start recording")}
        </Text>
      </Pressable>
    </View>
  );
}
