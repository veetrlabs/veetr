import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { createTripBoat, tripBoats, type TripBoat } from "./tripSharing";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function TripBoatPicker({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (boat: TripBoat) => void;
}) {
  const c = themeColors[useTheme().theme];
  const [boats, setBoats] = useState<TripBoat[]>([]),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    tripBoats()
      .then((b) => {
        if (alive) setBoats(b);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
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
          Create a boat
        </Text>
        <Text style={{ color: c.textMuted }}>
          You’ll manage its profile and crew. You can add the other boat details
          later.
        </Text>
        <Text style={{ color: c.text }}>Boat name</Text>
        <TextInput
          accessibilityLabel="Boat name"
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
          <Text style={{ color: c.text }}>Create and select boat</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => setCreating(false)}
          style={button}
        >
          <Text style={{ color: c.text }}>Cancel</Text>
        </Pressable>
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: c.text }}>
            {error}
          </Text>
        )}
      </View>
    );
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: c.text, fontWeight: "600" }}>
        Boat for this trip
      </Text>
      {boats.map((b) => (
        <Pressable
          key={b.id}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === b.id }}
          onPress={() => onSelect(b)}
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
      {!!error ? (
        <Text accessibilityRole="alert" style={{ color: c.text }}>
          {error}
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setCreating(true)}
          style={button}
        >
          <Text style={{ color: c.text }}>＋ Create a boat</Text>
        </Pressable>
      )}
    </View>
  );
}
