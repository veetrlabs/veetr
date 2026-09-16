import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { trackingStore } from "./database";
import { enableBackgroundTracking, resumeTracking } from "./service";
export default function LocationSettings() {
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(background = false) {
    setBusy(true);
    try {
      const session = await (await trackingStore()).get();
      if (session?.phase !== "recording")
        throw new Error("Start a recording from Track first.");
      await (background ? enableBackgroundTracking() : resumeTracking());
      setMessage(
        background
          ? "Background recording enabled."
          : "GPS listener restarted. New fixes will appear in Track.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 18 }}>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: "700" }}>
        Location & tracking
      </Text>
      <Text style={{ color: c.textSecondary, lineHeight: 23 }}>
        For recording with the screen locked, allow Always location access and
        turn on Precise Location in your phone’s settings. Avoid force-closing
        Veetr during a trip.
      </Text>
      <Text style={{ color: c.textSecondary, lineHeight: 23 }}>
        If saved positions stop updating, move to an open area and check
        location access. Restart GPS below if the recording still does not
        recover. This keeps the same trip.
      </Text>
      {[
        {
          label: "Open location settings",
          action: () =>
            void Linking.openSettings().catch((e) => setMessage(String(e))),
        },
        { label: "Enable background recording", action: () => void run(true) },
        { label: "Restart GPS", action: () => void run() },
      ].map((b) => (
        <Pressable
          key={b.label}
          disabled={busy}
          accessibilityRole="button"
          onPress={b.action}
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: c.buttonBg,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={{ color: c.text, fontWeight: "600" }}>{b.label}</Text>
        </Pressable>
      ))}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={{ color: c.text }}>
          {message}
        </Text>
      )}
    </View>
  );
}
