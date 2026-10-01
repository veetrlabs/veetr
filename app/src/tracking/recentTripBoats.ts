import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackingClient } from './client';
import type { TripBoat } from './tripSharing';

export async function recentTripBoats(): Promise<string[]> {
  const user = (await trackingClient?.auth.getSession())?.data.session?.user.id;
  if (!user) return [];
  const [stored, last] = await Promise.all([
    AsyncStorage.getItem(`veetr-recent-trip-boats:${user}`),
    AsyncStorage.getItem(`veetr-last-trip-boat:${user}`),
  ]);
  let ids: unknown;
  try { ids = JSON.parse(stored || '[]'); } catch { ids = []; }
  return [...new Set([...(last ? [last] : []), ...(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [])])];
}
export function orderTripBoats(boats: TripBoat[], recent: string[]): TripBoat[] {
  const rank = new Map(recent.map((id, i) => [id, i]));
  return [...boats].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export async function rememberTripBoat(id: string): Promise<void> {
  const user = (await trackingClient?.auth.getSession())?.data.session?.user.id;
  if (!user) return;
  const ids = [id, ...(await recentTripBoats()).filter(previous => previous !== id)].slice(0, 100);
  await AsyncStorage.multiSet([
    [`veetr-recent-trip-boats:${user}`, JSON.stringify(ids)],
    [`veetr-last-trip-boat:${user}`, id],
  ]);
}
