package expo.modules.location

import android.database.sqlite.SQLiteDatabase
import android.location.Location
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.RecordedRequest
import okhttp3.mockwebserver.Dispatcher

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
class VeetrRaceRecorderTest {
  private lateinit var service: VeetrRaceRecorderService
  private lateinit var dbFile: java.io.File
  private lateinit var db: SQLiteDatabase
  private lateinit var server: MockWebServer
  private val requests = mutableListOf<String>()
  private var active = false
  private var ready = true
  private var fail = false
  private var now = System.currentTimeMillis()
  private fun iso(t: Long) = VeetrRaceRecorderService.iso(t)
  private fun field(name: String, value: Any) { service.javaClass.getDeclaredField(name).apply { isAccessible = true }.set(service, value) }
  private fun call(name: String, arg: Any? = null) {
    val m = service.javaClass.declaredMethods.first { it.name == name }
    m.isAccessible = true
    if (arg == null) m.invoke(service) else m.invoke(service, arg)
  }
  private fun state() = db.rawQuery("SELECT body FROM tracking_state", null).use { it.moveToFirst(); JSONObject(it.getString(0)) }
  private fun setState(s: JSONObject) = db.execSQL("UPDATE tracking_state SET body=?", arrayOf(s.toString()))
  private fun count(table: String) = db.rawQuery("SELECT count(*) FROM $table", null).use { it.moveToFirst(); it.getInt(0) }
  private fun fix(at: Long, accuracy: Float = 3f) = Location("test").apply { time = at; latitude = 43.0; longitude = 15.0; this.accuracy = accuracy; speed = 2f; bearing = 150f }
  @Before fun setup() {
    now = System.currentTimeMillis()
    service = Robolectric.buildService(VeetrRaceRecorderService::class.java).get()
    dbFile = java.io.File.createTempFile("veetr-recorder", ".db")
    db = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
    db.execSQL("CREATE TABLE tracking_state(id INTEGER PRIMARY KEY,body TEXT)")
    db.execSQL("CREATE TABLE recording_sessions(id TEXT PRIMARY KEY,body TEXT)")
    db.execSQL("CREATE TABLE recording_history(session_id TEXT,recorded_at TEXT,body TEXT,PRIMARY KEY(session_id,recorded_at))")
    db.execSQL("CREATE TABLE tracking_outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT,body TEXT)")
    db.execSQL("INSERT INTO tracking_state VALUES(1,?)", arrayOf(JSONObject().put("id","race").put("phase","recording").put("startedAt",iso(now-3600000)).put("expiresAt",iso(now+3600000)).put("scheduledStart",iso(now+240000)).put("raceActive",false).toString()))
    server = MockWebServer()
    server.dispatcher = object : Dispatcher() {
      override fun dispatch(request: RecordedRequest): MockResponse {
        val name = request.path!!.substringAfterLast('/')
        val body = JSONObject(request.body.readUtf8())
        requests.add(name)
        val response = if (name == "race_phone_status") JSONObject().put("valid",true).put("eligible",true).put("active",active).put("ready",ready).put("endedAt",JSONObject.NULL).toString()
          else if (name == "ingest_race_phone_points") body.getJSONArray("p_points").length().toString() else "null"
        return MockResponse().setResponseCode(if (fail) 503 else 200).setBody(response)
      }
    }
    server.start()
    field("db",db)
    field("config",JSONObject().put("sessionId","race").put("linkId","link").put("secret","test-only").put("key","test-only").put("url","http://127.0.0.1:${server.port}"))
  }
  @After fun cleanup() { server.shutdown(); db.close(); dbFile.delete() }
  @Test fun backupStartsFiveMinutesBeforePlannedStartWithoutStartAcknowledgement() {
    setState(state().put("scheduledStart",iso(now+600000)))
    call("save",listOf(fix(now)))
    assertEquals(0,count("recording_history"))
    setState(state().put("scheduledStart",iso(now+240000)))
    call("save",listOf(fix(now)))
    assertEquals(1,count("recording_history"))
    call("sync")
    assertEquals(1,count("tracking_outbox"))
    assertFalse(requests.contains("ingest_race_phone_points"))
    active=true
    call("sync")
    assertEquals(0,count("tracking_outbox"))
    assertEquals(1,count("recording_history"))
    assertTrue(state().getBoolean("raceActive"))
  }
  @Test fun networkFailureNeverDeletesSavedGpsAndRetryAcknowledgesIt() {
    call("save",listOf(fix(now)))
    fail=true
    try { call("sync"); fail("Expected HTTP failure") } catch (_: java.lang.reflect.InvocationTargetException) { }
    assertEquals(1,count("recording_history")); assertEquals(1,count("tracking_outbox"))
    fail=false;active=true
    call("sync")
    assertEquals(0,count("tracking_outbox"));assertEquals(1,count("recording_history"))
  }
  @Test fun samplingDeduplicatesOverlappingStreamsButPreservesBackfill() {
    call("save",listOf(fix(now),fix(now-5000),fix(now-10000),fix(now-10000),fix(now-15000,150f)))
    call("save",listOf(fix(now),fix(now-5000)))
    assertEquals(3,count("recording_history"));assertEquals(3,count("tracking_outbox"))
  }
  @Test fun databaseReopenRecoversOutboxWithoutJavaScriptMemory() {
    call("save",listOf(fix(now)))
    db.close()
    db = SQLiteDatabase.openOrCreateDatabase(dbFile, null)
    field("db",db)
    assertEquals(1,count("recording_history"))
    active=true
    call("sync")
    assertEquals(0,count("tracking_outbox"))
    assertEquals(1,count("recording_history"))
  }
  @Test fun localStopAlwaysWinsOverLateGpsAndStatusResponse() {
    call("save",listOf(fix(now)))
    setState(state().put("phase","stopping").put("stoppedAt",iso(now)))
    call("save",listOf(fix(now+5000)))
    active=true
    call("sync")
    assertEquals("stopping",state().getString("phase"))
    assertEquals(1,count("recording_history"));assertEquals(0,count("tracking_outbox"))
    assertTrue(requests.contains("stop_race_phone"))
  }
  @Test fun refereeEndStopsRecordingAndDrainsBackup() {
    call("save",listOf(fix(now)))
    ready=false
    call("sync")
    assertEquals("stopping",state().getString("phase"))
    assertEquals(0,count("tracking_outbox"));assertEquals(1,count("recording_history"))
  }
}
