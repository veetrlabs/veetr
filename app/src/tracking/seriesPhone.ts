import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { trackingRpc } from "./client";
import { rememberRacePhone, type RacePhone } from "./racePhone";

export interface SeriesPhone {
  scope: "series";
  linkId: string;
  boatId: string;
  boatName: string;
  seriesId: string;
  seriesName: string;
  valid: boolean;
  connected: boolean;
  races: { eventId: string; raceName: string; scheduledStart: string }[];
}
const prefix = `veetr-series-phone:${process.env.EXPO_PUBLIC_SUPABASE_URL}:`;
export async function savedSeriesPhone(): Promise<SeriesPhone | null> {
  const value = await AsyncStorage.getItem(prefix + "last");
  return value ? JSON.parse(value) : null;
}
export async function claimSeriesPhone(token: string): Promise<SeriesPhone> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    token,
  );
  const pending = prefix + "claim:" + hash;
  let secret = await AsyncStorage.getItem(pending);
  if (!secret) {
    secret = Crypto.randomUUID() + Crypto.randomUUID();
    await AsyncStorage.setItem(pending, secret);
  }
  const phone = await trackingRpc<SeriesPhone>("claim_series_tracking_link", {
    token,
    device_secret: secret,
  });
  await AsyncStorage.setItem(prefix + phone.linkId, secret);
  await AsyncStorage.setItem(prefix + "last", JSON.stringify(phone));
  return phone;
}
async function seriesSecret(linkId: string) {
  const secret = await AsyncStorage.getItem(prefix + linkId);
  if (!secret)
    throw new Error("Open your series invitation on this phone again.");
  return secret;
}
export async function seriesPhoneStatus(linkId: string): Promise<SeriesPhone> {
  return trackingRpc("series_phone_status", {
    lid: linkId,
    device_secret: await seriesSecret(linkId),
  });
}
export async function connectSeriesRace(
  phone: SeriesPhone,
  eventId: string,
): Promise<RacePhone> {
  const secret = await seriesSecret(phone.linkId);
  const race = await trackingRpc<RacePhone>("connect_series_race_phone", {
    lid: phone.linkId,
    device_secret: secret,
    event_id: eventId,
  });
  await rememberRacePhone(race, secret);
  return race;
}
