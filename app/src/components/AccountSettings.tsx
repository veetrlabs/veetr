import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import AccountSignIn from "./AccountSignIn";
import { trackingClient } from "../tracking/client";
import { trackingStore } from "../tracking/database";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";

export default function AccountSettings({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme(), colors = themeColors[theme];
  const insets = useSafeAreaInsets();
  const [auth, setAuth] = useState<Session | null>(null);
  const [ready, setReady] = useState(!trackingClient), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (!trackingClient) return;
    let live = true;
    void trackingClient.auth.getSession().then(({ data, error }) => {
      if (live) { setAuth(data.session); setReady(true); if (error) setError(error.message); }
    }).catch(e => { if (live) { setError(e.message); setReady(true); } });
    const { data: { subscription } } = trackingClient.auth.onAuthStateChange((_event, session) => {
      if (live) { setAuth(session); setReady(true); }
    });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);
  const text = { color: colors.text };
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 8, gap: 20 }} keyboardShouldPersistTaps="handled">
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={text}>‹ Settings</Text></Pressable>
    <Text accessibilityRole="header" style={[text, { fontSize: 24, fontWeight: "700" }]}>Account</Text>
    {!ready ? <Text style={text}>Restoring account…</Text> : !auth ? <AccountSignIn /> : <>
      <Text style={text}>Signed in as {auth.user.email}</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={async () => {
        setBusy(true); setError("");
        try {
          const session = await (await trackingStore()).get();
          if (session && session.mode !== "local" && session.userId === auth.user.id) throw new Error("Finish live sharing in Races before signing out.");
          const { error } = await trackingClient!.auth.signOut({ scope: "local" });
          if (error) throw error;
        } catch (e) { setError(e instanceof Error ? e.message : "Sign-out failed."); }
        finally { setBusy(false); }
      }}><Text style={text}>{busy ? "Signing out…" : "Sign out"}</Text></Pressable>
    </>}
    {!!error && <Text accessibilityRole="alert" style={text}>{error}</Text>}
  </ScrollView>;
}
