import ExpoModulesCore
import AlarmKit
import ActivityKit
import SwiftUI

private func alarmError(_ message: String) -> NSError {
  NSError(domain: "VeetrAnchorAlarm", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
}

public class VeetrAnchorAlarmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VeetrAnchorAlarm")
    AsyncFunction("prepare") { () async throws in
      guard #available(iOS 26.0, *) else { throw alarmError("Loud anchor alarms require iOS 26 or newer.") }
      try await AnchorAlarms.prepare()
    }
    AsyncFunction("check") { () async throws in
      guard #available(iOS 26.0, *) else { throw alarmError("Loud anchor alarms require iOS 26 or newer.") }
      try await AnchorAlarms.check()
    }
    AsyncFunction("trigger") { (title: String, sound: String, test: Bool) async throws in
      guard #available(iOS 26.0, *) else { throw alarmError("Loud anchor alarms require iOS 26 or newer.") }
      try await AnchorAlarms.trigger(title: title, sound: sound, test: test)
    }
    AsyncFunction("watchdog") { (title: String, sound: String, deadline: Double) async throws in
      guard #available(iOS 26.0, *) else { throw alarmError("Loud anchor alarms require iOS 26 or newer.") }
      try await AnchorAlarms.watchdog(title: title, sound: sound, deadline: deadline)
    }
    AsyncFunction("stop") { () async throws in
      if #available(iOS 26.0, *) { try await AnchorAlarms.stop(testOnly: false) }
    }
    AsyncFunction("stopTest") { () async throws in
      if #available(iOS 26.0, *) { try await AnchorAlarms.stop(testOnly: true) }
    }
    AsyncFunction("openSettings") { () async in
      await MainActor.run {
        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
      }
    }
  }
}

@available(iOS 26.0, *)
private struct AnchorMetadata: AlarmMetadata {}

@available(iOS 26.0, *)
@MainActor
private enum AnchorAlarms {
  static let drag = UUID(uuidString: "42674400-8F14-438A-BE80-000000000001")!
  static let test = UUID(uuidString: "42674400-8F14-438A-BE80-000000000002")!
  static let watches = [UUID(uuidString: "42674400-8F14-438A-BE80-000000000003")!, UUID(uuidString: "42674400-8F14-438A-BE80-000000000004")!]
  static let manager = AlarmManager.shared
  static let firedKey = "veetr.anchor.native.fired"

  static func check() throws {
    guard manager.authorizationState == .authorized else {
      throw alarmError("Allow Alarms for Veetr in iPhone Settings before starting.")
    }
  }
  static func prepare() async throws {
    if manager.authorizationState == .notDetermined { _ = try await manager.requestAuthorization() }
    try check()
  }
  static func schedule(id: UUID, title: String, sound: String, at date: Date) async throws {
    try check()
    let alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title),
      stopButton: AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.fill"))
    let attributes = AlarmAttributes(presentation: AlarmPresentation(alert: alert), metadata: AnchorMetadata(), tintColor: Color(red: 0, green: 0.42, blue: 0.38))
    let configuration = AlarmManager.AlarmConfiguration.alarm(schedule: .fixed(date), attributes: attributes,
      sound: sound == "siren" ? .named("veetr_anchor_siren.wav") : .default)
    _ = try await manager.schedule(id: id, configuration: configuration)
  }
  static func cancel(_ ids: [UUID]) throws {
    for alarm in try manager.alarms where ids.contains(alarm.id) { try manager.cancel(id: alarm.id) }
  }
  static func trigger(title: String, sound: String, test isTest: Bool) async throws {
    try check()
    if isTest {
      try cancel([test])
      // A few seconds to lock the phone and test the real system alarm.
      try await schedule(id: test, title: title, sound: sound, at: Date().addingTimeInterval(5))
    } else {
      // Never restart an already ringing or explicitly dismissed alarm on every GPS fix.
      if UserDefaults.standard.bool(forKey: firedKey) { return }
      if !(try manager.alarms).contains(where: { $0.id == drag }) {
        try await schedule(id: drag, title: title, sound: sound, at: Date().addingTimeInterval(1))
      }
      UserDefaults.standard.set(true, forKey: firedKey)
      try cancel(watches)
    }
  }
  static func watchdog(title: String, sound: String, deadline: Double) async throws {
    try check()
    if UserDefaults.standard.bool(forKey: firedKey) { return }
    let existing = try manager.alarms.filter { watches.contains($0.id) }
    // Preserve a GPS-loss alarm that is already sounding until the user dismisses it.
    if existing.contains(where: { $0.state == .alerting }) { return }
    let next = existing.first?.id == watches[0] ? watches[1] : watches[0]
    try cancel([next])
    try await schedule(id: next, title: title, sound: sound, at: Date(timeIntervalSince1970: max(deadline / 1000, Date().timeIntervalSince1970 + 1)))
    // Keep the previous system alarm in place until its replacement is scheduled.
    try cancel(watches.filter { $0 != next })
  }
  static func stop(testOnly: Bool) throws {
    try cancel(testOnly ? [test] : [drag] + watches + [test])
    if !testOnly { UserDefaults.standard.removeObject(forKey: firedKey) }
  }
}
