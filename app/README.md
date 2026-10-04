# Veetr Mobile

A React Native (Expo) sailing dashboard that displays real-time sensor data from a Veetr BLE-enabled sailing device. View wind speed, boat speed, heel angle, heading, GPS position on a map, and regatta starting line management — all via Bluetooth Low Energy.

This is one workspace in the [Veetr monorepo](https://github.com/veetrlabs/veetr). See the [root README](../README.md) for the full project overview.

---

## Prerequisites

- **Node.js ≥ 18** — install via [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm)
- **Xcode** (macOS only) — for iOS builds, from the Mac App Store
- **Android Studio** — for Android builds, [download here](https://developer.android.com/studio)
- **Expo account** — [sign up](https://expo.dev/signup) (free, needed for EAS builds)
- **Apple Developer account** (iOS only, $99/year) — for device deployment and App Store
- **Physical device** — for BLE and GPS testing (simulators don't support Bluetooth)

---

## Quick Start

```bash
# Install dependencies (from monorepo root)
npm install

# Start the Expo dev server
npx expo start

# Launch on specific platforms
npx expo run:ios          # development build for iOS
npx expo run:android      # development build for Android

# Run tests
npm test
```

> **No global install needed.** SDK 54 uses `npx expo` — the CLI is bundled with the `expo` package.

---

## Testing on a Physical Device

BLE and GPS require real hardware. Here are three approaches:

### Option A: USB-connected device (fastest for development)

```bash
# iOS (iPhone connected via USB)
npx expo run:ios --device

# Android (device connected via USB with USB debugging enabled)
npx expo run:android --device
```

This installs a development build directly onto the connected device. Hot reload works over USB.

### Option B: EAS Development Build (cordless, over-the-air)

Build once with EAS, then install the build artifact on the device. Subsequent JS-only changes update instantly over Wi-Fi via `npx expo start --dev-client`.

```bash
# Install eas-cli
npm install -g eas-cli
eas login

# Build a development build for your device
eas build --platform ios --profile development
eas build --platform android --profile development

# After installing the build on your device, start the dev server
npx expo start --dev-client
```

The device connects to your dev server over your local network — no USB cable needed.

### Option C: EAS Internal Distribution (TestFlight / Play Store Internal Testing)

For sharing with a wider test group without going through app review:

- **iOS:** Use [TestFlight](https://developer.apple.com/testflight/) via `eas submit --platform ios`
- **Android:** Use [Google Play Internal Testing](https://support.google.com/googleplay/android-developer/answer/9845334) via `eas submit --platform android`

---

## BLE Testing Without a Physical Veetr Device

### Using Mock Data

The BLE context falls back gracefully when `react-native-ble-plx` is unavailable. To test the UI without a device:

1. Start the app on a simulator or Expo Go.
2. The app loads and shows the dashboard with all zeros.
3. Manually inject test data by calling the BLE context's dispatch pattern (temporary code):

   ```ts
   // In App.tsx for testing only:
   import { useBLE } from './src/context/BLEContext'
   
   // After connection, periodically dispatch:
   dispatch({
     type: 'UPDATE_DATA',
     payload: {
       windSpeed: 12.5,
       windAngle: 45,
       heading: 180,
       speed: 6.2,
       tilt: 12,
       // ... other fields
     }
   })
   ```

### BLE Peripheral Simulator (Advanced)

For end-to-end BLE testing without the physical Veetr device:

- **iOS:** Use [LightBlue](https://punchthrough.com/lightblue/) app to advertise a BLE peripheral with a custom characteristic matching the Veetr service UUID and data format.
- **Android:** Use [nRF Connect](https://www.nordicsemi.com/Products/Development-tools/nrf-connect-for-mobile) to set up a mock BLE peripheral.

The app expects the Veetr GATT service (`12345678-1234-1234-1234-123456789abc`) with a sensor data characteristic (`87654321-4321-4321-4321-cba987654321`) that sends base64-encoded JSON at ~1 Hz.

---

## Building for Production

Production builds use **EAS Build**. EAS produces installable `.ipa` (iOS) and `.aab`/`.apk` (Android) files.

### Local signed builds and beta submission

Use `--local` to compile on a Mac instead of consuming EAS cloud build capacity.
Xcode, CocoaPods, fastlane, Java 17, and the Android SDK/NDK must be installed.
EAS still provides the existing signing credentials, remote build-number increments,
only. Upload directly from this Mac to Apple and Google; do not use EAS Submit
or cloud build queues for these releases. Run from `app/`:

```bash
# Build sequentially to limit peak disk and memory use.
eas build --platform ios --profile testflight --local --non-interactive \
  --freeze-credentials --output /tmp/veetr-ios.ipa

API_PRIVATE_KEYS_DIR=/path/to/private-keys xcrun altool --upload-app \
  -f /tmp/veetr-ios.ipa --api-key APPLE_KEY_ID --api-issuer APPLE_ISSUER_ID

# Homebrew paths on the release Mac; adjust for another installation.
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools \
  eas build --platform android --profile android-testing --local \
  --non-interactive --freeze-credentials --output /tmp/veetr-android.aab

fastlane supply --package_name com.veetr.app --track internal \
  --release_status completed --aab /tmp/veetr-android.aab \
  --json_key /path/to/google-play-service-account.json \
  --skip_upload_metadata true --skip_upload_changelogs true \
  --skip_upload_images true --skip_upload_screenshots true
```

These profiles target TestFlight and Google Play **internal testing**, respectively.
Use explicit artifact paths for uploads and keep store credentials outside Git.
Verify Apple processing is valid and the new version is on Google Play internal
testing before reporting availability. Local builds include the current working
tree; run the tests and review pending changes first. EAS variables with Secret
visibility must be supplied locally; the configured Sensitive Android Maps key is
loaded from the production environment. Keep credentials and build logs out of Git.
The existing `main` push workflow continues to trigger cloud builds independently.

### Android internal testing

The Google Play app uses package name `com.veetr.app`; the Android app config
must match it. The iOS bundle identifier remains `com.veetr.mobile`.

The `android-testing` EAS profile builds a signed Play Store app bundle, inherits
the production Supabase settings, and automatically increments Android's version
code. The EAS workflow in `.eas/workflows/testflight.yml` runs the mobile tests
and builds both iOS and Android on mobile changes pushed to `main`.
Merge tested mobile changes into `main` before releasing; feature branches do
not automatically submit releases. The workflow submits iOS to TestFlight and
Android to Google Play's internal testing track after each platform's build
succeeds. Android submission requires the Google Play service account credential
in EAS; it is not stored in GitHub or this repository.

To build Android separately, run from `app/`:

First configure `GOOGLE_MAPS_ANDROID_API_KEY` in the EAS environment used by the
build profile (production for `android-testing`). Enable **Maps SDK for Android**
in the corresponding Google Cloud project. Restrict the key to that API and the
Android package `com.veetr.app`, with the **Play app signing certificate SHA-1**
from Play Console → App integrity → App signing. This is distinct from the upload
certificate. For directly installed APKs, also allow their signing certificate.
Google Cloud's billing requirements must be satisfied for the Maps SDK.

`app.config.js` injects the key into `android.config.googleMaps.apiKey` and rejects
EAS Android builds without it. For local Android builds, set the same variable in
`.env` before native generation. A native rebuild is required; a JavaScript-only
update cannot add the Android manifest entry. Map screens and recorded-trip
previews all depend on this configuration. Verify both on a Play-installed build.

Run the configuration regression check with `node --test tests/android-config.test.cjs`.

```bash
eas build --platform android --profile android-testing
```

For a manual fallback, download the resulting `.aab` and upload it to Veetr in Google Play Console under
**Test and release → Testing → Internal testing**. Add release notes, review the
release, and roll it out to internal testing. Add testers' Google account emails
on the Testers tab and share the opt-in link with them.

The matching submission profile targets only the internal track. To submit a
specific existing build manually through the same EAS credential:

```bash
eas submit --platform android --profile android-testing --id <build-id>
```

Manage the submission credential with `eas credentials --platform android`,
selecting `android-testing` and Google Service Account. The dedicated account
needs access to Veetr in Play Console and permission to view app information and
release to testing tracks. Do not grant production publishing or Cloud project
roles. Store its JSON key only in EAS credentials, never in the repository.

Validate workflow edits with
`eas workflow:validate .eas/workflows/testflight.yml --non-interactive`.

The `preview` profile produces a directly installable APK instead; that artifact
cannot be uploaded as a Google Play app bundle.

### Setup

```bash
npm install -g eas-cli
eas login
```

You'll also need an [`eas.json`](https://docs.expo.dev/build/eas-json/) at the project root. Create one if it doesn't exist:

```json
{
  "cli": {
    "version": ">= 14.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### Build Commands

```bash
# Development build (for internal testing)
eas build --platform ios --profile development
eas build --platform android --profile development

# Production build
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### OTA Updates (JS-only changes)

When only JavaScript/TypeScript files change (no native modules, no `app.json` changes), you can push updates instantly without a new build:

```bash
eas update --branch production --message "Fix wind angle calculation"
```

Users who already have the app installed will receive the update on next launch.

---

## Release Process

The monorepo follows a [semver](https://semver.org/) release workflow triggered by a git tag (e.g., `0.1.0`). The existing [release workflow](../.github/workflows/release.yml) builds the web app and firmware, but **the mobile app is not yet included in that pipeline**.

### Current Manual Process

1. Bump version in `app.json` (`expo.version`).
2. Create a git tag matching the version.
3. Build and submit via EAS (see Building for Production above).
4. Create a GitHub Release with changelog.

### CI/CD

The monorepo has CI workflows defined in [`.github/workflows/test.yml`](../.github/workflows/test.yml):

- **`test-app`** — runs `npm test` on every PR to `main` and every push to `main`.
- **`test-shared`** — runs `npm test` for the `@veetr/shared` package (42 tests covering sailing math, GPS validation, version comparison, firmware formatting).
- **`test-web`** — builds the web (PWA) app to catch build errors.
- **`test-firmware`** — builds firmware and runs native unit tests via PlatformIO.

All test jobs must pass before a PR can merge to `main`.

Future improvements:
- **EAS Build on tags:** Add a job that runs `eas build --platform all --non-interactive` when a version tag is pushed. See [expo/expo-github-action](https://github.com/expo/expo-github-action).
- **Lint:** Add `npm run lint` once an ESLint config is set up.

---

## Project Structure

```
mobile/
├── App.tsx                  # Root component: ThemeProvider → BLEProvider → AppNavigator
├── app.json                 # Expo config (version, permissions, plugins)
├── src/
│   ├── context/
│   │   ├── BLEContext.tsx   # BLE connection, sensor data, firmware updates
│   │   └── ThemeContext.tsx  # Light/dark mode with AsyncStorage persistence
│   ├── components/
│   │   ├── Dashboard.tsx    # Main instrument panel layout
│   │   ├── cards/           # Individual gauge cards (Speed, Wind, Heading, etc.)
│   │   ├── modals/          # MapModal, DataChartModal
│   │   └── *.tsx            # Settings panel, buttons, status indicators
│   ├── pages/
│   │   └── Map.tsx          # Full-screen GPS map with track and start line
│   ├── navigation/
│   │   └── AppNavigator.tsx # Simple page router (Dashboard / Map)
│   ├── hooks/
│   │   ├── useSmoothRotation.ts  # Animated compass rotation
│   │   ├── useCardTextSize.ts    # Responsive font sizing for cards
│   │   └── useOnlineStatus.ts    # Network connectivity via NetInfo
│   ├── constants/
│   │   └── colors.ts        # Light/dark theme color palettes
│   └── utils/
│       ├── dataStorage.ts   # AsyncStorage persistence with 10s averaging
│       ├── firmwareUpdater.ts # BLE OTA firmware chunked transfer
│       ├── githubApi.ts     # GitHub Releases API client
│       ├── gpsValidation.ts # Coordinate validation helpers
│       ├── alertUtils.ts    # Debounced alert (prevents spam)
│       └── version.ts       # App version string
```

### Data Flow

```
BLE Device → BLE characteristic → handleSensorData() → dispatch(UPDATE_DATA)
                                                      → dataStorage.addReading()
Dashboard → useBLE() → sailingData → card component props
Map → useBLE() + dataStorage.getReadings() ← historical GPS track
Settings → useBLE().sendCommand() → BLE device (calibration, regatta)
```

---

## Key Conventions

| Area | Convention |
|------|-----------|
| **State** | `useBLE()` hook for sensor/connection state. Context + `useReducer` pattern. |
| **Components** | Functional + `StyleSheet.create`. Cards receive data via **props**, not context directly. |
| **Styling** | `themeColors[theme]` from `colors.ts`. All components support light/dark. |
| **Data** | `dataStorage.addReading()` on each sensor event. 10s averaging window. 50k record cap. |
| **Hooks** | Wrap new screen content in `BLProvider` descendants. `useTheme()` for theming. |

---

## Testing

Tests use **Jest** with the `react-native` preset. There are 58 tests across 4 suites:

| Suite | File | Tests |
|-------|------|-------|
| BLE Reducer | `src/context/__tests__/BLEContext.test.ts` | 31 |
| Alert Utils | `src/utils/__tests__/alertUtils.test.ts` | 13 |
| Version | `src/utils/__tests__/version.test.ts` | 9 |
| Colors | `src/constants/__tests__/colors.test.ts` | 5 |

```bash
npm test              # run all tests
npm run test:watch    # watch mode
```

The shared `@veetr/shared` package under `packages/shared/` also has 42 tests which run in CI.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `npm install` fails | Run from the monorepo root: `npm install` (workspaces resolve cross-package deps). |
| Metro bundler error | Clear cache: `npx expo start -c` |
| BLE doesn't connect | Ensure you're on a development build, not Expo Go. BLE requires a physical device. |
| "Cannot find module" | The monorepo uses npm workspaces. Always `npm install` from the root. |
| iOS Simulator shows blank map | `react-native-maps` needs a native build (`npx expo run:ios`), not `npx expo start` alone. |

## Regatta tracking

The **Track** tab can share phone GPS through Supabase to the series live map. See [Mobile tracking setup and field checks](../docs/MOBILE_TRACKING.md). Copy `.env.example` to `.env.local` and configure the matching backend and website; rebuild the native app for the new background location permissions.

### Vane sensor calibration (0.0.35)

Settings → Calibration → Calibrate Vane sensors runs a guided device calibration.
Detach the assembled Vane from the boat, keep power/Bluetooth connected, and move
Vane itself through the prompted orientations. Do not attempt to tilt the boat.
The guide covers 4–6 held orientations, three seconds stationary, then roughly
180° rotations and returns around roll, pitch and yaw, away from magnetic objects.
Save is gated on a fresh magnetic-field quality of 2/3 or better and a minimum
15-second session. The firmware requests the manufacturer's 50 Hz magnetic reports.

A matching SH-2 Save DCD response with success status is required before the app
says saved. The ME-calibration command response alone is not proof of a flash save.
Lost responses are reported as unconfirmed. Disconnect/no heartbeat cancels an
unsaved session; an already issued save is allowed to finish. Cancellation stops
calibration without requesting a save; it does not undo live sensor adjustments.
Remount Vane in its sailing position, then set vessel level and north reference.
No Supabase schema change is needed for this workflow.

OTA uses the old bounded chunks until firmware advertises support for 330-byte
chunks. Firmware 0.0.35 advertises MTU 517, increases JSON parsing capacity, removes
the fixed 10 ms post-ack sleep during OTA, and reduces per-chunk serial logging.
The app respects the actual negotiated MTU and still waits for every chunk ack.
The first upgrade from 0.0.34 remains limited by that firmware's smaller MTU;
subsequent upgrades can carry about three times as many firmware bytes per write.
This is a payload improvement, not a measured hardware transfer-time guarantee.


### Extended Vane sensor diagnostics (0.0.36)

The same Run Vane diagnostics button requests protocol v2; older firmware still
returns the original two-part report. V2 requires all four bounded parts before a
sample is accepted. Optional `sample.sensor` fields use integer units:
`mx/my/mz` are calibrated magnetic field in 0.1 µT; `gx/gy/gz` are uncalibrated
gyro rates and `bx/by/bz` are estimated gyro biases in 0.001 rad/s; `acc` is the
rotation-vector accuracy estimate in 0.001 rad. `mq/gq` are sensor quality 0–3;
`ma/ga/ca` are ages in milliseconds (-1 means unavailable). `ce` is the confirmed
calibration-enable bitmask (1 accelerometer, 2 gyro, 4 magnetometer; -1 unknown).
Missing numeric measurements are null, never invented zero values.

Extra magnetic and gyro subscriptions expire eight seconds after the last request
and stop before guided calibration or on disconnect. Reading the calibration
flags does not change them or save DCD. The first sample may lack fresh extra
measurements. This report does not prove saved DCD persistence or diagnose a bad
chip by itself. It records evidence for comparing stationary gyro residuals,
magnetic-field changes, and the sensor's reported calibration modes.

Guided calibration now restores the normal accel+mag dynamic-calibration policy,
with gyro dynamic calibration disabled, instead of disabling every calibration.
Completion waits for the matching restore-command acknowledgement. The restart
experiment still showed low quality, so this correction is not a verified drift fix.

## Anchor alarm

Settings → Anchor alarm saves an anchor with **Anchor dropped** or by moving the map beneath a fixed center target.
Chain out and an extra margin (metres) persist locally; the displayed alarm radius
is their sum. Editing an armed alarm requires confirmation and resets its latch.
A position outside the radius latches the alarm and repeats local notifications
at most every 30 seconds until stopped. Test alarm sound before use.

The bundle entry registers `veetr-anchor-location-v1` independently of trip
recording. Fresh Vane telemetry is preferred, with phone GPS as fallback; the
phone must remain aboard. Phone positions older than 30 seconds or with reported
accuracy worse than 50 m are rejected. A native notification scheduled roughly
90 seconds ahead warns if reliable position delivery stops. Monitoring resumes
from saved settings when the app reopens. No anchor data is uploaded.

This requires a new native build for `expo-notifications` and the location-service
ownership patch. Background location and audible notification permission are
required to arm. Notifications respect OS sound/Focus settings; this does not
provide iOS Critical Alerts or an uninterrupted siren. Force-quitting, OS power
management and permission changes can interrupt monitoring. The native watchdog
is a best-effort notification, not a guarantee of continuous GPS execution.

Before release, validate on physical iOS and Android devices: screen lock,
notification sound/Do Not Disturb, Vane disconnect and phone fallback, GPS loss,
process termination/reopen, and stopping trip recording and anchor monitoring in
both orders. Map selection, persistence, boundary detection, background callbacks,
permission denial and cleanup are covered in `src/anchor/__tests__`.
