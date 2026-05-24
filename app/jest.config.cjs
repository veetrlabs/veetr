/** @type {import('jest').Config} */
const config = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo(-router)?|@expo|react-native-ble-plx|react-native-maps|react-native-safe-area-context|react-native-screens|react-native-svg|@react-native-async-storage|@react-native-community/netinfo)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  roots: ['<rootDir>/src'],
}

module.exports = config
