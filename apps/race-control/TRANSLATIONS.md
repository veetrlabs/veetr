# Interface translations

Race Control supports `cs` and `en`. On the first visit, it selects the first supported language in `navigator.languages` (including regional variants such as `cs-CZ`). Unsupported languages fall back to English. The header selection takes effect immediately and is saved under `veetr.language` in local storage. If storage is unavailable, selection still works for the current session.

Use `t("English interface text")` for interface copy. Add the corresponding Czech entry in `src/translations.ts`; English uses the key itself. For dynamic sentences use named placeholders, for example `t("Category for {name}", { name: boat.name })`. Translate whole sentences instead of assembling grammatical fragments. Keep boat names, series names, categories entered by users, IDs, and stored enum values unchanged; translate enum labels only and give form options explicit values.

`src/i18n.tsx` owns detection, persistence, interpolation, and the language selector. The app subscribes to language changes without remounting forms. `document.documentElement.lang` follows the selected language. Add another language by extending the language union, catalogs, detection, and selector. Run `npm run test:race` and `npm run build:race` after changes.

Backend error details that do not have a catalog entry are displayed verbatim as a fallback.
