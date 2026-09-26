const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const marker = '// Veetr scene lifecycle';

function patchAppDelegate(contents) {
  if (contents.includes(marker)) return contents;
  const start = contents.indexOf('#if os(iOS) || os(tvOS)');
  const end = contents.indexOf('#endif', start);
  if (start < 0 || end < 0 || !contents.slice(start, end).includes('factory.startReactNative')) {
    throw new Error('Veetr scene plugin: Expo startup template changed; review the migration');
  }
  contents = contents.slice(0, start) + '    self.initialLaunchOptions = launchOptions\n' + contents.slice(end + '#endif'.length);
  contents = contents.replace('  var window: UIWindow?', '  var window: UIWindow?\n  var initialLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?');
  return contents + '\n' + fs.readFileSync(path.join(__dirname, 'ios-scene-delegate.swift'), 'utf8');
}

module.exports = config => {
  config = withInfoPlist(config, config => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).VeetrSceneDelegate',
        }],
      },
    };
    return config;
  });
  return withAppDelegate(config, config => {
    if (config.modResults.language !== 'swift') throw new Error('Veetr scene plugin requires Swift');
    config.modResults.contents = patchAppDelegate(config.modResults.contents);
    return config;
  });
};
module.exports.patchAppDelegate = patchAppDelegate;
