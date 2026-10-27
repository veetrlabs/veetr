import { useEffect, useState } from "react";
import { supabase } from "./api";
import { rememberAccountLanguage } from "./accountLanguage";
import type { Language } from "./i18n";

// Serialize preference writes so a slower request cannot overwrite a newer choice.
let pending: Promise<unknown> = Promise.resolve();
export function useAccountLanguage(
  userId: string,
  language: Language,
) {
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    if (!userId || !supabase) return;
    const auth = supabase.auth;
    const save = () => {
      pending = pending
        .catch(() => {})
        .then(async () => {
          if (!active) return;
          try {
            await rememberAccountLanguage(auth, userId, language);
            if (active) setError("");
          } catch {
            if (active)
              setError(
                "Could not save your language preference. It will be retried when you reconnect.",
              );
          }
        });
    };
    save();
    window.addEventListener("online", save);
    return () => {
      active = false;
      window.removeEventListener("online", save);
    };
  }, [userId, language]);
  return error;
}
