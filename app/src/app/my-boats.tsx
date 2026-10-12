import BackButton from '../components/BackButton';
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { t, translateMessage, useLanguageRefresh } from "../i18n";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { privateFleet, savePrivateBoat, selectPrivateBoat, deletePrivateBoat, type PrivateBoat } from "../boats/privateBoats";
import { savedSeriesPhone, seriesPhoneStatus, type SeriesPhone } from "../tracking/seriesPhone";

export default function MyBoats() {
  useLanguageRefresh();
  const c = themeColors[useTheme().theme];
  const [fleet, setFleet] = useState<Awaited<ReturnType<typeof privateFleet>>>({ boats: [] });
  const [invited, setInvited] = useState<SeriesPhone | null>(null);
  const [edit, setEdit] = useState<PrivateBoat>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => {
    let alive = true;
    void privateFleet().then(value => { if (alive) setFleet(value); }).catch(e => { if (alive) setError(e.message); });
    void (async () => {
      const saved = await savedSeriesPhone();
      if (alive) setInvited(saved);
      if (saved) {
        const fresh = await seriesPhoneStatus(saved.linkId);
        if (alive) setInvited(fresh);
      }
    })().catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []));
  const style = { padding: 16, borderRadius: 12, backgroundColor: c.buttonBg, minHeight: 48 };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={style}><Text style={{ color: c.text }}>{label}</Text></Pressable>;
  const persist = async (boat: PrivateBoat) => {
    setBusy(true); setError("");
    try {
      const next = await savePrivateBoat(boat);
      setFleet(next);
      if (!boat.id) setEdit(undefined);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const useBoat = async (id: string) => {
    setBusy(true); setError("");
    try { setFleet(await selectPrivateBoat(id)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const confirmDelete = (boat: PrivateBoat) => Alert.alert(
    t("Delete boat"), t("Delete {{v0}} from this device? Recorded trips will be kept.", { v0: boat.name }),
    [{ text: t("Cancel"), style: "cancel" }, { text: t("Delete boat"), style: "destructive", onPress: async () => {
      setBusy(true); setError("");
      try { setFleet(await deletePrivateBoat(boat.id)); setEdit(undefined); }
      catch (e) { setError((e as Error).message); }
      finally { setBusy(false); }
    } }],
  );
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
    <BackButton onPress={() => edit ? setEdit(undefined) : router.back()} />
    <Text accessibilityRole="header" style={{ color: c.text, fontSize: 28, fontWeight: "700" }}>{edit ? t("Boat details") : t("My boats")}</Text>
    {edit ? <>
      <Text style={{ color: c.textMuted }}>{t("Private · saved only on this device. Nothing is published.")}</Text>
      {(["name", "className", "sailNumber", "manufacturer", "model", "variant"] as const).map((field, i) => <View key={field} style={{ gap: 6 }}>
        <Text style={{ color: c.text }}>{t(["Boat name", "Boat class", "Sail number", "Manufacturer", "Model", "Variant / year"][i])}</Text>
        <TextInput accessibilityLabel={t(["Boat name", "Boat class", "Sail number", "Manufacturer", "Model", "Variant / year"][i])} value={edit[field]} maxLength={120}
          onChangeText={value => setEdit({ ...edit, [field]: value })}
          onBlur={() => { if (edit.id) void persist(edit); }}
          style={{ ...style, color: c.text, borderColor: c.border, borderWidth: 1 }} />
      </View>)}
      <Text style={{ color: c.text }}>{t('Length (m)')}</Text>
      <TextInput accessibilityLabel={t('Length (m)')} keyboardType="decimal-pad" defaultValue={edit.lengthM?.toString() ?? ''} onEndEditing={event => {
        const value = event.nativeEvent.text.trim().replace(',', '.');
        const lengthM = value ? Number(value) : undefined;
        if (lengthM !== undefined && (!Number.isFinite(lengthM) || lengthM <= 0 || lengthM > 200)) { setError('Enter a valid boat length.'); return; }
        const next = {...edit, lengthM}; setEdit(next); if (edit.id) void persist(next);
      }} style={{ ...style, color: c.text }} />
      {!edit.id && button(t("Create private boat"), () => void persist(edit))}
      {!!edit.id && <>
        {fleet.activeId === edit.id
          ? <Text style={{ color: c.textMuted }}>{t("Active for private trips")}</Text>
          : button(t("Use for private trips"), () => void useBoat(edit.id))}
        {button(t("Delete boat"), () => confirmDelete(edit))}
      </>}
    </> : <>
      <Text style={{ color: c.textMuted }}>{t("Private boats stay on this device. Series invitations connect you to a race boat without granting ownership.")}</Text>
      {fleet.boats.map(boat => <Pressable key={boat.id} accessibilityRole="button" disabled={busy} onPress={() => setEdit(boat)} style={style}>
        <Text style={{ color: c.text }}>{boat.name} ›</Text>
        {fleet.activeId === boat.id && <Text style={{ color: c.textMuted }}>{t("Active for private trips")}</Text>}
      </Pressable>)}
      {button(t("Create private boat"), () => setEdit({ id: "", name: "", className: "", sailNumber: "" }))}
      <Text style={{ color: c.text, fontSize: 22, fontWeight: "600" }}>{t("Invited races")}</Text>
      {invited ? <View style={{ padding: 16, borderWidth: 1, borderColor: c.border, borderRadius: 12, gap: 12 }}>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: 20 }}>{invited.boatName}</Text>
        <Text style={{ color: c.text }}>{invited.seriesName}</Text>
        <Text style={{ color: c.textMuted }}>{t("Race access only. Boat names, results and shared race tracks are visible to spectators. Private trips remain private.")}</Text>
        {invited.valid ? invited.races.map(race => <View key={race.eventId}>{button(t("Join {{v0}}", { v0: race.raceName }), () => router.push({ pathname: "/race-phone", params: { eventId: race.eventId } }))}</View>)
          : <Text style={{ color: c.text }}>{t("This invitation has expired or been revoked. Ask the referee for a new link.")}</Text>}
        {invited.valid && !invited.races.length && <Text style={{ color: c.text }}>{t("No upcoming published races for your boat yet. Your series invitation remains available.")}</Text>}
      </View> : <Text style={{ color: c.textMuted }}>{t("Open your series invitation on this device to see your boat and join a race.")}</Text>}
      {button(t("Join with invitation"), () => router.push("/race-phone"))}
    </>}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{translateMessage(error)}</Text>}
  </ScrollView></SafeAreaView>;
}
