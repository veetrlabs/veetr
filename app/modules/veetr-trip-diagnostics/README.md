# Local trip diagnostics

Diagnostic mode enables a separate, persistent SQLite log for the active trip on iOS and Android. It is not part of the anonymous diagnostic report upload. Explicit trip JSON export streams this log in pages alongside the existing trip points. Disabling diagnostics deletes all detailed logs; deleting a trip deletes its log. Existing exports cannot be recalled.

`diagnostics.schemaVersion = 1`. Entries contain:

- `metadata`: app/build/platform/model, filter version, units and requested sensor rate.
- `gps`: raw provider fix, measurement and delivery timestamps, available uncertainty, filtered result, selection of phone/instrument data and filter reason. Native Android race GPS uses `filteredSpeedMps` and `filteredCourseDeg`. Missing values remain null; native provider sentinel values in raw fixes are preserved.
- `sensor`: unaveraged samples at a requested 5 Hz, Unix `atMs`, platform uptime `monotonicMs`, and delivery time. Acceleration/gravity use m/s², angular velocity rad/s. iOS attitude is a quaternion in xArbitraryZVertical; Android rotation vectors use Android's native convention. These frames must not be treated as interchangeable.
- `instrument`: available instrument tracking values, including wind. Instrument wind speeds are in knots; GPS speed is in m/s and course/heading angles in degrees.
- `event`: capture/lifecycle transitions, sensor availability/accuracy, detected sensor gaps over one second, and write/service failures where reportable.

No inertial speed estimator is introduced. `estimated` is false and `confidence` is null; provider uncertainty is preserved separately. GPS classification describes the current speed filter, not independent ground truth. The raw diagnostic stream may include fixes deduplicated from the displayed trip.

Each trip is capped at 256 MiB of JSON payload. `dropped` counts records rejected at that cap; SQLite overhead is additional. Exports use a fixed sequence watermark and bounded pages. Abrupt process termination or storage failure can still lose measurements; a log does not prove continuous sensor availability. Background delivery depends on the OS, permission state and hardware. Android motion capture runs in a foreground service in the recorder process. iOS uses Core Motion while the process is executing; it does not claim to bypass suspension. Real-device background and battery testing is required before release.

Native source is autolinked as a local Expo module, so an updated native binary is required. `scripts/install-native-recorder.cjs` also installs the shared Android store into expo-location's race recorder. The expo-location patch preserves speed/course uncertainty and Android's missing-speed state.

Storage checks:

```sh
swiftc modules/veetr-trip-diagnostics/ios/TripDiagnosticStore.swift modules/veetr-trip-diagnostics/tests/main.swift -o /tmp/veetr-trip-store-test
/tmp/veetr-trip-store-test
cd android
./gradlew :expo-location:testDebugUnitTest --tests '*VeetrTripDiagnosticStoreTest' -I ../native-recorder/tests.gradle
```
