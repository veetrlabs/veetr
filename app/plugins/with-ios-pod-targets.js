const { withPodfile } = require('@expo/config-plugins');

// Xcode 27 rejects old deployment targets even on dependency resource bundles.
// Match the app's Expo SDK 54 minimum without lowering newer pod requirements.
const marker = '# Veetr: align dependency deployment targets';
function patchPodfile(contents) {
  if (contents.includes(marker)) return contents;
  const anchor = 'post_install do |installer|';
  if (!contents.includes(anchor)) throw new Error('Cannot locate the CocoaPods post_install hook');
  return contents.replace(anchor, `${anchor}
    ${marker}
    minimum = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '15.1')
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && Gem::Version.new(current) < minimum
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum.to_s
        end
      end
    end`);
}
module.exports = config => withPodfile(config, config => {
  config.modResults.contents = patchPodfile(config.modResults.contents);
  return config;
});
module.exports.patchPodfile = patchPodfile;
