import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { trackingStore } from "./database";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { KNOTS_PER_MPS } from "../navigation/model";
import type { TrackingSession, TrackingPoint } from "./model";
type Recording = {
  archived?: boolean;
  session: TrackingSession;
  points: TrackingPoint[];
};
export default function PhoneHistory() {
  const [records, setRecords] = useState<Recording[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState("");
  const { theme } = useTheme(),
    c = themeColors[theme];
  useEffect(() => {
    let alive = true;
    const refresh = () =>
      void trackingStore()
        .then((s) => s.localRecordings())
        .then((rows) => {
          if (alive) setRecords(rows);
        })
        .catch((e) => {
          if (alive) setError(String(e));
        });
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const record = records.find((r) => r.session.id === selected) ?? records[0];
  const speeds = record?.points.filter((p) => p.sogMps !== null) ?? [];
  const max = Math.max(1, ...speeds.map((p) => p.sogMps! * KNOTS_PER_MPS));
  const start = record?.points[0] ? Date.parse(record.points[0].recordedAt) : 0;
  const end = record?.points.at(-1)
    ? Date.parse(record.points.at(-1)!.recordedAt)
    : start;
  let path = "",
    previous = 0;
  // Time is the x-axis. Break the line at missing speed or gaps longer than 30 seconds.
  record?.points.forEach((p) => {
    const time = Date.parse(p.recordedAt);
    if (p.sogMps === null) {
      previous = 0;
      return;
    }
    path += `${!previous || time - previous > 30000 ? "M" : "L"}${10 + (300 * (time - start)) / Math.max(1, end - start)},${150 - (130 * p.sogMps * KNOTS_PER_MPS) / max} `;
    previous = time;
  });
  async function exportRecord() {
    if (!record) return;
    const file = new File(Paths.cache, `veetr-gps-${record.session.id}.json`);
    try {
      file.write(JSON.stringify(record, null, 2));
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        UTI: "public.json",
      });
    } catch (e) {
      setError(String(e));
    } finally {
      if (file.exists) file.delete();
    }
  }
  return (
    <View style={{ gap: 12, paddingVertical: 16 }}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>
        Phone recordings
      </Text>
      {!record && (
        <Text style={{ color: c.textSecondary }}>
          No saved phone recording yet. Start recording from Track; live GPS
          display alone does not save a track.
        </Text>
      )}
      {records.map((r) => (
        <Pressable
          key={r.session.id}
          accessibilityRole="button"
          onPress={() => setSelected(r.session.id)}
          style={{ padding: 12, backgroundColor: c.buttonBg, borderRadius: 8 }}
        >
          <Text style={{ color: c.text }}>
            {record?.session.id === r.session.id ? "● " : ""}
            {new Date(r.session.startedAt).toLocaleString()} · {r.points.length}{" "}
            fixes{r.session.phase === "recording" ? " · Recording" : ""}
          </Text>
        </Pressable>
      ))}
      {record && (
        <>
          <Text style={{ color: c.text }}>
            SOG over time (knots) · {speeds.length} speed samples
          </Text>
          {speeds.length > 0 ? (
            <>
              <Svg height={170} width="100%" viewBox="0 0 320 170">
                <Line x1="10" y1="150" x2="310" y2="150" stroke={c.textMuted} />
                <Path d={path} stroke="#008c80" strokeWidth="2" fill="none" />
              </Svg>
              <Text style={{ color: c.textSecondary }}>
                {new Date(start).toLocaleTimeString()} →{" "}
                {new Date(end).toLocaleTimeString()} · max{" "}
                {Math.max(
                  ...speeds.map((p) => p.sogMps! * KNOTS_PER_MPS),
                ).toFixed(1)}{" "}
                kn
              </Text>
            </>
          ) : (
            <Text style={{ color: c.textSecondary }}>
              No speed measurements saved in this recording.
            </Text>
          )}
          <Text style={{ color: c.textSecondary }}>
            Gaps in the chart mean no speed samples were saved. Wind
            measurements require a Veetr device.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void exportRecord()}
            style={{
              padding: 12,
              backgroundColor: c.buttonBg,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: c.text }}>Export this recording</Text>
          </Pressable>
          {record.archived && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert(
                  "Delete archived recording?",
                  "This permanently removes its saved GPS positions.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () =>
                        void trackingStore()
                          .then((s) => s.deleteArchivedLocal(record.session.id))
                          .then(() =>
                            setRecords((rows) =>
                              rows.filter(
                                (r) => r.session.id !== record.session.id,
                              ),
                            ),
                          )
                          .catch((e) => setError(String(e))),
                    },
                  ],
                )
              }
            >
              <Text style={{ color: c.text }}>Delete archived recording</Text>
            </Pressable>
          )}
        </>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: c.text }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
