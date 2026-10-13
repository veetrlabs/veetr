import { useCallback, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import AccountSignIn from "../components/AccountSignIn";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { t, translateMessage } from "../i18n";
import {
  boatAccount,
  ownedBoats,
  publishBoat,
  type OwnedBoat,
} from "./cloudBoats";
import { privateFleet, raceBoatIdForLocal } from "./privateBoats";

export default function BoatPublishing({
  boatId,
  disabled,
  onRefresh,
}: {
  boatId: string;
  disabled?: boolean;
  onRefresh: () => void;
}) {
  const colors = themeColors[useTheme().theme];
  const [account, setAccount] = useState<string>();
  const [published, setPublished] = useState<OwnedBoat>();
  const [linked, setLinked] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setReady(false);
    setError("");
    const user = await boatAccount();
    setAccount(user?.id);
    const id = raceBoatIdForLocal(await privateFleet(), boatId);
    setLinked(Boolean(id));
    setPublished(
      user ? (await ownedBoats()).find((b) => b.id === id) : undefined,
    );
    setReady(true);
  }, [boatId]);
  useFocusEffect(
    useCallback(() => {
      void load().catch((e) => setError(e.message));
    }, [load]),
  );
  const action = (label: string, run: () => void) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={run}
      style={({ pressed }) => ({
        backgroundColor: colors.buttonBg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        padding: 14,
        opacity: busy || disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: colors.text }}>{t(label)}</Text>
    </Pressable>
  );
  return (
    <View
      style={{
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "600" }}>
        {t("Public boat profile")}
      </Text>
      <Text style={{ color: colors.textMuted }}>
        {t(
          "Publishing shares your boat details and reference polar publicly. Private trips and measured sailing data are not uploaded. Later edits stay on this device until you publish updates.",
        )}
      </Text>
      {!ready ? (
        action("Refresh boats", () => {
          void load().catch((e) => setError(e.message));
        })
      ) : !account ? (
        <AccountSignIn
          onSignedIn={() => {
            void load().catch((e) => setError(e.message));
            onRefresh();
          }}
        />
      ) : (
        <>
          {linked && !published && (
            <Text style={{ color: colors.textMuted }}>
              {t(
                "If this is a race boat, accept its ownership invitation with this account before publishing. Tracking access alone cannot change its public profile.",
              )}
            </Text>
          )}
          {action(published ? "Publish updates" : "Publish boat", () => {
            setBusy(true);
            setError("");
            setMessage("");
            void publishBoat(boatId, published)
              .then((result) => {
                setPublished(result);
                setLinked(true);
                setMessage("Boat published.");
                onRefresh();
              })
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          })}
          {published &&
            action("View public boat", () => {
              void Linking.openURL(
                `${(process.env.EXPO_PUBLIC_SITE_URL || "https://veetr.org").replace(/\/$/, "")}/boats/${published.id}/`,
              );
            })}
          {action("Refresh boats", () => {
            void load()
              .then(onRefresh)
              .catch((e) => setError(e.message));
          })}
        </>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
          {t(message)}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {translateMessage(error)}
        </Text>
      )}
    </View>
  );
}
