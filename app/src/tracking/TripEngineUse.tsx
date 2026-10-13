import { useState } from "react";
import { Text, View } from "react-native";
import { PolarSelect as Picker } from "../polar/PolarSelect";
import { trackingStore } from "./database";
import type { TrackingSession } from "./model";
import { t, translateMessage } from "../i18n";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export default function TripEngineUse({
  session,
  onSaved,
}: {
  session: TrackingSession;
  onSaved: (session: TrackingSession) => void;
}) {
  const c = themeColors[useTheme().theme],
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: c.text, fontWeight: "600" }}>
        {t("Engine use")}
      </Text>
      <Picker
        accessibilityLabel={t("Engine use")}
        selectedValue={session.engineUse ?? "unknown"}
        enabled={!busy}
        onValueChange={(value) => {
          const engineUse = value as TrackingSession["engineUse"];
          setBusy(true);
          setError("");
          void trackingStore()
            .then(async (store) => {
              await store.updateTrip(session.id, { engineUse });
              onSaved({ ...session, engineUse });
            })
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <Picker.Item value="unknown" label={t("Unknown")} />
        <Picker.Item value="sailing-only" label={t("Sailing only")} />
        <Picker.Item value="engine-used" label={t("Engine used")} />
      </Picker>
      <Text style={{ color: c.textMuted }}>
        {t(
          "Saved with this trip. Trips using the engine are excluded from sailing comparisons.",
        )}
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: c.text }}>
          {translateMessage(error)}
        </Text>
      )}
    </View>
  );
}
