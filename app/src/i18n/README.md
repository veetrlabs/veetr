# Mobile languages

The mobile app bundles English (`en`) and Czech (`cs`). Settings → Language offers
System default, English and Čeština. The default selects the first supported
language in the phone's preference list, falling back to English. Explicit choices
are saved in AsyncStorage under `@veetr_language`. Returning to the foreground
refreshes the system language. Changing language does not remount screens or
restart tracking/Bluetooth providers.

## Adding or editing copy

- `en.json` and `cs.json` contain the same source-sentence keys. Sentences are
  literal keys (`keySeparator` and `nsSeparator` are disabled).
- Call `t('Sentence with {{name}}', { name })` for UI copy, and call
  `useLanguageRefresh()` unconditionally in each component using translated copy
  or formatting. Include its returned language in memo dependencies when a memo
  stores translated text. Keep complete sentences together whenever possible.
- Use `count` with i18next plural suffixes. English has `one/other`; Czech also has
  `few/many`. Do not assemble inflected nouns from English fragments.
- Use `formatNumber` for visible decimal values and `locale()` for date formatting.
  Machine-readable CSV, GPS data, IDs, enum values and BLE commands stay unchanged.
  Sailing abbreviations such as SOG, COG, HDG, AWS and units remain international.
- Keep errors stored in English for classification and diagnostics. At the UI
  boundary, `translateMessage` translates known application messages and templates;
  unknown native/server errors remain readable verbatim. Never apply it to boat
  names, race titles or other user content.
- Translations are bundled and work offline. Adding a language requires updating
  resources, supported language types/resolution, the selector, and native config.

## Native release

`expo-localization` is a native dependency: create new iOS/Android binaries before
using this change on devices. An OTA JavaScript update alone is insufficient for
an installed binary without that module. `app.json` registers `en` and `cs` for
both platforms; `locales/*.json` supplies iOS permission descriptions. Native
permission dialogs follow the OS/app language, independently of Veetr's in-app
override. Android's own permission dialog text is supplied by Android; the app's
location disclosure and tracking notification content are translated by Veetr.
Already-visible alerts/notifications retain their text until shown again.

## Checks

Run `npm run typecheck` and `npm test -- --runInBand` from `app/`. Language tests
cover device preference resolution, persistence, storage failure, switching without
remounting, plural forms, placeholders and translated race navigation. Review Czech
sailing terminology with a native speaker and smoke-test permission dialogs on
real devices before release.
