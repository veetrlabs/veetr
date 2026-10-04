# Android marker bitmap regression

The react-native-maps 1.20.1 patch uses laid-out child bounds when sizing custom
marker bitmaps. Fabric interop can omit the legacy shadow-node size update,
otherwise leaving a 100-physical-pixel bitmap for a 112dp SVG. This clips the boat
and ring on dense screens and moves their apparent center relative to map lines.

From `app/android`, with the Android SDK and Java 17 configured:

```
./gradlew :react-native-maps:testDebugUnitTest --init-script ../native-map-tests/tests.gradle
```

The native graphics tests verify bitmap dimensions and visible center/edge pixels
at 1x–4x density, plus replacement of an initial fallback bitmap after layout and
resize. The shared BoatMarker also declares its own bounds and redraws on layout.
All live, trip, and native fleet/replay maps use that component. A physical Android
Google Maps check remains necessary before release; these tests cover the native
bitmap rendering path, not Google Maps integration on a phone.
