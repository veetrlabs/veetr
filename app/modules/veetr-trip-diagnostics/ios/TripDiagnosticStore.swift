import Foundation
import SQLite3

final class TripDiagnosticStore {
  static let shared = TripDiagnosticStore()
  private let lock = NSRecursiveLock()
  private var db: OpaquePointer?
  private let directory: URL
  init(directory: URL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]) { self.directory = directory }
  deinit { sqlite3_close(db) }
  private let limit = 256 * 1024 * 1024
  private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
  private func access<T>(_ work: () throws -> T) throws -> T {
    lock.lock(); defer { lock.unlock() }
    if db == nil {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      guard sqlite3_open(directory.appendingPathComponent("veetr-trip-diagnostics.db").path, &db) == SQLITE_OK else { throw failure() }
      sqlite3_busy_timeout(db, 5000)
      try execute("CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY,enabled INTEGER NOT NULL,session TEXT,expires REAL)")
      try execute("CREATE TABLE IF NOT EXISTS trips(id TEXT PRIMARY KEY,bytes INTEGER NOT NULL DEFAULT 0,dropped INTEGER NOT NULL DEFAULT 0)")
      try execute("CREATE TABLE IF NOT EXISTS entries(seq INTEGER PRIMARY KEY AUTOINCREMENT,session TEXT NOT NULL,body TEXT NOT NULL)")
      try execute("CREATE INDEX IF NOT EXISTS entries_session ON entries(session,seq)")
    }
    try execute("BEGIN IMMEDIATE")
    do { let result = try work(); try execute("COMMIT"); return result }
    catch { try? execute("ROLLBACK"); throw error }
  }
  private func failure() -> NSError { NSError(domain:"VeetrTripDiagnostics",code:1,userInfo:[NSLocalizedDescriptionKey:"Could not access local trip diagnostics."]) }
  private func statement(_ sql: String, _ args: [Any?] = []) throws -> OpaquePointer {
    var s: OpaquePointer?
    guard sqlite3_prepare_v2(db,sql,-1,&s,nil) == SQLITE_OK, let s else { throw failure() }
    for (i,arg) in args.enumerated() {
      if let value = arg as? String { sqlite3_bind_text(s,Int32(i+1),value,-1,transient) }
      else if let value = arg as? NSNumber { sqlite3_bind_double(s,Int32(i+1),value.doubleValue) }
      else { sqlite3_bind_null(s,Int32(i+1)) }
    }
    return s
  }
  private func execute(_ sql: String, _ args: [Any?] = []) throws {
    let s = try statement(sql,args); defer { sqlite3_finalize(s) }
    guard sqlite3_step(s) == SQLITE_DONE else { throw failure() }
  }
  private func activeLocked() throws -> String? {
    let s = try statement("SELECT session FROM state WHERE id=1 AND enabled=1 AND expires>?",[Date().timeIntervalSince1970*1000]); defer { sqlite3_finalize(s) }
    guard sqlite3_step(s) == SQLITE_ROW, let value = sqlite3_column_text(s,0) else { return nil }
    return String(cString:value)
  }
  func active() throws -> String? { try access { try activeLocked() } }
  func configure(_ enabled: Bool, _ session: String?, _ expires: Double, _ metadata: String) throws {
    try access {
      let previous = try activeLocked()
      try execute("INSERT OR REPLACE INTO state VALUES(1,?,?,?)",[enabled ? 1 : 0,session,expires])
      if !enabled { try execute("DELETE FROM entries"); try execute("DELETE FROM trips") }
      else {
        if let previous, previous != session { try insert(previous,["type":"event","event":"capture_stopped","atMs":Date().timeIntervalSince1970*1000]) }
        if let session, previous != session {
          var record = (try JSONSerialization.jsonObject(with:Data(metadata.utf8))) as? [String:Any] ?? [:]
          record["type"] = "metadata"; record["atMs"] = Date().timeIntervalSince1970*1000
          try insert(session,record)
        }
      }
    }
  }
  private func insert(_ session: String, _ row: [String:Any]) throws {
    let data = try JSONSerialization.data(withJSONObject:row,options:[.sortedKeys])
    try execute("INSERT OR IGNORE INTO trips(id) VALUES(?)",[session])
    let s = try statement("SELECT bytes FROM trips WHERE id=?",[session]); defer { sqlite3_finalize(s) }
    guard sqlite3_step(s) == SQLITE_ROW else { throw failure() }
    if sqlite3_column_int64(s,0) + Int64(data.count) > limit { try execute("UPDATE trips SET dropped=dropped+1 WHERE id=?",[session]); return }
    try execute("INSERT INTO entries(session,body) VALUES(?,?)",[session,String(decoding:data,as:UTF8.self)])
    try execute("UPDATE trips SET bytes=bytes+? WHERE id=?",[data.count,session])
  }
  func append(_ session: String, _ records: [[String:Any]]) throws {
    try access { if try activeLocked() == session { for record in records { try insert(session,record) } } }
  }
  func snapshot(_ session: String) throws -> [String:Any] {
    try access {
      let s = try statement("SELECT bytes,dropped FROM trips WHERE id=?",[session]); defer { sqlite3_finalize(s) }
      let exists = sqlite3_step(s) == SQLITE_ROW
      let bytes = exists ? sqlite3_column_int64(s,0) : 0, dropped = exists ? sqlite3_column_int64(s,1) : 0
      let end = try statement("SELECT COALESCE(MAX(seq),0) FROM entries WHERE session=?",[session]); defer { sqlite3_finalize(end) }
      sqlite3_step(end)
      return ["bytes":bytes,"dropped":dropped,"through":sqlite3_column_int64(end,0),"limitBytes":limit]
    }
  }
  func read(_ session: String, _ after: Double, _ through: Double) throws -> [[String:Any]] {
    try access {
      let s = try statement("SELECT seq,body FROM entries WHERE session=? AND seq>? AND seq<=? ORDER BY seq LIMIT 200",[session,after,through]); defer { sqlite3_finalize(s) }
      var rows: [[String:Any]] = []
      while sqlite3_step(s) == SQLITE_ROW { rows.append(["seq":sqlite3_column_int64(s,0),"body":String(cString:sqlite3_column_text(s,1))]) }
      return rows
    }
  }
  func delete(_ session: String) throws {
    try access {
      try execute("UPDATE state SET session=NULL WHERE session=?",[session])
      try execute("DELETE FROM entries WHERE session=?",[session]); try execute("DELETE FROM trips WHERE id=?",[session])
    }
  }
}
