import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const trackingClient =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          // Development and production accounts must never share a saved JWT.
          storageKey: `veetr-tracking-auth:${new URL(url).host}`,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          lock: processLock,
        },
        global: {
          fetch: async (input, init) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15_000);
            try {
              return await fetch(input, { ...init, signal: controller.signal });
            } finally {
              clearTimeout(timer);
            }
          },
        },
      })
    : null;
export async function trackingRpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!trackingClient)
    throw new Error("Tracking is not configured in this app build.");
  const { data, error } = await trackingClient.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
