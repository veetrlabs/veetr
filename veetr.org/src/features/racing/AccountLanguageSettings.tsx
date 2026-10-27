import React, { useState } from "react";
import { supabase } from "./api";
import { rememberAccountLanguage } from "./accountLanguage";
import { t, useLanguage, setLanguage, type Language } from "./i18n";
import { integrated } from "./routes";
import { localizedPath } from "../../i18n/site";

export function AccountLanguageSettings({ userId }: { userId: string }) {
  const language = useLanguage();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section
      className="account-language-settings"
      aria-label={t("Language preference")}
    >
      <label>
        {t("Language preference")}
        <select
          value={language}
          disabled={busy}
          aria-describedby="account-language-help"
          onChange={async (event) => {
            const next = event.target.value as Language;
            if (!supabase || busy) return;
            setBusy(true);
            setMessage("");
            try {
              await rememberAccountLanguage(supabase.auth, userId, next);
              setLanguage(next);
              setMessage("Language saved");
              if (integrated) {
                const url = new URL(window.location.href);
                url.pathname = localizedPath(url.pathname, next);
                window.location.assign(url.href);
              }
            } catch {
              setMessage("Could not save language. Please try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <option value="en" lang="en">
            English
          </option>
          <option value="cs" lang="cs">
            Čeština
          </option>
        </select>
      </label>
      <p className="help" id="account-language-help">
        {t(
          "Used for administration and invitation emails. Changes save automatically.",
        )}
      </p>
      {busy && <p role="status">{t("Saving…")}</p>}
      {message && <p role="status">{t(message)}</p>}
    </section>
  );
}
