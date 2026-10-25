package expo.modules.location

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject

/** Consent and samples share one SQLite transaction across both app processes. No positions. */
internal object VeetrTrackingQuality {
  private const val FILE = "veetr-tracking-quality.db"
  private fun <T> access(context: Context, create: Boolean = false, work: (SQLiteDatabase) -> T): T? {
    val file = context.getDatabasePath(FILE)
    if (!create && !file.exists()) return null
    file.parentFile?.mkdirs()
    return SQLiteDatabase.openOrCreateDatabase(file, null).use { db ->
      db.rawQuery("PRAGMA busy_timeout=5000", null).use { it.moveToFirst() }
      db.beginTransaction()
      try {
        db.execSQL("CREATE TABLE IF NOT EXISTS consent(id INTEGER PRIMARY KEY,enabled INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS samples(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER NOT NULL,body TEXT NOT NULL)")
        val result = work(db)
        db.setTransactionSuccessful()
        result
      } finally { db.endTransaction() }
    }
  }
  private fun enabled(db: SQLiteDatabase) = db.rawQuery("SELECT enabled FROM consent WHERE id=1", null).use { it.moveToFirst() && it.getInt(0) == 1 }
  fun setEnabled(context: Context, enabled: Boolean) {
    access(context, true) { db ->
      db.execSQL("INSERT OR REPLACE INTO consent VALUES(1,?)", arrayOf(if (enabled) 1 else 0))
      if (!enabled) db.execSQL("DELETE FROM samples")
    }
  }
  fun record(context: Context, build: () -> JSONObject) {
    try { access(context) { db ->
      if (enabled(db)) {
        val now = System.currentTimeMillis()
        db.execSQL("INSERT INTO samples(at,body) VALUES(?,?)", arrayOf(now, build().toString()))
        db.execSQL("DELETE FROM samples WHERE at<? OR id NOT IN (SELECT id FROM samples ORDER BY id DESC LIMIT 120)", arrayOf(now - 604800000))
      }
    } } catch (_: Exception) { } // Diagnostics can never stop recording.
  }
  fun snapshot(context: Context): List<Map<String, Any?>> = access(context) { db ->
    val rows = mutableListOf<Map<String, Any?>>()
    if (enabled(db)) {
      val now = System.currentTimeMillis()
      db.execSQL("DELETE FROM samples WHERE at<?", arrayOf(now - 604800000))
      db.rawQuery("SELECT at,body FROM samples ORDER BY id DESC LIMIT 32", null).use { c ->
        while (c.moveToNext()) {
          val row = JSONObject(c.getString(1))
          val map = row.keys().asSequence().associateWith { key -> if (row.isNull(key)) null else row.get(key) }.toMutableMap()
          map["ageSeconds"] = maxOf(0, (now - c.getLong(0)) / 1000)
          rows.add(map)
        }
      }
    }
    rows.reversed()
  } ?: emptyList()
}
