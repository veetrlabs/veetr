const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const file of ['VeetrRaceRecorderService.kt', 'VeetrMotionQuality.kt']) {
  fs.copyFileSync(path.join(root, 'native-recorder', file), path.join(root, 'node_modules/expo-location/android/src/main/java/expo/modules/location', file));
}
