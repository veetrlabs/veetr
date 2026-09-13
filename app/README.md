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
