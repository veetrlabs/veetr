package org.veetr.diagnostics

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject

/** Shared by the UI and recorder processes. Consent is checked inside each write transaction. */
object TripDiagnosticStore {
  private const val MAX_BYTES = 256L * 1024 * 1024
  private fun <T> access(c: Context, work: (SQLiteDatabase) -> T): T {
    val file = c.getDatabasePath("veetr-trip-diagnostics.db")
    file.parentFile?.mkdirs()
    return SQLiteDatabase.openOrCreateDatabase(file, null).use { db ->
      db.rawQuery("PRAGMA busy_timeout=5000", null).use { it.moveToFirst() }
      db.execSQL("CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY,enabled INTEGER NOT NULL,session TEXT,expires REAL)")
      db.execSQL("CREATE TABLE IF NOT EXISTS trips(id TEXT PRIMARY KEY,bytes INTEGER NOT NULL DEFAULT 0,dropped INTEGER NOT NULL DEFAULT 0)")
      db.execSQL("CREATE TABLE IF NOT EXISTS entries(seq INTEGER PRIMARY KEY AUTOINCREMENT,session TEXT NOT NULL,body TEXT NOT NULL)")
      db.execSQL("CREATE INDEX IF NOT EXISTS entries_session ON entries(session,seq)")
      db.beginTransaction()
      try { val result = work(db); db.setTransactionSuccessful(); result } finally { db.endTransaction() }
    }
  }
  private fun active(db: SQLiteDatabase): String? = db.rawQuery("SELECT session FROM state WHERE id=1 AND enabled=1 AND expires>?", arrayOf(System.currentTimeMillis().toString())).use { if (it.moveToFirst()) it.getString(0) else null }
  fun active(c: Context): String? = access(c) { active(it) }
  fun configure(c: Context, enabled: Boolean, session: String?, expires: Double, metadata: String) = access(c) { db ->
    val previous = active(db)
    db.execSQL("INSERT OR REPLACE INTO state VALUES(1,?,?,?)", arrayOf(if(enabled) 1 else 0, session, expires))
    if (!enabled) { db.execSQL("DELETE FROM entries"); db.execSQL("DELETE FROM trips") }
    else {
      if (previous != null && previous != session) insert(db, previous, JSONObject().put("type","event").put("event","capture_stopped").put("atMs",System.currentTimeMillis()))
      if (session != null && previous != session) {
        insert(db, session, JSONObject(metadata).put("type","metadata").put("atMs",System.currentTimeMillis()))
      }
    }
  }
  private fun insert(db: SQLiteDatabase, id: String, record: JSONObject) {
    db.execSQL("INSERT OR IGNORE INTO trips(id) VALUES(?)", arrayOf(id))
    val used = db.rawQuery("SELECT bytes FROM trips WHERE id=?", arrayOf(id)).use { it.moveToFirst(); it.getLong(0) }
    val body = record.toString(); val bytes = body.toByteArray(Charsets.UTF_8).size
    if (used + bytes > MAX_BYTES) { db.execSQL("UPDATE trips SET dropped=dropped+1 WHERE id=?", arrayOf(id)); return }
    db.execSQL("INSERT INTO entries(session,body) VALUES(?,?)", arrayOf(id,body))
    db.execSQL("UPDATE trips SET bytes=bytes+? WHERE id=?", arrayOf(bytes,id))
  }
  fun append(c: Context, id: String, records: JSONArray) = access(c) { db ->
    if (active(db) == id) for(i in 0 until records.length()) insert(db,id,records.getJSONObject(i))
  }
  fun finish(c: Context, id: String) = access(c) { db ->
    if (active(db) == id) {
      insert(db,id,JSONObject().put("type","event").put("event","capture_stopped").put("atMs",System.currentTimeMillis()))
      db.execSQL("UPDATE state SET session=NULL WHERE session=?",arrayOf(id))
    }
  }
  fun snapshot(c: Context, id: String): Map<String, Any> = access(c) { db ->
    val stats = db.rawQuery("SELECT bytes,dropped FROM trips WHERE id=?", arrayOf(id)).use { if(it.moveToFirst()) listOf(it.getLong(0),it.getLong(1)) else listOf(0L,0L) }
    val end = db.rawQuery("SELECT COALESCE(MAX(seq),0) FROM entries WHERE session=?", arrayOf(id)).use { it.moveToFirst();it.getLong(0) }
    mapOf("bytes" to stats[0], "dropped" to stats[1], "through" to end, "limitBytes" to MAX_BYTES)
  }
  fun read(c: Context, id: String, after: Long, through: Long): List<Map<String, Any>> = access(c) { db ->
    val rows = mutableListOf<Map<String,Any>>()
    db.rawQuery("SELECT seq,body FROM entries WHERE session=? AND seq>? AND seq<=? ORDER BY seq LIMIT 200", arrayOf(id,after.toString(),through.toString())).use {
      while(it.moveToNext()) rows.add(mapOf("seq" to it.getLong(0), "body" to it.getString(1)))
    }; rows
  }
  fun delete(c: Context, id: String) = access(c) { db ->
    db.execSQL("UPDATE state SET session=NULL WHERE session=?", arrayOf(id))
    db.execSQL("DELETE FROM entries WHERE session=?",arrayOf(id)); db.execSQL("DELETE FROM trips WHERE id=?",arrayOf(id))
  }
}
