import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { locale, t, translateMessage, useLanguageRefresh } from "../i18n";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import {
  claimSeriesPhone,
  connectSeriesRace,
  type SeriesPhone,
} from "./seriesPhone";
import { readyForRace } from "./service";
import type { TrackingSession } from "./model";
import { invitationToken } from "./invitationLink";

export default function SeriesPhonePanel({
  phone,
  token,
  session,
}: {
  phone: SeriesPhone;
  token?: string;
  session: TrackingSession | null;
}) {
  useLanguageRefresh();
  const { theme } = useTheme(),
    c = themeColors[theme];
  const [busy, setBusy] = useState(false);
  const [another, setAnother] = useState(false);
  const [invitation, setInvitation] = useState("");
  const [paired, setPaired] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pair = async () => {
    const result = token ? await claimSeriesPhone(token) : phone;
    setPaired(true);
    return result;
  };
  const button = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={{
        padding: 18,
        borderRadius: 12,
        backgroundColor: c.buttonBg,
        opacity: busy ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          color: c.text,
          fontWeight: "600",
          fontSize: 18,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        {button(t("Back"), () =>
          router.canGoBack() ? router.back() : router.replace("/regattas"),
        )}
        <Text style={{ color: c.text, fontSize: 32, fontWeight: "700" }}>
          {phone.boatName}
        </Text>
        <Text style={{ color: c.text, fontSize: 22 }}>{phone.seriesName}</Text>
        <Text style={{ color: c.textSecondary }}>
          {t(
            "One invitation for this series. Your phone stays paired between races. Choose a race below when you are ready.",
          )}
        </Text>
        {!phone.valid ? (
          <Text style={{ color: c.text }}>
            {t(
              "This invitation has expired or been revoked. Ask the referee for a new link.",
            )}
          </Text>
        ) : (
          <>
            <Text style={{ color: c.textSecondary }}>
              {t(
                "Get ready now. GPS stays on while you wait, using battery. Your position becomes public on the live map and in replay only while the referee enables tracking for this race.",
              )}
            </Text>
            {token &&
              !paired &&
              button(
                t("Connect phone to series"),
                () =>
                  void run(async () => {
                    await pair();
                  }),
              )}
            {(paired || !token) && (
              <Text style={{ color: c.text }}>
                {t("Phone connected to this series")}
              </Text>
            )}
            {phone.races.length === 0 && (
              <Text style={{ color: c.text }}>
                {t(
                  "No upcoming published races for your boat yet. Your series invitation remains available.",
                )}
              </Text>
            )}
            {session &&
            !(session.mode === "local" && session.phase === "stopping") ? (
              <>
                <Text style={{ color: c.text }}>
                  {t(
                    "Finish the current recording or sharing session before getting ready for this race.",
                  )}
                </Text>
                {button(t("Manage existing live sharing"), () =>
                  router.push("/regatta-sharing"),
                )}
              </>
            ) : (
              phone.races.map((race) => (
                <Pressable
                  key={race.eventId}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("Ready to race")}: ${race.raceName}`}
                  disabled={busy}
                  accessibilityState={{ disabled: busy }}
                  style={{
                    padding: 18,
                    borderRadius: 12,
                    backgroundColor: c.buttonBg,
                  }}
                  onPress={() =>
                    Alert.alert(
                      t("Get ready to share your position?"),
                      t(
                        "This phone will track {{v0}}. Sharing starts automatically when the referee opens tracking and pauses when they close it. Your shared route is available in replay.",
                        { v0: phone.boatName },
                      ),
                      [
                        { text: t("Cancel"), style: "cancel" },
                        {
                          text: t("Ready to race"),
                          onPress: () =>
                            void run(async () => {
                              const connected = await pair();
                              await readyForRace(
                                await connectSeriesRace(
                                  connected,
                                  race.eventId,
                                ),
                              );
                              router.replace("/race-phone");
                            }),
                        },
                      ],
                    )
                  }
                >
                  <Text
                    style={{ color: c.text, fontSize: 20, fontWeight: "600" }}
                  >
                    {race.raceName}
                  </Text>
                  <Text style={{ color: c.textSecondary }}>
                    {new Date(race.scheduledStart).toLocaleString(locale())}
                  </Text>
                  <Text style={{ color: c.text }}>{t("Ready to race")}</Text>
                </Pressable>
              ))
            )}
          </>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: c.text }}>
            {translateMessage(error)}
          </Text>
        )}
        {button(t("Use another invitation"), () => setAnother(true))}
        {another && (
          <>
            <TextInput
              accessibilityLabel={t("Boat invitation link")}
              value={invitation}
              onChangeText={setInvitation}
              placeholder={t("Paste your Veetr invitation link")}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                padding: 16,
                color: c.text,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 12,
              }}
            />
            {button(t("Open invitation"), () => {
              const next = invitationToken(invitation);
              if (next) router.push(`/join/${next}` as Href);
              else
                setError(
                  "Paste the complete Veetr boat invitation link sent by your referee.",
                );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
