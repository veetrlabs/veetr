import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { trackingRpc } from "./client";
import { claimRacePhone } from "./racePhone";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function ReadyRaceOptions() {
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [rows, setRows] = useState<
      {
        eventId: string;
        boatId: string;
        boatName: string;
        raceName: string;
        scheduledStart: string;
      }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () =>
      trackingRpc<typeof rows>("my_ready_races")
        .then((r) => {
          if (live) setRows(r);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    void load();
    const t = setInterval(load, 15000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  return (
    <View style={{ gap: 12 }}>
      {rows.map((r) => (
        <Pressable
          key={r.eventId + r.boatId}
          accessibilityRole="button"
          disabled={busy}
          style={{ padding: 18, borderRadius: 12, backgroundColor: c.buttonBg }}
          onPress={() => {
            setBusy(true);
            setError("");
            void trackingRpc<{ token: string }>("connect_my_race_phone", {
              eid: r.eventId,
              bid: r.boatId,
            })
              .then((x) => claimRacePhone(x.token))
              .then(() => router.push("/race-phone" as Href))
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          <Text style={{ color: c.text, fontWeight: "700" }}>
            {r.boatName} · {r.raceName}
          </Text>
          <Text style={{ color: c.text }}>
            Expected start {new Date(r.scheduledStart).toLocaleString()}
          </Text>
          <Text style={{ color: c.text }}>Open race readiness →</Text>
        </Pressable>
      ))}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: c.text }}>
          {error}
        </Text>
      )}
    </View>
  );
}
