import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { trackingClient } from "./client";
import type { TripVisibility } from "./tripSharing";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
export function TripOptions({
  title,
  onTitle,
  visibility,
  onVisibility,
  disabled = false,
}: {
  title: string;
  onTitle: (value: string) => void;
  visibility: TripVisibility;
  onVisibility: (value: TripVisibility) => void;
  disabled?: boolean;
}) {
  const c = themeColors[useTheme().theme];
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: c.text, fontWeight: "600" }}>Trip title</Text>
      <TextInput
        accessibilityLabel="Trip title"
        value={title}
        onChangeText={onTitle}
        editable={!disabled}
        maxLength={120}
        style={{
          minHeight: 48,
          padding: 14,
          borderRadius: 12,
          backgroundColor: c.buttonBg,
          color: c.text,
          borderWidth: 1,
          borderColor: c.border,
        }}
      />
      <Text style={{ color: c.text, fontWeight: "600" }}>Who can watch?</Text>
      {(
        [
          ["private", "Private", "Only on this device. You can share later."],
          [
            "unlisted",
            "Anyone with the link",
            "Send the link to family and friends.",
          ],
          ["public", "Public", "Listed on Veetr for anyone to discover."],
        ] as const
      ).map(([value, label, description]) => (
        <Pressable
          key={value}
          accessibilityRole="radio"
          accessibilityLabel={label}
          accessibilityState={{ checked: visibility === value, disabled }}
          disabled={disabled}
          onPress={() => onVisibility(value)}
          style={{
            padding: 14,
            minHeight: 48,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: visibility === value ? "#008c80" : "transparent",
            backgroundColor: c.buttonBg,
            gap: 4,
          }}
        >
          <Text style={{ color: c.text, fontWeight: "600" }}>
            {visibility === value ? "✓ " : ""}
            {label}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 13 }}>
            {description}
          </Text>
        </Pressable>
      ))}
      {visibility !== "private" && (
        <Text style={{ color: c.textMuted, fontSize: 13 }}>
          Shares your route and recorded instruments. Live sharing starts after
          the first GPS position. When you end the trip, the same link shows the finished route.
        </Text>
      )}
    </View>
  );
}
export function TripAccountLink() {
  const c = themeColors[useTheme().theme];
  const [signedIn, setSignedIn] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void trackingClient?.auth
        .getSession()
        .then(({ data }) => {
          if (alive) setSignedIn(!!data.session);
        })
        .catch(() => {});
      const subscription = trackingClient?.auth.onAuthStateChange(
        (_event, session) => {
          if (alive) setSignedIn(!!session);
        },
      );
      return () => {
        alive = false;
        subscription?.data.subscription.unsubscribe();
      };
    }, []),
  );
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/settings")}
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Text style={{ color: c.text }}>
        {signedIn ? "Account settings" : "Sign in to share trips"} ›
      </Text>
    </Pressable>
  );
}
