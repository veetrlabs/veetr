import { translateMessage, t, useLanguageRefresh } from '../i18n';
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { createTripBoat, tripBoats, type TripBoat } from "./tripSharing";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { recentTripBoats, orderTripBoats } from "./recentTripBoats";
export default function TripBoatPicker({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (boat: TripBoat) => void;
}) {
  useLanguageRefresh();
  const c = themeColors[useTheme().theme];
  const [boats, setBoats] = useState<TripBoat[]>([]),
    [expanded, setExpanded] = useState(false),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    Promise.all([tripBoats(), recentTripBoats().catch(() => [])])
      .then(([b, recent]) => {
        if (alive) setBoats(orderTripBoats(b, recent));
      })
      .catch((e) => {
        if (alive) setError(e.message);
      }).finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
    };
  }, []);
  const button = {
    minHeight: 48,
    padding: 14,
    borderRadius: 12,
    backgroundColor: c.buttonBg,
  };
  if (creating)
    return (
      <View style={{ gap: 12 }}>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: "600" }}>
          {t("Create a boat")}</Text>
        <Text style={{ color: c.textMuted }}>
          {t("You’ll manage its profile and crew. You can add the other boat details later.")}</Text>
        <Text style={{ color: c.text }}>{t("Boat name")}</Text>
        <TextInput
          accessibilityLabel={t("Boat name")}
          maxLength={120}
          value={name}
          onChangeText={setName}
          style={{
            ...button,
            color: c.text,
            borderWidth: 1,
            borderColor: c.border,
          }}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy || !name.trim()}
          style={button}
          onPress={() => {
            setBusy(true);
            setError("");
            void createTripBoat(name)
              .then((b) => {
                setBoats((old) => [...old, b]);
                onSelect(b);
                setCreating(false);
              })
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          <Text style={{ color: c.text }}>{t("Create and select boat")}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => setCreating(false)}
          style={button}
        >
          <Text style={{ color: c.text }}>{t("Cancel")}</Text>
        </Pressable>
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: c.text }}>
            {translateMessage(error)}
          </Text>
        )}
      </View>
    );
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: c.text, fontWeight: "600" }}>
        {t("Boat for this trip")}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Boat for this trip")}
        accessibilityState={{ expanded, disabled: loading }} disabled={loading}
        onPress={() => { setExpanded(!expanded); setQuery(""); }}
        style={{ ...button, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.text, flex: 1 }}>{boats.find(b => b.id === selected)?.name ?? t(loading ? "Loading boats…" : "Choose a boat")}</Text>
        <Text style={{ color: c.text }} accessibilityElementsHidden>{expanded ? '▴' : '▾'}</Text>
      </Pressable>
      {expanded && <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 6, gap: 6 }}>
        <TextInput accessibilityLabel={t("Search boats")} placeholder={t("Search boats")}
          placeholderTextColor={c.textMuted} value={query} onChangeText={setQuery}
          style={{ ...button, color: c.text }} />
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 240 }}>
      {boats.filter(b => b.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map((b) => (
        <Pressable
          key={b.id}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === b.id }}
          onPress={() => { onSelect(b); setExpanded(false); setQuery(""); }}
          style={{
            ...button,
            borderWidth: 2,
            borderColor: selected === b.id ? "#008c80" : "transparent",
          }}
        >
          <Text style={{ color: c.text }}>
            {selected === b.id ? "✓ " : ""}
            {b.name}
          </Text>
        </Pressable>
      ))}
      {!boats.some(b => b.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && <Text style={{ padding: 14, color: c.textMuted }}>{t("No boats found")}</Text>}
        </ScrollView>
      </View>}
      {!!error ? (
        <Text accessibilityRole="alert" style={{ color: c.text }}>
          {translateMessage(error)}
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setCreating(true)}
          style={button}
        >
          <Text style={{ color: c.text }}>{t("＋ Create a boat")}</Text>
        </Pressable>
      )}
    </View>
  );
}
