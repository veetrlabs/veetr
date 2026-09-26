import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { trackingRpc } from "./client";
import type { TrackingSession } from "./model";
export interface RacePhone {
  linkId: string;
  boatId: string;
  boatName: string;
  seriesId: string;
  seriesName: string;
  eventId: string;
  raceName: string;
  scheduledStart: string;
  expiresAt: string;
  valid: boolean;
  active: boolean;
  eligible: boolean;
  ready?: boolean;
  startedAt?: string;
}
const prefix = `veetr-race-phone:${process.env.EXPO_PUBLIC_SUPABASE_URL}:`;
export async function claimRacePhone(token: string): Promise<RacePhone> {
  const tokenHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    token,
  );
  const pendingKey = prefix + "claim:" + tokenHash;
  let secret = await AsyncStorage.getItem(pendingKey);
  if (!secret) {
    secret = Crypto.randomUUID() + Crypto.randomUUID();
    // Save before the request: retries after a lost response retain this phone's identity.
    await AsyncStorage.setItem(pendingKey, secret);
  }
  const phone = await trackingRpc<RacePhone>("claim_race_tracking_link", {
    token,
    device_secret: secret,
  });
  await AsyncStorage.setItem(prefix + phone.linkId, secret);
  await AsyncStorage.setItem(prefix + "last", JSON.stringify(phone));
  return phone;
}
export async function savedRacePhone(): Promise<RacePhone | null> {
  const value = await AsyncStorage.getItem(prefix + "last");
  return value ? JSON.parse(value) : null;
}
export async function racePhoneRpc<T>(
  linkId: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const secret = await AsyncStorage.getItem(prefix + linkId);
  if (!secret)
    throw new Error("Open your race invitation on this phone again.");
  return trackingRpc<T>(name, { lid: linkId, device_secret: secret, ...args });
}
export function raceIsSharing(info: RacePhone) {
  return info.valid && info.active && info.eligible && info.ready !== false;
}
export function raceCaptureAllowed(session: TrackingSession, now = Date.now()) {
  // An acknowledged active race can buffer locally through a network outage.
  // A received pause/revocation disables capture; expiry bounds offline recording.
  // The server separately rejects points outside official race tracking windows.
  return (
    session.mode !== "race" ||
    Boolean(
      session.raceActive &&
      session.raceCheckedAt &&
      Number.isFinite(Date.parse(session.raceCheckedAt)) &&
      Date.parse(session.raceCheckedAt) <= now &&
      session.phase === "recording" &&
      now < Date.parse(session.expiresAt),
    )
  );
}
