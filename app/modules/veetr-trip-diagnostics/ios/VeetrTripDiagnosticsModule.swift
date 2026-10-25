import ExpoModulesCore
import CoreMotion
import UIKit

public class VeetrTripDiagnosticsModule: Module {
  private let recorder = TripMotionRecorder()
  public func definition() -> ModuleDefinition {
    Name("VeetrTripDiagnostics")
    AsyncFunction("configure") { (enabled: Bool, session: String?, expires: Double, metadata: String) in
      self.recorder.stop()
      try TripDiagnosticStore.shared.configure(enabled,session,expires,metadata)
      if enabled, let session { self.recorder.start(session,expires:expires) }
    }
    AsyncFunction("append") { (session: String, records: String) in
      let rows = try JSONSerialization.jsonObject(with:Data(records.utf8)) as? [[String:Any]] ?? []
      try TripDiagnosticStore.shared.append(session,rows)
    }
    AsyncFunction("snapshot") { (session: String) -> [String:Any] in
      self.recorder.flush()
      return try TripDiagnosticStore.shared.snapshot(session)
    }
    AsyncFunction("read") { (session: String, after: Double, through: Double) -> [[String:Any]] in try TripDiagnosticStore.shared.read(session,after,through) }
    AsyncFunction("delete") { (session: String) in try TripDiagnosticStore.shared.delete(session) }
    OnDestroy { self.recorder.stop() }
  }
}

private final class TripMotionRecorder {
  private let manager = CMMotionManager()
  private let queue: OperationQueue = { let q = OperationQueue(); q.maxConcurrentOperationCount = 1; return q }()
  private let lock = NSRecursiveLock()
  private var session: String?
  private var expires: Double = 0
  private var pending: [[String:Any]] = []
  private var observers: [NSObjectProtocol] = []
  private var generation = 0
  private var last: [String:Double] = [:]
  func start(_ id: String, expires: Double) {
    lock.lock(); defer { lock.unlock() }
    session = id; self.expires = expires; generation += 1; last = [:]
    let version = generation
    manager.accelerometerUpdateInterval = 0.2; manager.gyroUpdateInterval = 0.2; manager.deviceMotionUpdateInterval = 0.2
    record(["type":"event","event":"sensors_started","atMs":Date().timeIntervalSince1970*1000,"requestedHz":5,
      "available":["accelerometer":manager.isAccelerometerAvailable,"gyroscope":manager.isGyroAvailable,"deviceMotion":manager.isDeviceMotionAvailable],
      "units":["acceleration":"m/s²","gyroscope":"rad/s","attitude":"quaternion","referenceFrame":"xArbitraryZVertical"]],version)
    if manager.isAccelerometerAvailable { manager.startAccelerometerUpdates(to:queue) { [weak self] data,error in
      if let d = data { self?.sample("accelerometer", d.timestamp, ["values":[d.acceleration.x*9.80665,d.acceleration.y*9.80665,d.acceleration.z*9.80665]], version) }
      else if error != nil { self?.unavailable("accelerometer",version) }
    } }
    if manager.isGyroAvailable { manager.startGyroUpdates(to:queue) { [weak self] data,error in
      if let d = data { self?.sample("gyroscope", d.timestamp, ["values":[d.rotationRate.x,d.rotationRate.y,d.rotationRate.z]], version) }
      else if error != nil { self?.unavailable("gyroscope",version) }
    } }
    if manager.isDeviceMotionAvailable { manager.startDeviceMotionUpdates(using:.xArbitraryZVertical,to:queue) { [weak self] data,error in
      if let d = data {
        let q = d.attitude.quaternion
        self?.sample("deviceMotion",d.timestamp,["linearAcceleration":[d.userAcceleration.x*9.80665,d.userAcceleration.y*9.80665,d.userAcceleration.z*9.80665],
          "gravity":[d.gravity.x*9.80665,d.gravity.y*9.80665,d.gravity.z*9.80665],"rotationRate":[d.rotationRate.x,d.rotationRate.y,d.rotationRate.z],
          "quaternion":[q.x,q.y,q.z,q.w],"magneticAccuracy":d.magneticField.accuracy.rawValue],version)
      } else if error != nil { self?.unavailable("deviceMotion",version) }
    } }
    for (name,label) in [(UIApplication.didEnterBackgroundNotification,"background"),(UIApplication.didBecomeActiveNotification,"active"),(UIApplication.willResignActiveNotification,"inactive")] {
      observers.append(NotificationCenter.default.addObserver(forName:name,object:nil,queue:nil) { [weak self] _ in
        self?.record(["type":"event","event":"app_state","state":label,"atMs":Date().timeIntervalSince1970*1000,"monotonicMs":ProcessInfo.processInfo.systemUptime*1000],version); self?.flush()
      })
    }
    flush()
  }
  private func unavailable(_ sensor: String, _ version: Int) { record(["type":"event","event":"sensor_unavailable","sensor":sensor,"atMs":Date().timeIntervalSince1970*1000],version) }
  private func sample(_ sensor: String, _ uptime: Double, _ values: [String:Any], _ version: Int) {
    lock.lock(); defer { lock.unlock() }
    guard version == generation else { return }
    let now = Date().timeIntervalSince1970*1000
    if let previous = last[sensor], uptime - previous > 1 {
      record(["type":"event","event":"sensor_gap","sensor":sensor,"durationMs":(uptime-previous)*1000,"atMs":now],version)
    }
    last[sensor] = uptime
    var row = values
    row["type"] = "sensor"; row["sensor"] = sensor; row["monotonicMs"] = uptime*1000
    row["atMs"] = now - (ProcessInfo.processInfo.systemUptime-uptime)*1000; row["receivedAtMs"] = now
    record(row,version)
    flush()
  }
  private func record(_ row: [String:Any], _ version: Int) {
    lock.lock(); defer { lock.unlock() }
    guard session != nil, version == generation else { return }
    if Date().timeIntervalSince1970*1000 >= expires { stop(); return }
    pending.append(row)
    if pending.count >= 15 { flush() }
  }
  func flush() {
    lock.lock(); defer { lock.unlock() }
    guard let session, !pending.isEmpty else { return }
    do { try TripDiagnosticStore.shared.append(session,pending); pending = [] }
    catch { pending = [["type":"event","event":"sensor_write_failed","atMs":Date().timeIntervalSince1970*1000]] }
  }
  func stop() {
    lock.lock(); defer { lock.unlock() }
    manager.stopAccelerometerUpdates(); manager.stopGyroUpdates(); manager.stopDeviceMotionUpdates()
    for observer in observers { NotificationCenter.default.removeObserver(observer) }; observers = []
    if session != nil { pending.append(["type":"event","event":"sensors_stopped","atMs":Date().timeIntervalSince1970*1000]); flush() }
    session = nil; generation += 1
  }
}
