// Android's native Google Maps SDK requires a key even when rendering tile overlays.
// Keep it in the EAS environment rather than committing it to app.json.
module.exports = ({ config }) => {
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim()
    || config.android?.config?.googleMaps?.apiKey;

  if (process.env.EAS_BUILD_PLATFORM === 'android' && !apiKey) {
    throw new Error(
      'GOOGLE_MAPS_ANDROID_API_KEY is required for Android builds. Enable Maps SDK for Android, restrict the key to com.veetr.app and the signing certificate, and set it in the EAS build environment.',
    );
  }

  if (!apiKey) return config;

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { ...config.android?.config?.googleMaps, apiKey },
      },
    },
  };
};
