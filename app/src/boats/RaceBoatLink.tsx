import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { t, translateMessage } from "../i18n";
import { PolarSelect } from "../polar/PolarSelect";
import {
  privateFleet,
  linkedRaceBoat,
  linkRaceBoat,
  type Fleet,
} from "./privateBoats";

export default function RaceBoatLink({
  boatId,
  boatName,
  onChange,
}: {
  boatId: string;
  boatName: string;
  onChange?: (fleet: Fleet) => void;
}) {
  const c = themeColors[useTheme().theme];
  const [fleet, setFleet] = useState<Fleet>({ boats: [] });
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoaded(false);
      void privateFleet()
        .then((value) => {
          if (alive) {
            setFleet(value);
            setLoaded(true);
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
      return () => {
        alive = false;
      };
    }, [boatId]),
  );
  const linked = linkedRaceBoat(fleet, boatId);
  async function change(id: string | null | undefined) {
    setBusy(true);
    setError("");
    try {
      const next = await linkRaceBoat({ boatId, boatName }, id);
      setFleet(next);
      onChange?.(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const button = (label: string, action: () => void) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || !loaded}
      accessibilityState={{ disabled: busy || !loaded }}
      onPress={action}
      style={({ pressed }) => ({
        padding: 14,
        minHeight: 48,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.buttonBg,
        opacity: busy || !loaded ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: c.text }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: c.text, fontWeight: "600" }}>
        {t("Boat on this device")}
      </Text>
      <Text style={{ color: c.textMuted }}>
        {t(
          "Link to a boat already in My boats, or add it. Linking stays on this device: no boat details, polars or private trips are uploaded, and it does not grant boat management access.",
        )}
      </Text>
      {!!fleet.boats.length && (
        <PolarSelect
          accessibilityLabel={t("Boat on this device")}
          selectedValue={linked?.id ?? ""}
          enabled={loaded && !busy}
          onValueChange={(id) => void change(id || undefined)}
        >
          <PolarSelect.Item value="" label={t("Not linked")} />
          {fleet.boats.map((boat) => (
            <PolarSelect.Item key={boat.id} value={boat.id} label={boat.name} />
          ))}
        </PolarSelect>
      )}
      {linked
        ? button(t("Boat details"), () =>
            router.push({
              pathname: "/my-boats",
              params: { boatId: linked.id },
            }),
          )
        : button(t("Add to My boats"), () => void change(null))}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: c.text }}>
          {translateMessage(error)}
        </Text>
      )}
    </View>
  );
}
