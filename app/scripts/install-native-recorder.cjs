const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.copyFileSync(path.join(root, 'native-recorder/VeetrRaceRecorderService.kt'), path.join(root, 'node_modules/expo-location/android/src/main/java/expo/modules/location/VeetrRaceRecorderService.kt'));
