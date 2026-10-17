import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { t, formatNumber } from "../i18n";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  searchBoatModels,
  boatConfigurations,
  boatCatalogDetail,
  type CatalogModel,
  type CatalogConfiguration,
  type CatalogDetail,
} from "./catalog";
export default function BoatModelLookup({
  label,
  selectedId,
  selectedRevision,
  disabled,
  onSelect,
}: {
  label?: string;
  selectedId?: string;
  selectedRevision?: string;
  disabled?: boolean;
  onSelect: (entry: CatalogDetail | null) => Promise<void>;
}) {
  const c = themeColors[useTheme().theme],
    online = useOnlineStatus();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [model, setModel] = useState<CatalogModel | null>(null);
  const [models, setModels] = useState<CatalogModel[]>([]),
    [configs, setConfigs] = useState<CatalogConfiguration[]>([]);
  const [offset, setOffset] = useState(0),
    [loading, setLoading] = useState(false),
    [applying, setApplying] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setModels([]);
    setConfigs([]);
    setError("");
    setLoading(false);
    if (!open || !online || (!model && query.trim().length < 2)) return;
    setLoading(true);
    const timer = setTimeout(() => {
      const request = model
        ? boatConfigurations(model.model_key, offset)
        : searchBoatModels(query.trim());
      void request
        .then((rows) => {
          if (alive) {
            if (model) setConfigs(rows as CatalogConfiguration[]);
            else setModels(rows as CatalogModel[]);
          }
        })
        .catch(() => {
          if (alive)
            setError(
              t(
                "Boat search is unavailable. Check your connection and try again.",
              ),
            );
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, online, query, model, offset]);
  const choose = async (config: CatalogConfiguration | null) => {
    setApplying(true);
    setError("");
    try {
      await onSelect(config ? await boatCatalogDetail(config) : null);
      setOpen(false);
      setQuery("");
      setModel(null);
      setConfigs([]);
      setModels([]);
    } catch (e) {
      setError(t((e as Error).message));
    } finally {
      setApplying(false);
    }
  };
  const button = (text: string, action: () => void, inactive = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={inactive || applying}
      onPress={action}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 10,
        padding: 14,
        minHeight: 48,
        backgroundColor: c.buttonBg,
        opacity: inactive || applying ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: c.text }}>{text}</Text>
    </Pressable>
  );
  const offline = (
    <Text accessibilityRole="alert" style={{ color: c.textMuted }}>
      {t(
        "Boat search works only online. Your saved boat and polar remain available offline.",
      )}
    </Text>
  );
  const option = (
    key: string,
    title: string,
    subtitle: string,
    checked: boolean,
    action: () => void,
  ) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled: applying }}
      disabled={applying}
      onPress={action}
      style={({ pressed }) => ({
        padding: 14,
        minHeight: 48,
        borderBottomWidth: 1,
        borderColor: c.border,
        backgroundColor: pressed ? c.buttonBg : c.bg,
      })}
    >
      <Text style={{ color: c.text, fontWeight: "600" }}>
        {title}
        {checked ? " ✓" : ""}
      </Text>
      {!!subtitle && <Text style={{ color: c.textMuted }}>{subtitle}</Text>}
    </Pressable>
  );
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: c.text }}>{t("Boat model")}</Text>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={t("Boat model")}
        accessibilityValue={{ text: label || t("Custom boat") }}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          setOpen(true);
          setModel(null);
          setOffset(0);
        }}
        style={({ pressed }) => ({
          padding: 14,
          minHeight: 48,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 10,
          backgroundColor: c.inputBg,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ color: c.text }}>{label || t("Custom boat")} ▾</Text>
      </Pressable>
      {!online && offline}
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => {
          if (!applying) setOpen(false);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 12 }}
          >
            {button(t("Close"), () => setOpen(false))}
            <Text
              accessibilityRole="header"
              style={{ color: c.text, fontSize: 24, fontWeight: "700" }}
            >
              {model?.model || t("Boat model")}
            </Text>
            {!online && offline}
            {option(
              "custom",
              t("Custom boat"),
              t("Enter or adjust boat details manually."),
              !selectedId,
              () => void choose(null),
            )}
            {model ? (
              <>
                {button(t("Back to models"), () => {
                  setModel(null);
                  setOffset(0);
                })}
                <Text style={{ color: c.textMuted }}>
                  {t(
                    "Choose the configuration closest to your boat. You can adjust its details afterwards.",
                  )}
                </Text>
                {online &&
                  configs.map((row) =>
                    option(
                      row.id,
                      row.configuration,
                      [
                        row.year,
                        `${t("Draft")} ${formatNumber(row.draft_m, 2)} m`,
                        `${t("Main sail")} ${row.main_m2 ?? "—"} m²`,
                        `${t("Genoa")} ${row.genoa_m2 ?? "—"} m²`,
                        `${t("Spinnaker")} ${row.spinnaker_m2 ?? "—"} / ${row.asymmetric_m2 ?? "—"} m²`,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                      selectedId === row.id &&
                        selectedRevision === row.revision,
                      () => void choose(row),
                    ),
                  )}
                {online && (
                  <View style={{ gap: 8 }}>
                    {offset > 0 &&
                      button(
                        t("Previous"),
                        () => setOffset(Math.max(0, offset - 30)),
                        loading,
                      )}
                    {configs.length === 30 &&
                      button(t("Next"), () => setOffset(offset + 30), loading)}
                  </View>
                )}
              </>
            ) : (
              <>
                <TextInput
                  accessibilityLabel={t("Search manufacturer or model")}
                  placeholder={t("Search manufacturer or model")}
                  placeholderTextColor={c.textMuted}
                  value={query}
                  maxLength={100}
                  editable={online && !applying}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  style={{
                    padding: 14,
                    minHeight: 48,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 10,
                    color: c.text,
                  }}
                />
                {online && query.trim().length < 2 && (
                  <Text style={{ color: c.textMuted }}>
                    {t("Enter at least two characters.")}
                  </Text>
                )}
                {online &&
                  models.map((row) =>
                    option(
                      row.model_key,
                      row.model,
                      `${row.manufacturer} · ${row.configurations} ${t("configurations")}`,
                      false,
                      () => {
                        setModel(row);
                        setOffset(0);
                      },
                    ),
                  )}
              </>
            )}
            {(loading || applying) && (
              <Text style={{ color: c.textMuted }}>{t("Loading…")}</Text>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={{ color: c.text }}>
                {error}
              </Text>
            )}
            {online &&
              !loading &&
              !error &&
              (model
                ? configs.length === 0
                : query.trim().length >= 2 && models.length === 0) && (
                <Text style={{ color: c.textMuted }}>
                  {t(
                    "No matching boats. Try another name or choose Custom boat.",
                  )}
                </Text>
              )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
