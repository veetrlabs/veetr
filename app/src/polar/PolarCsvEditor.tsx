import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as Crypto from "expo-crypto";
import { importPolar } from "../../../packages/shared/src/polar/import";
import type { Polar } from "../../../packages/shared/src/polar/model";
import type { BoatPolars } from "../../../packages/shared/src/polar/repository";
import { polarRepository } from "./repository";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { t, translateMessage } from "../i18n";

export function polarCsv(polar?: Polar) {
  return polar
    ? [
        "TWS,TWA,speed",
        ...polar.points.map((p) => `${p.tws},${p.twa},${p.speed}`),
      ].join("\n")
    : "";
}

export default function PolarCsvEditor({
  boatId,
  reference,
  onPreview,
  onSaved,
}: {
  boatId: string;
  reference?: Polar;
  onPreview: (polar: Polar | undefined) => void;
  onSaved: (library: BoatPolars) => void;
}) {
  const c = themeColors[useTheme().theme];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => polarCsv(reference));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const baseline = useRef(polarCsv(reference));
  // Trip refreshes must not replace an in-progress reference edit.
  useEffect(() => {
    baseline.current = polarCsv(reference);
    setText(baseline.current);
    setError("");
    onPreview(undefined);
    return () => {
      generation.current += 1;
    };
  }, [boatId, reference?.id, reference?.version]);

  function parse(value: string) {
    return importPolar(value, {
      id: "preview",
      name: reference?.name || t("Custom polar"),
      source: "manual",
      version: "preview",
      createdAt: reference?.createdAt || new Date().toISOString(),
      speedBasis: reference?.speedBasis,
    });
  }
  function change(value: string) {
    setText(value);
    try {
      const next = parse(value);
      setError("");
      onPreview(next);
    } catch (e) {
      setError((e as Error).message);
      // Keep the last valid preview while a row is incomplete.
    }
  }
  async function save() {
    if (pending.current) return false;
    if (text === baseline.current) return true;
    let next: Polar;
    try {
      next = parse(text);
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
    if (polarCsv(next) === baseline.current) return true;
    const token = generation.current;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      // New IDs keep custom revisions independent of catalog and synced originals.
      const saved = await polarRepository.setPolar(boatId, {
        ...next,
        id: Crypto.randomUUID(),
        version: now,
        createdAt: now,
      });
      if (token !== generation.current) return false;
      baseline.current = polarCsv(next);
      onSaved(saved);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Edit polar data")}
        accessibilityState={{ expanded: open }}
        disabled={saving}
        onPress={() => {
          if (!open) setOpen(true);
          else
            void save().then((ok) => {
              if (ok) setOpen(false);
            });
        }}
        style={({ pressed }) => ({
          padding: 14,
          minHeight: 48,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 10,
          backgroundColor: c.buttonBg,
          opacity: saving ? 0.5 : pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ color: c.text }}>
          {t("Edit polar data")} {open ? "▴" : "▾"}
        </Text>
      </Pressable>
      {open && (
        <>
          <Text style={{ color: c.textMuted }}>
            {t(
              "Edit or paste CSV. Wind and boat speeds are in knots; wind angles are in degrees. Valid changes preview above and save when you leave the field.",
            )}
          </Text>
          <TextInput
            accessibilityLabel={t("Polar CSV")}
            multiline
            editable={!saving}
            autoCorrect={false}
            autoCapitalize="none"
            value={text}
            onChangeText={change}
            onBlur={() => void save()}
            placeholder={
              "TWS,TWA,speed\n6,45,4.2\n6,90,5.1\n8,45,4.8\n8,90,5.8"
            }
            placeholderTextColor={c.textMuted}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 8,
              color: c.text,
              minHeight: 180,
              maxHeight: 360,
              textAlignVertical: "top",
            }}
          />
          {saving && <Text style={{ color: c.textMuted }}>{t("Saving…")}</Text>}
          {!!error && (
            <Text accessibilityRole="alert" style={{ color: c.text }}>
              {translateMessage(error)}
            </Text>
          )}
        </>
      )}
    </View>
  );
}
