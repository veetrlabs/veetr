const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const file of ['VeetrRaceRecorderService.kt', 'VeetrMotionQuality.kt', 'VeetrTrackingQuality.kt']) {
  fs.copyFileSync(path.join(root, 'native-recorder', file), path.join(root, 'node_modules/expo-location/android/src/main/java/expo/modules/location', file));
}

// Share the transactional diagnostic format across the independent race process.
fs.writeFileSync(path.join(root, 'node_modules/expo-location/android/src/main/java/expo/modules/location/TripDiagnosticStore.kt'),
  fs.readFileSync(path.join(root, 'modules/veetr-trip-diagnostics/android/src/main/java/org/veetr/diagnostics/TripDiagnosticStore.kt'), 'utf8')
    .replace('package org.veetr.diagnostics', 'package expo.modules.location'));
