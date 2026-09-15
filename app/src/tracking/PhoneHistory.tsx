import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Svg, { Path, Line } from "react-native-svg";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { dataStorage } from "../utils/dataStorage";
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
export default function RecordingHistory({
  rangeMinutes = 10,
}: {
  rangeMinutes?: number;
}) {
  const [timeline, setTimeline] = useState<TrackingPoint[]>([]);
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
        .then(async (rows) => {
          if (alive) setRecords(rows);
          const selectedRecord = rows.find((r) => r.session.id === selected);
          const end =
            selectedRecord?.session.phase === "stopping"
              ? Date.parse(
                  selectedRecord.session.stoppedAt ||
                    selectedRecord.session.lastRecordedAt ||
                    selectedRecord.session.startedAt,
                )
              : Date.now();
          const start = end - rangeMinutes * 60000;
          const store = await trackingStore();
          const [saved, legacy] = await Promise.all([
            store.historyPoints(
              new Date(start).toISOString(),
              new Date(end).toISOString(),
            ),
            dataStorage.getReadings(start, end),
          ]);
          const old = rows
            .flatMap((r) => r.points)
            .filter(
              (p) =>
                Date.parse(p.recordedAt) >= start &&
                Date.parse(p.recordedAt) <= end,
            );
          const merged = new Map<string, TrackingPoint>();
          for (const p of [...old, ...saved]) merged.set(p.recordedAt, p);
          const points = [...merged.values()];
          // Retain earlier device history without presenting a separate recording system.
          for (const r of legacy)
            if (
              !points.some(
                (p) => Math.abs(Date.parse(p.recordedAt) - r.timestamp) < 5000,
              )
            )
              points.push({
                recordedAt: new Date(r.timestamp).toISOString(),
                latitude: r.lat ?? 0,
                longitude: r.lon ?? 0,
                accuracyM: null,
                sogMps: r.SOG / KNOTS_PER_MPS,
                cogDeg: null,
                source: "veetr",
                instruments: {
                  aws: r.AWS,
                  tws: Math.hypot(
                    r.AWS * Math.cos((r.AWA * Math.PI) / 180) - r.SOG,
                    r.AWS * Math.sin((r.AWA * Math.PI) / 180),
                  ),
                },
              });
          if (alive) {
            setTimeline(
              points.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
            );
            setError("");
          }
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
  }, [rangeMinutes, selected]);
  const record = records.find((r) => r.session.id === selected);
  const speeds = timeline.filter((p) => p.sogMps !== null);
  const max = Math.max(
    1,
    ...timeline.flatMap((p) => [
      p.sogMps === null ? 0 : p.sogMps * KNOTS_PER_MPS,
      p.instruments?.aws ?? 0,
      p.instruments?.tws ?? 0,
    ]),
  );
  const start = timeline[0] ? Date.parse(timeline[0].recordedAt) : 0;
  const end = timeline.at(-1) ? Date.parse(timeline.at(-1)!.recordedAt) : start;
  let path = "",
    previous = 0;
  // Time is the x-axis. Break the line at missing speed or gaps longer than 30 seconds.
  timeline.forEach((p) => {
    const time = Date.parse(p.recordedAt);
    if (p.sogMps === null) {
      previous = 0;
      return;
    }
    path += `${!previous || time - previous > 30000 ? "M" : "L"}${10 + (300 * (time - start)) / Math.max(1, end - start)},${150 - (130 * p.sogMps * KNOTS_PER_MPS) / max} `;
    previous = time;
  });
  const windPath = (key: "aws" | "tws") => {
    let result = "",
      previous = 0;
    timeline.forEach((p) => {
      const value = p.instruments?.[key],
        time = Date.parse(p.recordedAt);
      if (value == null) {
        previous = 0;
        return;
      }
      result += `${!previous || time - previous > 30000 ? "M" : "L"}${10 + (300 * (time - start)) / Math.max(1, end - start)},${150 - (130 * value) / max} `;
      previous = time;
    });
    return result;
  };
  const aws = windPath("aws"),
    tws = windPath("tws");
  async function exportRecord() {
    if (!record && !timeline.length) return;
    const file = new File(Paths.cache, `veetr-recording-${record?.session.id ?? Date.now()}.json`);
    try {
      file.write(JSON.stringify(record ?? {points: timeline}, null, 2));
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
      {selected && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelected("")}
          style={{ padding: 12 }}
        >
          <Text style={{ color: c.text }}>Latest</Text>
        </Pressable>
      )}
      {records.map((r) => (
        <Pressable
          key={r.session.id}
          accessibilityRole="button"
          onPress={() => setSelected(r.session.id)}
          style={{ padding: 12, backgroundColor: c.buttonBg, borderRadius: 8 }}
        >
          <Text style={{ color: c.text }}>
            {selected === r.session.id ? "● " : ""}
            {new Date(r.session.startedAt).toLocaleString()} · {r.points.length}{" "}
            fixes{r.session.phase === "recording" ? " · Recording" : ""}
          </Text>
        </Pressable>
      ))}
      {timeline.length > 0 ? (
        <>
          <Text style={{ color: c.text }}>
            SOG{aws ? " · AWS" : ""}
            {tws ? " · TWS" : ""} · kn
          </Text>
          {speeds.length > 0 ? (
            <>
              <Svg height={170} width="100%" viewBox="0 0 320 170">
                <Line x1="10" y1="150" x2="310" y2="150" stroke={c.textMuted} />
                {aws && (
                  <Path d={aws} stroke="#2196F3" strokeWidth="2" fill="none" />
                )}
                {tws && (
                  <Path d={tws} stroke="#FF9800" strokeWidth="2" fill="none" />
                )}
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
          <Pressable
            accessibilityRole="button"
            onPress={() => void exportRecord()}
            style={{
              padding: 12,
              backgroundColor: c.buttonBg,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: c.text }}>{record ? "Export recording" : "Export range"}</Text>
          </Pressable>
          {record?.archived && (
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
      ) : (
        <Text style={{ color: c.textMuted, padding: 24, textAlign: "center" }}>
          No recorded data in this range
        </Text>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: c.text }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
