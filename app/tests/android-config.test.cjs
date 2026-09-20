const { test } = require('node:test');
const assert = require('node:assert/strict');
const configure = require('../app.config.js');
const { expo: config } = require('../app.json');

test('Android builds require a Maps key; iOS remains independent', () => {
  const original = { ...process.env };
  try {
    delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    process.env.EAS_BUILD_PLATFORM = 'android';
    assert.throws(() => configure({ config }), /GOOGLE_MAPS_ANDROID_API_KEY is required/);
    process.env.GOOGLE_MAPS_ANDROID_API_KEY = '   ';
    assert.throws(() => configure({ config }), /GOOGLE_MAPS_ANDROID_API_KEY is required/);
    process.env.GOOGLE_MAPS_ANDROID_API_KEY = ' test-key ';
    const resolved = configure({ config });
    assert.equal(resolved.android.config.googleMaps.apiKey, 'test-key');
    assert.equal(resolved.android.package, 'com.veetr.app');
    assert.deepEqual(resolved.android.permissions, config.android.permissions);
    assert.deepEqual(resolved.plugins, config.plugins);
    assert.deepEqual(resolved.ios, config.ios);
    assert.equal(config.android.config, undefined);
    delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    process.env.EAS_BUILD_PLATFORM = 'ios';
    assert.equal(configure({ config }), config);
    delete process.env.EAS_BUILD_PLATFORM;
    assert.equal(configure({ config }), config);
  } finally {
    for (const key of ['GOOGLE_MAPS_ANDROID_API_KEY', 'EAS_BUILD_PLATFORM']) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
