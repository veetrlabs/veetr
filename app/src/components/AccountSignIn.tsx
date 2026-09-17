import { useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { trackingClient } from "../tracking/client";
import { resumeTracking } from "../tracking/service";
const site = (process.env.EXPO_PUBLIC_SITE_URL || "https://veetr.org").replace(/\/$/, "");
export default function AccountSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const { theme } = useTheme();
  const colors = themeColors[theme], text = { color: colors.text };
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const styles = { section: { gap: 12 }, heading: { fontSize: 20, fontWeight: "600" as const }, input: { borderWidth: 1, borderRadius: 8, padding: 12 } };
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed. Please try again."); }
    finally { setBusy(false); }
  }
  const button = (title: string, action: () => void, disabled = busy) => <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{ padding: 14, borderRadius: 8, backgroundColor: colors.buttonBg, opacity: disabled ? 0.5 : 1 }}><Text style={text}>{title}</Text></Pressable>;
  if (!trackingClient) return <Text style={text}>Account sign-in is unavailable in this build.</Text>;
  return <View>
          <View style={styles.section}>
            <Text style={[styles.heading, text]}>
              Sign in to your Veetr account
            </Text>
            <TextInput
              accessibilityLabel="Email"
              placeholder="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                text,
                { borderColor: colors.border, backgroundColor: colors.inputBg },
              ]}
            />
            <TextInput
              accessibilityLabel="Password"
              placeholder="Password"
              secureTextEntry
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                text,
                { borderColor: colors.border, backgroundColor: colors.inputBg },
              ]}
            />
            {button(
              "Sign in",
              () =>
                void run(async () => {
                  const { error } =
                    await trackingClient!.auth.signInWithPassword({
                      email: email.trim(),
                      password,
                    });
                  if (error) throw error;
                  setPassword("");
                  await resumeTracking();
                  onSignedIn?.();
                }),
              busy || !email.trim() || !password,
            )}
            {button(
              "Create an account or reset password",
              () => void Linking.openURL(`${site}/account/`),
            )}
          </View>
    {!!error && <Text accessibilityRole="alert" style={text}>{error}</Text>}
    {busy && <Text accessibilityLiveRegion="polite" style={text}>Signing in…</Text>}
  </View>;
}
