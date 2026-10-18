# Android race recorder

`VeetrRaceRecorderService` runs in the private `:veetr_recorder` process. The
patched ExpoLocation bridge starts it from a visible Ready/Resume action. A
persistent location-service notification remains visible. This covers Android
8+ race sessions; other platforms and older Android retain the existing path.

The service writes to the existing Expo SQLite tracking database with WAL and
transactions. It uses the same history table, timestamp-neighbour sampling and
outbox sequence numbers as JavaScript, so the app can display/export recovered
points and duplicate uploads are idempotent. Network requests use a different
executor from GPS delivery. No network request runs inside a database transaction.

Before acknowledgement of an active race, recording starts locally at planned
start minus five minutes. The Ready screen discloses this backup. The race server
still filters every published point against the official tracking windows.
Pre-start points stay queued until activation or session completion, since sending
them early would cause the server to acknowledge and discard them. A delayed start
continues local capture. Pauses stop publishing, not the disclosed local backup.

GPS requests target one-second fixes (delivery cadence is controlled by Android),
with up to ten seconds of callback batching. Timestamp-neighbour deduplication
uses the same 900 ms window as the JavaScript recorder.

Status checks and uploads run approximately every minute, with bounded request
timeouts. GPS registration is retried after 90 seconds without callbacks. Session
expiry and user/referee stops prevent subsequent writes. The persistent session
and private config allow START_STICKY recovery, subject to Android restrictions;
force-stop, disabled location, or OEM service termination cannot be overridden.
The separate process isolates the recorder from a React Native process crash;
it is not a fix for the original UI crash itself.

Source is copied into expo-location by `scripts/install-native-recorder.cjs`, after
patch-package. Do not add generated Android build outputs to the patch.

## Verification

After `EXPO_OFFLINE=1 npx expo prebuild --platform android --no-install`, run from
`app/android` (with JAVA_HOME and ANDROID_HOME configured):

```
./gradlew :expo-location:testDebugUnitTest --init-script ../native-recorder/tests.gradle
```

Robolectric tests exercise the actual service storage/network code using SQLite
and an HTTP test server: missed start, offline retry, overlapping fixes, referee
stop, and late callbacks after a user stop. App Jest tests verify that race capture
no longer starts the Expo JavaScript location task.

Before release, use an Android device to test screen-off capture, loss/recovery of
network, and termination of just the main app process. Verify that the recorder
process survives, the stored route remains continuous, and the referee receives
heartbeats. A simulator/JVM test cannot establish OEM battery-management behavior.

## Phone motion and speed quality

During Android race recording the same foreground service samples the accelerometer
at a requested 5 Hz. Samples stay in a bounded, in-memory 30-second buffer. Sensor
and location monotonic timestamps match motion to each fix in a delayed GPS batch;
missing, unreliable, interrupted or stale motion is never treated as stillness.
The listener is removed on recording stop, session replacement and service teardown.
Sensor absence or registration failure falls back to GPS alone.

Quiet motion only corroborates very low GPS speed noise after at least five seconds
without displacement beyond the reported position uncertainty. Smooth movement is
not treated as stationary. Position coordinates are never moved by this check.
Unknown/poor-quality speed is stored as null rather than a fabricated zero; course
is cleared when speed cannot support it. Android's reported speed uncertainty, when
available, also rejects speed with uncertainty over max(1 m/s, half the speed).
These thresholds are conservative heuristics, not a calibrated navigation filter.

This implementation covers the native Android race recorder. iOS and private-trip
background recording retain the GPS fallback; foreground JavaScript motion checks
remain available on both platforms. There is no inertial dead reckoning, road
snapping or guaranteed correction of sustained GPS drift. Screen-off sensor delivery,
battery use and real moving/stationary behavior still need physical-device testing.
