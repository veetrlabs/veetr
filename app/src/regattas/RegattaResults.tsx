import { retryRegattaRead } from "./read";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { trackingRpc } from "../tracking/client";
import { eventStandings, eventsFor, type Series } from "../../../veetr.org/src/features/racing/domain";

export default function RegattaResults({ seriesId, eventId, onSeries }: { seriesId: string; eventId: string; onSeries?: (series: Series) => void }) {
  const { theme } = useTheme(), c = themeColors[theme];
  const [series, setSeries] = useState<Series | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [category, setCategory] = useState("");
  const [heatId, setHeatId] = useState("");
  useEffect(() => setHeatId(""), [eventId]);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(""); setSeries(null);
    void retryRegattaRead(() => trackingRpc<Series | null>("public_standings", { series_id: seriesId }), () => alive).then(data => {
      if (!alive) return;
      if (data && Array.isArray(data.boats) && Array.isArray(data.races)) {
        setSeries(data); setCategory(data.categories[0]?.id ?? "");
      }
    }).catch(() => { if (alive) setError("Results couldn’t be loaded."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [seriesId, retry]);
  const chip = (id: string, name: string, selected: boolean, onPress: () => void) => (
    <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
      style={{ paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, borderRadius: 12, backgroundColor: selected ? "#006b62" : c.buttonBg }}>
      <Text style={{ color: selected ? "white" : c.text }}>{name}</Text>
    </Pressable>
  );
  if (loading) return <View style={{ flex: 1, padding: 20 }}><Text style={{ color: c.textMuted }}>Loading results…</Text></View>;
  if (error) return <View style={{ flex: 1, padding: 20, gap: 12 }}><Text accessibilityRole="alert" style={{ color: c.text }}>{error}</Text>{chip("retry", "Retry results", false, () => setRetry(v => v + 1))}</View>;
  if (!series || !eventsFor(series).some(e => e.id === eventId)) return <View style={{ flex: 1, padding: 20 }}><Text style={{ color: c.textMuted }}>No published results yet.</Text></View>;
  const events = eventsFor(series).sort((a, b) => a.order - b.order), event = events.find(e => e.id === eventId);
  const heats = series.races.filter(r => r.eventId === eventId && r.status === "published" && r.kind !== "aggregate").sort((a, b) => a.order - b.order);
  const selectedHeat = heats.find(r => r.id === heatId);
  const resultSeries = selectedHeat ? { ...series, races: [selectedHeat] } : series;
  const rows = event ? eventStandings(resultSeries, selectedHeat ? { ...event, discards: [] } : event, category).filter(row => row.scores.length) : [];
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 16 }}>
    {onSeries && <Pressable accessibilityRole="link" accessibilityLabel={`View series ${series.name}`} onPress={() => onSeries(series)} style={{minHeight:44,justifyContent:"center"}}><Text style={{color:c.text,textDecorationLine:"underline"}}>{series.name} · Series standings ›</Text></Pressable>}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {series.categories.map(cat => chip(cat.id, cat.name, category === cat.id, () => setCategory(cat.id)))}
    </View>
    {heats.length > 1 && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {chip("combined", "Combined", !selectedHeat, () => setHeatId(""))}
      {heats.map((heat, i) => chip(heat.id, `Heat ${i + 1}`, selectedHeat?.id === heat.id, () => setHeatId(heat.id)))}
    </View>}
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: "700", flex: 1 }}>Results</Text>
      <Text style={{ color: c.textMuted, alignSelf: "center" }}>Points</Text>
    </View>
    {!rows.length && <Text style={{ color: c.textMuted }}>No results in this category yet.</Text>}
    {rows.map(row => {
      const boat = series.boats.find(b => b.id === row.id)!;
      const result = selectedHeat?.results.find(r => r.boatId === row.id);
      return <View key={row.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ color: c.textMuted, width: 28, fontSize: 18 }}>{row.rank || "—"}</Text>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: c.text, fontWeight: "600", fontSize: 17 }}>{boat.name}</Text>
          {boat.sailNumber ? <Text style={{ color: c.textMuted }}>{boat.sailNumber}</Text> : null}
          {result && result.status !== "FINISHED" && result.status !== "SCORED" && <Text style={{ color: c.textMuted }}>{result.status}</Text>}
          {!selectedHeat && heats.length > 1 && <Text style={{ color: c.textMuted, fontSize: 12 }}>{heats.map((heat, i) => {
            const score = row.scores.find(s => s.raceId === heat.id);
            const finish = heat.results.find(r => r.boatId === row.id);
            return `H${i + 1}: ${score?.points ?? "—"}${finish && finish.status !== "FINISHED" && finish.status !== "SCORED" ? ` (${finish.status})` : ""}`;
          }).join(" · ")}</Text>}
          {!!row.discardedRaceIds.length && <Text style={{ color: c.textMuted, fontSize: 12 }}>{row.discardedRaceIds.length} discarded · {row.rawTotal} total</Text>}
        </View>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>{row.scores.length ? row.countedTotal : "—"}</Text>
      </View>;
    })}
    <Text style={{ color: c.textMuted, fontSize: 12 }}>Published results · Points after discards</Text>
  </ScrollView>;
}
