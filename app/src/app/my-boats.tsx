import BoatPublishing from "../boats/BoatPublishing";
import { refreshOwnedBoats } from "../boats/cloudBoats";
import RaceBoatLink from "../boats/RaceBoatLink";
import * as Crypto from "expo-crypto";
import BoatModelLookup from "../boats/BoatModelLookup";
import { applyCatalogBoat } from "../boats/catalog";
import BoatPolarDetails from '../polar/BoatPolarDetails';
import { restorePolars } from '../polar/sync';
import BackButton from '../components/BackButton';
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { t, translateMessage, useLanguageRefresh } from "../i18n";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { privateFleet, linkedRaceBoat, savePrivateBoat, selectPrivateBoat, deletePrivateBoat, type PrivateBoat } from "../boats/privateBoats";
import { savedSeriesPhone, seriesPhoneStatus, type SeriesPhone } from "../tracking/seriesPhone";

export default function MyBoats() {
  useLanguageRefresh();
  const params = useLocalSearchParams<{ boatId?: string; boatName?: string }>();
  const [externalBoat, setExternalBoat] = useState<{id:string;name:string}>();
  const c = themeColors[useTheme().theme];
  const [fleet, setFleet] = useState<Awaited<ReturnType<typeof privateFleet>>>({ boats: [] });
  const [invited, setInvited] = useState<SeriesPhone | null>(null);
  const [edit, setEdit] = useState<PrivateBoat>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [polarInteracting,setPolarInteracting]=useState(false);
  const [dimensionErrors, setDimensionErrors] = useState<Record<string,string>>({});
  useFocusEffect(useCallback(() => {
    let alive = true;
    void privateFleet().then(value => { if (alive) {
      setFleet(value);
      if (params.boatId) {
        const boat = value.boats.find(b => b.id === params.boatId) ?? linkedRaceBoat(value, params.boatId);
        setEdit(boat);
        setExternalBoat(boat ? undefined : { id: params.boatId, name: params.boatName || t('Boat') });
      }
    } }).catch(e => { if (alive) setError(e.message); });
    void refreshOwnedBoats().then(value => { if (alive) setFleet(value); }).catch(e => { if (alive) setError(e.message); });
    void (async () => {
      const saved = await savedSeriesPhone();
      if (alive) setInvited(saved);
      if (saved) {
        const fresh = await seriesPhoneStatus(saved.linkId);
        if (alive) setInvited(fresh);
      }
    })().catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [params.boatId, params.boatName]));
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
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}><ScrollView scrollEnabled={!polarInteracting}
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
      <RaceBoatLink key={`link:${externalBoat.id}`} boatId={externalBoat.id} boatName={externalBoat.name} onChange={next => {
        setFleet(next);
        const boat = linkedRaceBoat(next, externalBoat.id);
        if (boat) { setEdit(boat); setExternalBoat(undefined); }
      }} />
      <BoatPolarDetails onInteractionChange={setPolarInteracting} key={externalBoat.id} boatId={externalBoat.id} />
    </> : edit ? <>
      <Text style={{ color: c.textMuted }}>{t("Edits are saved on this device. Use Publish below to share your boat details publicly.")}</Text>
      <BoatModelLookup label={edit.catalogLabel} selectedId={edit.catalogId} selectedRevision={edit.catalogRevision} disabled={busy} onSelect={async entry=> {
        setDimensionErrors({});
        const next=entry ? applyCatalogBoat(edit,entry,Crypto.randomUUID()) : {...edit,catalogId:undefined,catalogRevision:undefined,catalogLabel:undefined,catalogPolar:undefined};
        if (next.id) {
          setBusy(true);
          try { setFleet(await savePrivateBoat(next)); setEdit(next); }
          finally { setBusy(false); }
        } else setEdit(next);
      }} />
      {(["name", "className", "sailNumber", "manufacturer", "model", "variant"] as const).map((field, i) => <View key={field} style={{ gap: 6 }}>
        <Text style={{ color: c.text }}>{t(["Boat name", "Boat class", "Sail number", "Manufacturer", "Model", "Variant / year"][i])}</Text>
        <TextInput accessibilityLabel={t(["Boat name", "Boat class", "Sail number", "Manufacturer", "Model", "Variant / year"][i])} value={edit[field]} maxLength={120}
          onChangeText={value => setEdit({ ...edit, [field]: value })}
          onBlur={() => { if (edit.id) void persist(edit); }}
          style={{ ...style, color: c.text, borderColor: c.border, borderWidth: 1 }} />
      </View>)}
      {([
        ['weightKg','Weight (kg)'],['lengthM','Overall length (m)'],['waterlineLengthM','Waterline length (m)'],
        ['draftM','Draft (m)'],['airDraftM','Height above waterline (m)'],['beamM','Beam (m)'],
      ] as const).map(([field,label])=><View key={`${edit.catalogPolar?.id??'custom'}:${field}`} style={{gap:6}}>
        <Text style={{color:c.text}}>{t(label)}</Text>
        <TextInput accessibilityLabel={t(label)} keyboardType="decimal-pad" defaultValue={edit[field]?.toString()??''}
          onEndEditing={event=>{
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
        {fleet.activeId === edit.id
          ? <Text style={{ color: c.textMuted }}>{t("Active for private trips")}</Text>
          : button(t("Use for private trips"), () => void useBoat(edit.id))}
        <BoatPolarDetails onInteractionChange={setPolarInteracting} key={`${edit.id}:${edit.catalogPolar?.id??""}`} boatId={edit.id} />
        <BoatPublishing key={edit.id} boatId={edit.id} disabled={busy || Object.values(dimensionErrors).some(Boolean)} onRefresh={() => {void refreshOwnedBoats().then(setFleet).catch(e=>setError(e.message));}} />
        {button(t("Delete boat"), () => confirmDelete(edit))}
      </>}
    </> : <>
      <Text style={{ color: c.textMuted }}>{t("Private boats stay on this device until you publish them. Boats owned by your account also appear here. Race invitations grant tracking access, not ownership.")}</Text>
      {fleet.boats.map(boat => <Pressable key={boat.id} accessibilityRole="button" disabled={busy} onPress={() => {setDimensionErrors({});setEdit(boat);}} style={style}>
        <Text style={{ color: c.text }}>{boat.name} ›</Text>
        {fleet.activeId === boat.id && <Text style={{ color: c.textMuted }}>{t("Active for private trips")}</Text>}
      </Pressable>)}
      {button(t("Create private boat"), () => {setDimensionErrors({});setEdit({ id: "", name: "", className: "", sailNumber: "" });})}
      {button(t("Refresh boats"), () => {setBusy(true);setError("");void refreshOwnedBoats().then(setFleet).catch(e=>setError(e.message)).finally(()=>setBusy(false));})}
      {button(t('Restore polars from my account'), () => {
        setBusy(true); setError('');
        void restorePolars().then(setFleet).catch(e => setError(e.message)).finally(() => setBusy(false));
      })}
      <Text style={{ color: c.text, fontSize: 22, fontWeight: "600" }}>{t("Invited races")}</Text>
      {invited ? <View style={{ padding: 16, borderWidth: 1, borderColor: c.border, borderRadius: 12, gap: 12 }}>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: 20 }}>{invited.boatName}</Text>
        <Text style={{ color: c.text }}>{invited.seriesName}</Text>
        <Text style={{ color: c.textMuted }}>{t("Race access only. Boat names, results and shared race tracks are visible to spectators. Private trips remain private.")}</Text>
        {invited.valid && <RaceBoatLink key={invited.boatId} boatId={invited.boatId} boatName={invited.boatName} onChange={setFleet} />}
        {invited.valid ? invited.races.map(race => <View key={race.eventId}>{button(t("Join {{v0}}", { v0: race.raceName }), () => router.push({ pathname: "/race-phone", params: { eventId: race.eventId } }))}</View>)
          : <Text style={{ color: c.text }}>{t("This invitation has expired or been revoked. Ask the referee for a new link.")}</Text>}
        {invited.valid && !invited.races.length && <Text style={{ color: c.text }}>{t("No upcoming published races for your boat yet. Your series invitation remains available.")}</Text>}
      </View> : <Text style={{ color: c.textMuted }}>{t("Open your series invitation on this device to see your boat and join a race.")}</Text>}
      {button(t("Join with invitation"), () => router.push("/race-phone"))}
    </>}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.text }}>{translateMessage(error)}</Text>}
  </ScrollView></SafeAreaView>;
}
