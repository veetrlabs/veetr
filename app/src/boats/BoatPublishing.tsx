import { useCallback, useState } from "react";
import { Linking, Pressable, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import AccountSignIn from "../components/AccountSignIn";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { t, translateMessage } from "../i18n";
import {
  boatAccount,
  ownedBoats,
  uploadBoat,
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
  const [uploadPublic, setUploadPublic] = useState(false);
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
    const saved = user
      ? (await ownedBoats()).find((b) => b.id === id)
      : undefined;
    setPublished(saved);
    setUploadPublic(Boolean(saved?.uploadPublic));
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
      accessibilityLabel={t(label)}
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
        {t("Upload boat")}
      </Text>
      <Text style={{ color: colors.textMuted }}>
        {t(
          "Upload boat details and the reference polar. Trips and measured sailing data stay on this device.",
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={{ color: colors.text, flex: 1 }}>
              {t("Upload publicly")}
            </Text>
            <Switch
              accessibilityLabel={t("Upload publicly")}
              value={uploadPublic}
              disabled={busy || disabled}
              onValueChange={setUploadPublic}
            />
          </View>
          <Text style={{ color: colors.textMuted }}>
            {t(
              uploadPublic
                ? "Anyone can view the uploaded boat details and polar."
                : "Only your account can access this upload. Sign in on your other device to download it.",
            )}
          </Text>
          {!uploadPublic && published?.publiclyVisible && (
            <Text style={{ color: colors.textMuted }}>
              {t(
                "This boat already has a public profile. A private upload does not remove its previously published details.",
              )}
            </Text>
          )}
          {action("Upload boat", () => {
            setBusy(true);
            setError("");
            setMessage("");
            void uploadBoat(boatId, uploadPublic, published)
              .then((result) => {
                setPublished(result);
                setMessage(
                  uploadPublic
                    ? "Boat uploaded publicly."
                    : "Boat uploaded to your account.",
                );
                onRefresh();
              })
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          })}
          {published?.publiclyVisible &&
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
