Pod::Spec.new do |s|
  s.name = 'VeetrAnchorAlarm'
  s.version = '1.0.0'
  s.summary = 'Native anchor alarms for Veetr'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Veetr'
  s.homepage = 'https://veetr.org'
  s.source = { :git => 'https://github.com/veetrlabs/veetr.git' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.resources = 'Sounds/*.wav'
  s.weak_frameworks = 'AlarmKit'
end
