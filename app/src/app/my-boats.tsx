import BoatPublishing from "../boats/BoatPublishing";
import { cacheRaceBoat, canEditDownloadedBoat, refreshOwnedBoats } from "../boats/cloudBoats";
import { trackingClient } from "../tracking/client";
import RaceBoatPreview from "../boats/RaceBoatPreview";
import * as Crypto from "expo-crypto";
import BoatModelLookup from "../boats/BoatModelLookup";
import { applyCatalogBoat } from "../boats/catalog";
import BoatPolarDetails from '../polar/BoatPolarDetails';
import BackButton from '../components/BackButton';
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { t, translateMessage, useLanguageRefresh } from "../i18n";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { privateFleet, savePrivateBoat, selectPrivateBoat, deletePrivateBoat, type PrivateBoat } from "../boats/privateBoats";
import { savedSeriesPhone, seriesPhoneStatus, type SeriesPhone } from "../tracking/seriesPhone";

export default function MyBoats() {
  useLanguageRefresh();
  const params = useLocalSearchParams<{ boatId?: string; raceBoatId?: string; boatName?: string }>();
  const [externalBoat, setExternalBoat] = useState<{id:string;name:string}>();
  const c = themeColors[useTheme().theme];
  const [fleet, setFleet] = useState<Awaited<ReturnType<typeof privateFleet>>>({ boats: [] });
  const [invited, setInvited] = useState<SeriesPhone | null>(null);
  const [edit, setEdit] = useState<PrivateBoat>();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [editableId, setEditableId] = useState<string>();
  const readOnly = !!edit?.downloadedFrom && editableId !== edit.id;
  useFocusEffect(useCallback(() => {
    let alive = true;
    let revision = 0;
    const check = async () => {
      const current = ++revision;
      setEditableId(undefined);
      if (!edit?.downloadedFrom) return;
      try { if (await canEditDownloadedBoat(edit)) { if (alive && revision === current) setEditableId(edit.id); } }
      catch { /* Keep the offline copy readable, with editing locked. */ }
    };
    void check();
    const subscription = trackingClient?.auth.onAuthStateChange?.(() => { setEditableId(undefined); revision++; setTimeout(() => { if (alive) void check(); }, 0); });
    return () => { alive = false; subscription?.data.subscription.unsubscribe(); };
  }, [edit?.id, edit?.downloadedFrom?.boatId, refreshVersion]));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  const [polarInteracting,setPolarInteracting]=useState(false);
  const [dimensionErrors, setDimensionErrors] = useState<Record<string,string>>({});
  useFocusEffect(useCallback(() => {
    let alive = true;
    void privateFleet().then(value => { if (alive) {
      setFleet(value);
      if (params.boatId || params.raceBoatId) {
        const boat = params.raceBoatId ? value.boats.find(b => b.racePreview && b.downloadedFrom?.boatId === params.raceBoatId && b.downloadedFrom?.server === (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "")) : value.boats.find(b => b.id === params.boatId);
        setEdit(boat);
        setExternalBoat(boat ? undefined : { id: (params.raceBoatId ?? params.boatId)!, name: params.boatName || t('Boat') });
      }
    } }).catch(e => { if (alive) setError(e.message); });
    void (async () => { const before = await privateFleet(); const value = await refreshOwnedBoats(); if (alive) { setFleet(value); setEdit(current => current?.downloadedFrom && JSON.stringify(current) === JSON.stringify(before.boats.find(b => b.id === current.id)) ? value.boats.find(b => b.id === current.id) ?? current : current); setRefreshVersion(v => v + 1); } })().catch(e => { if (alive) setError(e.message); });
    void (async () => {
      const saved = await savedSeriesPhone();
      if (alive) setInvited(saved);
      if (saved) {
        void cacheRaceBoat(saved.boatId).then(value => { if (alive) setFleet(value); }).catch(() => {});
        const fresh = await seriesPhoneStatus(saved.linkId);
        if (alive) setInvited(fresh);
      }
    })().catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [params.boatId, params.raceBoatId, params.boatName]));
  useFocusEffect(useCallback(() => {
    if (!externalBoat) return;
    let alive = true;
    void cacheRaceBoat(externalBoat.id).then(next => {
      if (!alive) return;
      setFleet(next);
      setEdit(next.boats.find(b => b.racePreview && b.downloadedFrom?.boatId === externalBoat.id));
      setExternalBoat(undefined);
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [externalBoat?.id]));
  const refresh = async () => {
    if (refreshInFlight.current || busy || polarInteracting) return;
    refreshInFlight.current = true;
    setRefreshing(true); setError("");
    try {
      if (externalBoat) {
        const cached = await cacheRaceBoat(externalBoat.id);
        setFleet(cached);
        setEdit(cached.boats.find(b => b.racePreview && b.downloadedFrom?.boatId === externalBoat.id));
        setExternalBoat(undefined);
      }
      const before = await privateFleet();
      const next = await refreshOwnedBoats();
      setFleet(next);
      // Refresh a displayed saved profile without discarding an unfinished field edit.
      setEdit(current => current && JSON.stringify(current) === JSON.stringify(before.boats.find(b => b.id === current.id))
        ? next.boats.find(b => b.id === current.id) ?? current : current);
      const saved = await savedSeriesPhone();
      setInvited(saved ? await seriesPhoneStatus(saved.linkId) : null);
    } catch (e) { setError((e as Error).message); }
    finally { setRefreshVersion(v => v + 1); setRefreshing(false); refreshInFlight.current = false; }
  };
  const style = { padding: 16, borderRadius: 12, backgroundColor: c.buttonBg, minHeight: 48 };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={style}><Text style={{ color: c.text }}>{label}</Text></Pressable>;
  const persist = async (boat: PrivateBoat) => {
    if (readOnly) return;
    setBusy(true); setError("");
    try {
      if (!(await canEditDownloadedBoat(boat))) throw new Error("Only the boat owner can edit or upload this downloaded boat.");
      const next = await savePrivateBoat(boat);
      setFleet(next);
      if (!boat.id) setEdit(undefined);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const useBoat = async (id?: string) => {
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
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView scrollEnabled={!polarInteracting} alwaysBounceVertical
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} enabled={!busy && !polarInteracting} tintColor={c.text} colors={[c.text]} />}
    onStartShouldSetResponderCapture={(event) => {
      // A new touch sequence must never inherit a missed release from the chart.
      if (event.nativeEvent.touches.length === 1) setPolarInteracting(false);
      return false;
    }}
    onTouchEnd={(event) => { if (!event.nativeEvent.touches.length) setPolarInteracting(false); }}
    onTouchCancel={() => setPolarInteracting(false)}
    keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
    <BackButton onPress={() => edit ? setEdit(undefined) : externalBoat ? setExternalBoat(undefined) : router.back()} />
    <Text accessibilityRole="header" style={{ color: c.text, fontSize: 28, fontWeight: "700" }}>{edit || externalBoat ? t("Boat details") : t("My boats")}</Text>
    {externalBoat ? <>
      <Text style={{color:c.text,fontSize:22,fontWeight:'600'}}>{externalBoat.name}</Text>
      <Text style={{color:c.textMuted}}>{t(error ? "Boat details unavailable. Pull down to try again." : "Loading boat details…")}</Text>
    </> : edit ? <>
      <Text style={{ color: c.textMuted }}>{t(readOnly ? "Downloaded public boat. Details refresh when you open My boats or pull down. Only the owner can edit; saved details remain available offline." : "Edits are saved on this device. Upload below to save the boat to your account or publish it.")}</Text>
      {!readOnly && <BoatModelLookup label={edit.catalogLabel} selectedId={edit.catalogId} selectedRevision={edit.catalogRevision} disabled={busy} onSelect={async entry=> {
        setDimensionErrors({});
        const next=entry ? applyCatalogBoat(edit,entry,Crypto.randomUUID()) : {...edit,catalogId:undefined,catalogRevision:undefined,catalogLabel:undefined,catalogPolar:undefined};
        if (next.id) {
          setBusy(true);
          try { setFleet(await savePrivateBoat(next)); setEdit(next); }
          finally { setBusy(false); }
        } else setEdit(next);
      }} />}
      {(["name", "className", "sailNumber", "manufacturer", "model", "variant"] as const).map((field, i) => <View key={field} style={{ gap: 6 }}>
        <Text style={{ color: c.text }}>{t(["Boat name", "Boat class", "Sail number", "Manufacturer", "Model", "Variant / year"][i])}</Text>
        <TextInput editable={!readOnly} accessibilityLabel={t(["Boat name", "Boat class", "Sail number", "Manufacturer", "Model", "Variant / year"][i])} value={edit[field]} maxLength={120}
          onChangeText={value => !readOnly && setEdit({ ...edit, [field]: value })}
          onBlur={() => { if (edit.id) void persist(edit); }}
          style={{ ...style, color: c.text, borderColor: c.border, borderWidth: 1 }} />
      </View>)}
      {([
        ['weightKg','Weight (kg)'],['lengthM','Overall length (m)'],['waterlineLengthM','Waterline length (m)'],
        ['draftM','Draft (m)'],['airDraftM','Height above waterline (m)'],['beamM','Beam (m)'],
      ] as const).map(([field,label])=><View key={`${edit.catalogPolar?.id??'custom'}:${field}:${edit[field]??''}`} style={{gap:6}}>
        <Text style={{color:c.text}}>{t(label)}</Text>
        <TextInput editable={!readOnly} accessibilityLabel={t(label)} keyboardType="decimal-pad" defaultValue={edit[field]?.toString()??''}
          onEndEditing={event=>{
            if(readOnly)return;
            const text=event.nativeEvent.text.trim().replace(',','.');
            const value=text?Number(text):undefined;
            const max=field==='weightKg'?999999999:field==='draftM'?30:field==='beamM'?100:200;
            if(value!==undefined&&(!Number.isFinite(value)||value<=0||value>max)) {setDimensionErrors(previous=>({...previous,[field]:t(field==='weightKg'?'Enter a valid boat weight.':'Enter a valid boat dimension.')}));return;}
            const next={...edit,[field]:value};
            if(next.waterlineLengthM&&next.lengthM&&next.waterlineLengthM>next.lengthM){setDimensionErrors(previous=>({...previous,[field]:t('Waterline length cannot exceed overall length.')}));return;}
            setDimensionErrors(previous=>({...previous,[field]:''}));setEdit(next);if(edit.id)void persist(next);
          }} style={{...style,color:c.text,borderColor:c.border,borderWidth:1}} />
        {!!dimensionErrors[field]&&<Text accessibilityRole="alert" style={{color:c.text}}>{dimensionErrors[field]}</Text>}
        {field==='airDraftM'&&<Text style={{color:c.textMuted}}>{t('Measure to the highest point, including antennas.')}</Text>}
      </View>)}
      {!edit.id && button(t("Create private boat"), () => {if(!Object.values(dimensionErrors).some(Boolean)) void persist(edit);})}
      {!!edit.id && <>
        <View style={{flexDirection:"row",alignItems:"center",gap:12,minHeight:48}}>
          <Text style={{color:c.text,flex:1}}>{t("Use for private trips")}</Text>
          <Switch accessibilityLabel={t("Use for private trips")} value={fleet.activeId === edit.id}
            disabled={busy || refreshing} onValueChange={enabled => void useBoat(enabled ? edit.id : undefined)} />
        </View>
        <BoatPolarDetails readOnly={readOnly} onInteractionChange={setPolarInteracting} key={`${edit.id}:${edit.catalogPolar?.id??""}:${refreshVersion}`} boatId={edit.id} />
        {!readOnly && <BoatPublishing key={edit.id} boatId={edit.id} refreshVersion={refreshVersion} disabled={busy || refreshing || Object.values(dimensionErrors).some(Boolean)} onRefresh={() => {void refreshOwnedBoats().then(setFleet).catch(e=>setError(e.message));}} />}
        {!edit.racePreview && button(t("Delete boat"), () => confirmDelete(edit))}
      </>}
    </> : <>
      <Text style={{ color: c.textMuted }}>{t("Upload a boat to use it on your other devices. New boats stay private unless you choose a public upload. Race invitations grant tracking access, not ownership.")}</Text>
      {fleet.boats.filter(boat => !boat.racePreview).map(boat => <Pressable key={boat.id} accessibilityRole="button" disabled={busy} onPress={() => {setDimensionErrors({});setEdit(boat);}} style={style}>
        <Text style={{ color: c.text }}>{boat.name} ›</Text>
        {fleet.activeId === boat.id && <Text style={{ color: c.textMuted }}>{t("Active for private trips")}</Text>}
      </Pressable>)}
      {button(t("Create private boat"), () => {setDimensionErrors({});setEdit({ id: "", name: "", className: "", sailNumber: "" });})}
      <Text style={{ color: c.text, fontSize: 22, fontWeight: "600" }}>{t("Invited races")}</Text>
      {invited ? <View style={{ padding: 16, borderWidth: 1, borderColor: c.border, borderRadius: 12, gap: 12 }}>
        <RaceBoatPreview boatId={invited.boatId} boatName={invited.boatName} />
        {fleet.boats.some(boat => boat.id === fleet.activeId && boat.racePreview && boat.downloadedFrom?.boatId === invited.boatId && boat.downloadedFrom?.server === (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "")) && <Text style={{color:c.textMuted}}>{t("Active for private trips")}</Text>}
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
