package expo.modules.location

import android.app.*
import android.content.*
import android.database.sqlite.SQLiteDatabase
import android.location.Location
import android.hardware.*
import android.os.*
import com.google.android.gms.location.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

/** Race GPS and network work deliberately live outside the React Native process. */
class VeetrRaceRecorderService : Service() {
  private lateinit var worker: HandlerThread
  private lateinit var handler: Handler
  private var db: SQLiteDatabase? = null
  private var config: JSONObject? = null
  private var subscribed = false
  private val motion = VeetrMotionQuality()
  private val speedQuality = VeetrPhoneSpeedQuality()
  private var motionRegistered = false
  private val sensors by lazy { getSystemService(SENSOR_SERVICE) as SensorManager }
  private val motionListener = object : SensorEventListener {
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) { motion.reset() }
    override fun onSensorChanged(event: SensorEvent) {
      if (event.accuracy == SensorManager.SENSOR_STATUS_UNRELIABLE) { motion.reset(); return }
      motion.add(event.timestamp / 1_000_000, event.values[0].toDouble(), event.values[1].toDouble(), event.values[2].toDouble())
    }
  }
  private fun startMotion() {
    if (motionRegistered) return
    try {
      val sensor = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return
      motionRegistered = sensors.registerListener(motionListener, sensor, 200_000, handler)
    } catch (_: Exception) { motion.reset() } // Sensors must never prevent GPS recording.
  }
  private fun stopMotion() {
    try { if (motionRegistered) sensors.unregisterListener(motionListener) } catch (_: Exception) { }
    motionRegistered = false
    motion.reset()
    speedQuality.reset()
  }
  private var lastFix = 0L
  private var lastRequest = 0L
  private val network = java.util.concurrent.Executors.newSingleThreadExecutor()
  private var checking = false
  private var lastCheck = 0L
  private val client by lazy { LocationServices.getFusedLocationProviderClient(this) }
  private val callback = object : LocationCallback() {
    override fun onLocationResult(result: LocationResult) {
      lastFix = System.currentTimeMillis()
      guarded { save(result.locations) }
    }
  }
  override fun onBind(intent: Intent?) = null
  override fun onCreate() {
    super.onCreate()
    worker = HandlerThread("veetr-race-recorder").also { it.start() }
    handler = Handler(worker.looper)
    val nm = getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(NotificationChannel(CHANNEL, "Veetr race recording", NotificationManager.IMPORTANCE_LOW))
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val notification = Notification.Builder(this, CHANNEL)
      .setSmallIcon(applicationInfo.icon).setContentTitle("Veetr race recording")
      .setContentText("Saving GPS locally and checking race instructions. Open Veetr to stop.")
      .setOngoing(true).apply {
        if (launch != null) setContentIntent(PendingIntent.getActivity(this@VeetrRaceRecorderService, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
      }.build()
    startForeground(482001, notification)
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    handler.post {
      guarded {
        val file = File(filesDir, CONFIG)
        if (!file.exists()) { stopSelf(); return@guarded }
        val incoming = JSONObject(file.readText())
        if (config?.optString("sessionId") != incoming.getString("sessionId")) {
          if (checking) { handler.postDelayed({ onStartCommand(null, 0, 0) }, 1000); return@guarded }
          client.removeLocationUpdates(callback)
          stopMotion()
          subscribed = false; lastFix = 0; lastCheck = 0
          db?.close()
          config = incoming
          val path = config!!.getString("databasePath")
          require(File(path).canonicalPath.startsWith(filesDir.canonicalPath + "/"))
          db = SQLiteDatabase.openDatabase(path, null, SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING)
          db!!.rawQuery("PRAGMA busy_timeout=5000", null).use { it.moveToFirst() }
        }
        tick()
        if (subscribed) patch { it.put("nativeRecorderStartedAt", stamp()) }
      }
    }
    return START_STICKY
  }
  private val heartbeat = Runnable { guarded { tick() } }
  private fun tick() {
    handler.removeCallbacks(heartbeat)
    val s = session()
    if (s == null || s.optString("id") != config!!.getString("sessionId")) { stopSelf(); return }
    if (s.optString("phase") == "recording" && System.currentTimeMillis() >= time(s.optString("expiresAt"))) {
      patch { it.put("phase", "stopping").put("stoppedAt", stamp()).put("stopReason", "expired") }
    }
    patch { it.put("nativeRecorderHeartbeatAt", stamp()) }
    val recording = session()?.optString("phase") == "recording"
    if (!recording) try { TripDiagnosticStore.finish(this,s.getString("id")) } catch (_:Exception) { }
    if (recording) startMotion() else stopMotion()
    if (recording && (!subscribed || System.currentTimeMillis() - maxOf(lastFix, lastRequest) > 90_000)) requestGPS()
    if (!recording && subscribed) { client.removeLocationUpdates(callback); subscribed = false }
    // Coalesce UI wakeups: opening a screen must not multiply network requests.
    if (!checking && System.currentTimeMillis() - lastCheck >= 55_000) {
      checking = true
      lastCheck = System.currentTimeMillis()
      val power = getSystemService(POWER_SERVICE) as PowerManager
      val lock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Veetr:race-sync")
      lock.acquire(90_000)
      network.execute {
        try { sync() } catch (_: Exception) {
          try { patch { it.put("nativeRecorderError", "network").put("nativeRecorderErrorAt", stamp()) } } catch (_: Exception) { }
        } finally { handler.post { checking = false }; if (lock.isHeld) lock.release() }
      }
    }
    if (session()?.optString("phase") == "stopping" && pending() == 0L) { stopSelf(); return }
    handler.postDelayed(heartbeat, 60_000)
  }
  @Suppress("MissingPermission")
  private fun requestGPS() {
    if (subscribed) client.removeLocationUpdates(callback)
    subscribed = false
    lastRequest = System.currentTimeMillis()
    val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000)
      .setMinUpdateIntervalMillis(1000).setMaxUpdateDelayMillis(10000).build()
    client.requestLocationUpdates(request, callback, worker.looper)
      .addOnSuccessListener { handler.post { guarded {
        subscribed = true
        patch { it.put("nativeRecorderStartedAt", stamp()).put("gpsRecoveryCount", it.optInt("gpsRecoveryCount") + if (lastFix > 0) 1 else 0) }
      } } }
      .addOnFailureListener { handler.post { guarded { subscribed = false; patch { it.put("nativeRecorderError", "gps_start").put("nativeRecorderErrorAt", stamp()) } } } }
  }
  private fun save(locations: List<Location>) = transaction {
    val s = session() ?: return@transaction
    if (s.optString("phase") != "recording") return@transaction
    val now = System.currentTimeMillis()
    val expiry = time(s.optString("expiresAt"))
    val planned = time(s.optString("scheduledStart"))
    val start = time(s.optString("startedAt"))
    val fallback = planned > 0 && now >= planned - 300_000
    s.put("lastLocationCallbackAt", stamp()).put("lastBackgroundFixAt", stamp()).put("lastTaskCallbackAt", stamp())
      .put("nativeFixCount", s.optLong("nativeFixCount") + locations.size).put("lastLocationBatchSize", locations.size)
    if (!(getSystemService(POWER_SERVICE) as PowerManager).isInteractive)
      s.put("nativeFixScreenOffCount", s.optLong("nativeFixScreenOffCount") + locations.size)
    if (now >= expiry || (!s.optBoolean("raceActive") && !fallback)) { write(s); return@transaction }
    var saved = 0
    for (l in locations.sortedBy { it.time }) {
      if (l.time < start || l.time >= expiry || l.time > now + 30_000 ||
          (!s.optBoolean("raceActive") && l.time < planned - 300_000) ||
          !l.hasAccuracy() || !l.accuracy.isFinite() || l.accuracy < 0 || l.accuracy > 100 || !l.latitude.isFinite() || !l.longitude.isFinite() || kotlin.math.abs(l.latitude) > 90 || kotlin.math.abs(l.longitude) > 180) {
        recordQuality(l, null, "rejected_fix")
        continue
      }
      val at = iso(l.time)
      val nearby = db!!.rawQuery("SELECT 1 FROM recording_history WHERE session_id=? AND recorded_at>? AND recorded_at<? LIMIT 1", arrayOf(s.getString("id"), iso(l.time - 900), iso(l.time + 900))).use { it.moveToFirst() }
      if (nearby) { recordQuality(l, null, "duplicate_fix"); continue }
      // Location and SensorEvent share Android's monotonic clock, including batched fixes.
      val rawSpeed = if (l.hasSpeed() && l.speed.isFinite() && l.speed >= 0) l.speed.toDouble() else null
      val reliableSpeed = if (Build.VERSION.SDK_INT >= 26 && l.hasSpeedAccuracy() &&
        (!l.speedAccuracyMetersPerSecond.isFinite() || l.speedAccuracyMetersPerSecond < 0 ||
          l.speedAccuracyMetersPerSecond > maxOf(1.0, (rawSpeed ?: 0.0) * 0.5))) null else rawSpeed
      val speed = speedQuality.speed(l.time, l.latitude, l.longitude, l.accuracy.toDouble(), reliableSpeed,
        motion.quiet(l.elapsedRealtimeNanos / 1_000_000))
      val p = JSONObject().put("recordedAt", at).put("latitude", l.latitude).put("longitude", l.longitude)
        .put("accuracyM", l.accuracy.toDouble()).put("sogMps", speed ?: JSONObject.NULL)
        .put("cogDeg", if (speed != null && speed >= 0.5 && l.hasBearing() && l.bearing.isFinite() && l.bearing >= 0 && l.bearing < 360) l.bearing.toDouble() else JSONObject.NULL).put("source", "phone")
      recordQuality(l, speed, when {
        reliableSpeed == null && rawSpeed != null -> "speed_uncertainty"
        speed == 0.0 && (rawSpeed ?: 0.0) > 0 -> "low_speed_noise"
        speed == null && l.accuracy > 25 -> "poor_accuracy"
        speed == null -> "speed_unavailable"
        else -> "accepted"
      })
      db!!.execSQL("INSERT OR IGNORE INTO recording_history(session_id,recorded_at,body) VALUES(?,?,?)", arrayOf(s.getString("id"), at, p.toString()))
      db!!.execSQL("INSERT INTO tracking_outbox(session_id,body) VALUES(?,?)", arrayOf(s.getString("id"), p.toString()))
      if (at > s.optString("lastRecordedAt")) s.put("lastRecordedAt", at)
      val recent = s.optJSONArray("recentPoints") ?: JSONArray()
      recent.put(p)
      val trimmed = JSONArray()
      for (i in maxOf(0, recent.length() - 120) until recent.length()) trimmed.put(recent.get(i))
      s.put("recentPoints", trimmed)
      saved++
    }
    s.put("lastLocationCallbackAt", stamp()).put("lastBackgroundFixAt", stamp()).put("lastTaskCallbackAt", stamp())
      .put("nativeSavedCount", s.optLong("nativeSavedCount") + saved).put("nativeRecorderHeartbeatAt", stamp())
    locations.lastOrNull()?.let { s.put("lastReportedAccuracyM", it.accuracy.toDouble()).put("lastLocationDeliveryDelayMs", maxOf(0, now - it.time)) }
    write(s)
  }
  private fun recordQuality(l: Location, speed: Double?, reason: String) {
    try {
      val id = config?.optString("sessionId")
      if (id != null && TripDiagnosticStore.active(this) == id) {
        fun finite(value: Double?): Any = if(value != null && value.isFinite()) value else JSONObject.NULL
        val raw = JSONObject().put("latitude",finite(l.latitude)).put("longitude",finite(l.longitude))
          .put("accuracy",finite(if(l.hasAccuracy()) l.accuracy.toDouble() else null))
          .put("altitude",finite(if(l.hasAltitude()) l.altitude else null))
          .put("speed",finite(if(l.hasSpeed()) l.speed.toDouble() else null))
          .put("heading",finite(if(l.hasBearing()) l.bearing.toDouble() else null))
          .put("speedAccuracy",finite(if(Build.VERSION.SDK_INT>=26 && l.hasSpeedAccuracy()) l.speedAccuracyMetersPerSecond.toDouble() else null))
          .put("headingAccuracy",finite(if(Build.VERSION.SDK_INT>=26 && l.hasBearingAccuracy()) l.bearingAccuracyDegrees.toDouble() else null))
          .put("altitudeAccuracy",finite(if(Build.VERSION.SDK_INT>=26 && l.hasVerticalAccuracy()) l.verticalAccuracyMeters.toDouble() else null))
        TripDiagnosticStore.append(this,id,JSONArray().put(JSONObject().put("type","gps").put("via","native_race")
          .put("atMs",l.time).put("receivedAtMs",System.currentTimeMillis()).put("monotonicMs",l.elapsedRealtimeNanos/1000000)
          .put("raw",raw).put("filteredSpeedMps",finite(speed)).put("estimated",false).put("confidence",JSONObject.NULL)
          .put("filteredCourseDeg",finite(if(speed != null && speed >= 0.5 && l.hasBearing()) l.bearing.toDouble() else null))
          .put("reason",reason).put("filterVersion","android-phone-speed-v1").put("motion",motion.state(l.elapsedRealtimeNanos/1000000))))
      }
    } catch (_:Exception) { }

    VeetrTrackingQuality.record(this) {
      fun bounded(value: Double?, max: Double): Any = if (value != null && value.isFinite() && value >= 0) minOf(value, max) else JSONObject.NULL
      JSONObject().put("version", 1).put("rawSpeedMps", bounded(if (l.hasSpeed()) l.speed.toDouble() else null, 1000.0))
        .put("speedMps", bounded(speed, 1000.0))
        .put("rawCourseDeg", bounded(if (l.hasBearing()) l.bearing.toDouble() else null, 360.0))
        .put("courseDeg", bounded(if (speed != null && speed >= 0.5 && l.hasBearing()) l.bearing.toDouble() else null, 360.0))
        .put("accuracyM", bounded(if (l.hasAccuracy()) l.accuracy.toDouble() else null, 100000.0))
        .put("speedAccuracyMps", bounded(if (Build.VERSION.SDK_INT >= 26 && l.hasSpeedAccuracy()) l.speedAccuracyMetersPerSecond.toDouble() else null, 1000.0))
        .put("deliveryDelayMs", bounded((System.currentTimeMillis() - l.time).toDouble(), 10000000.0))
        .put("motion", motion.state(l.elapsedRealtimeNanos / 1_000_000)).put("reason", reason)
    }
  }
  private fun sync() {
    var s = session() ?: return
    val info = JSONObject(rpc("race_phone_status", JSONObject().put("session_id", s.getString("id"))))
    patch {
      it.put("raceActive", info.optBoolean("valid") && info.optBoolean("active") && info.optBoolean("eligible") && info.optBoolean("ready", true))
        .put("raceCheckedAt", stamp()).put("nativeRecorderHeartbeatAt", stamp())
      if (!info.isNull("scheduledStart")) it.put("scheduledStart", info.getString("scheduledStart"))
      if (!info.optBoolean("valid") || !info.optBoolean("ready", true) || info.optBoolean("completed") || !info.isNull("endedAt")) {
        if (it.optString("phase") == "recording") it.put("phase", "stopping").put("stoppedAt", stamp())
      }
      it.remove("nativeRecorderError")
    }
    s = session() ?: return
    if (s.optString("phase") == "stopping") try { TripDiagnosticStore.finish(this,s.getString("id")) } catch (_:Exception) { }
    if (s.optString("phase") == "stopping") rpc("stop_race_phone", JSONObject().put("p_session", s.getString("id")).put("stopped_at", s.optString("stoppedAt", stamp())))
    // Never upload pre-start points early: the server would acknowledge and discard them.
    // Once active (or finished), its official windows filter pre-start / paused positions.
    if (!info.optBoolean("active") && s.optString("phase") != "stopping") return
    repeat(2) {
      val batch = JSONArray()
      db!!.rawQuery("SELECT seq,body FROM tracking_outbox WHERE session_id=? ORDER BY seq LIMIT 120", arrayOf(s.getString("id"))).use { c ->
        while (c.moveToNext()) batch.put(JSONObject(c.getString(1)).put("seq", c.getLong(0)))
      }
      if (batch.length() == 0) return
      val accepted = rpc("ingest_race_phone_points", JSONObject().put("p_session", s.getString("id")).put("p_points", batch)).trim().toInt()
      check(accepted == batch.length())
      transaction {
        for (i in 0 until batch.length()) db!!.execSQL("DELETE FROM tracking_outbox WHERE session_id=? AND seq=?", arrayOf(s.getString("id"), batch.getJSONObject(i).getLong("seq")))
        session()?.let { it.put("lastUploadAt", stamp()); write(it) }
      }
    }
  }
  private fun rpc(name: String, args: JSONObject): String {
    val c = config!!
    args.put("lid", c.getString("linkId")).put("device_secret", c.getString("secret"))
    val connection = URL(c.getString("url") + "/rest/v1/rpc/" + name).openConnection() as HttpURLConnection
    try {
      connection.requestMethod = "POST"; connection.connectTimeout = 10000; connection.readTimeout = 10000
      connection.setRequestProperty("apikey", c.getString("key"))
      connection.setRequestProperty("Authorization", "Bearer " + c.getString("key"))
      connection.setRequestProperty("Content-Type", "application/json")
      connection.doOutput = true
      connection.outputStream.use { it.write(args.toString().toByteArray()) }
      check(connection.responseCode in 200..299) { "Race request failed" }
      return connection.inputStream.bufferedReader().use { it.readText() }
    } finally { connection.disconnect() }
  }
  private fun session(): JSONObject? = db?.rawQuery("SELECT body FROM tracking_state WHERE id=1", null)?.use {
    if (it.moveToFirst()) JSONObject(it.getString(0)).takeIf { s -> s.optString("id") == config?.optString("sessionId") } else null
  }
  private fun write(s: JSONObject) {
    db!!.execSQL("UPDATE tracking_state SET body=? WHERE id=1", arrayOf(s.toString()))
    db!!.execSQL("INSERT OR REPLACE INTO recording_sessions(id,body) VALUES(?,?)", arrayOf(s.getString("id"), s.toString()))
  }
  private fun patch(action: (JSONObject) -> Unit) = transaction { session()?.let { action(it); write(it) } }
  private fun transaction(action: () -> Unit) {
    val d = db ?: return
    d.beginTransactionNonExclusive()
    try { action(); d.setTransactionSuccessful() } finally { d.endTransaction() }
  }
  private fun pending(): Long = db!!.rawQuery("SELECT count(*) FROM tracking_outbox WHERE session_id=?", arrayOf(config!!.getString("sessionId"))).use { it.moveToFirst(); it.getLong(0) }
  private fun guarded(action: () -> Unit) {
    try { action() } catch (_: Exception) {
      // Do not crash the recorder or log coordinates, credentials, or response bodies.
      try { patch { it.put("nativeRecorderError", "recorder").put("nativeRecorderErrorAt", stamp()) } } catch (_: Exception) { }
      handler.removeCallbacks(heartbeat); handler.postDelayed(heartbeat, 60000)
    }
  }
  override fun onDestroy() {
    client.removeLocationUpdates(callback)
    handler.removeCallbacksAndMessages(null)
    network.shutdownNow()
    handler.post { stopMotion(); db?.close(); worker.quitSafely() }
    super.onDestroy()
  }
  companion object {
    const val CONFIG = "veetr-race-recorder.json"
    const val CHANNEL = "veetr-native-race"
    fun time(value: String): Long = try { Instant.parse(value).toEpochMilli() } catch (_: Exception) { 0 }
    fun iso(value: Long): String = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(java.time.ZoneOffset.UTC).format(Instant.ofEpochMilli(value))
    fun stamp() = iso(System.currentTimeMillis())
  }
}
