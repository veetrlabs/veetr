package org.veetr.diagnostics

import android.app.*
import android.content.Intent
import android.hardware.*
import android.os.*
import org.json.JSONArray
import org.json.JSONObject

/** Same recorder process as Android race GPS; survives the UI going away. */
class TripSensorService : Service(), SensorEventListener {
  private lateinit var worker: HandlerThread
  private lateinit var handler: Handler
  private lateinit var sensors: SensorManager
  private var session: String? = null
  private var pending = JSONArray()
  private val last = mutableMapOf<Int,Long>()
  private val names = mapOf(Sensor.TYPE_ACCELEROMETER to "accelerometer", Sensor.TYPE_GYROSCOPE to "gyroscope",
    Sensor.TYPE_LINEAR_ACCELERATION to "linearAcceleration", Sensor.TYPE_GRAVITY to "gravity", Sensor.TYPE_ROTATION_VECTOR to "rotationVector")
  private fun event(name: String) = JSONObject().put("type","event").put("event",name).put("atMs",System.currentTimeMillis()).put("monotonicMs",SystemClock.elapsedRealtime())
  override fun onBind(intent: Intent?) = null
  override fun onCreate() {
    super.onCreate()
    worker = HandlerThread("veetr-diagnostic-sensors").also { it.start() }; handler = Handler(worker.looper)
    sensors = getSystemService(SENSOR_SERVICE) as SensorManager
    if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel("veetr-diagnostic-sensors", "Trip diagnostics", NotificationManager.IMPORTANCE_LOW))
    val notification = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this,"veetr-diagnostic-sensors") else Notification.Builder(this)
    startForeground(482002, notification.setSmallIcon(applicationInfo.icon).setContentTitle("Veetr trip diagnostics").setContentText("Recording motion measurements locally with your trip.").setOngoing(true).build())
    handler.post(poll)
  }
  override fun onStartCommand(intent: Intent?, flags: Int, id: Int) = START_STICKY
  private val poll = object: Runnable {
    override fun run() {
      try {
        val active = TripDiagnosticStore.active(this@TripSensorService)
        if (active != session) {
          flush(); sensors.unregisterListener(this@TripSensorService); last.clear(); session = active
          if(active != null) {
            val status = event("sensors_started").put("requestedHz",5).put("units",JSONObject().put("acceleration","m/s²").put("gyroscope","rad/s").put("rotationVector","Android rotation vector"))
            val available = JSONObject()
            for((type,name) in names) {
              val sensor = sensors.getDefaultSensor(type)
              available.put(name, sensor != null && sensors.registerListener(this@TripSensorService,sensor,200000,handler))
            }
            pending.put(status.put("available",available)); flush()
          }
        }
        if(active == null) { stopSelf(); return }
        flush()
      } catch (_: Exception) { /* Collection failure must not stop GPS. */ }
      handler.postDelayed(this,1000)
    }
  }
  private fun flush() {
    val id = session ?: return
    if(pending.length() == 0) return
    TripDiagnosticStore.append(this,id,pending); pending = JSONArray()
  }
  override fun onSensorChanged(e: SensorEvent) {
    if(session == null) return
    val ms = e.timestamp / 1000000
    val previous = last[e.sensor.type]
    if(previous != null && ms - previous < 190) return
    if(previous != null && ms - previous > 1000) pending.put(event("sensor_gap").put("sensor",names[e.sensor.type]).put("durationMs",ms-previous))
    last[e.sensor.type] = ms
    val now = System.currentTimeMillis(); val mono = SystemClock.elapsedRealtime()
    // Do not integrate or filter sensor values. Save provider accuracy and both clocks.
    pending.put(JSONObject().put("type","sensor").put("sensor",names[e.sensor.type]).put("monotonicMs",ms)
      .put("atMs",now - (mono-ms)).put("receivedAtMs",now).put("accuracy",e.accuracy)
      .put("values",JSONArray(e.values.map { if(it.isFinite()) it.toDouble() else JSONObject.NULL })))
    // Persist each delivered sample so stop/consent changes cannot strand a buffer.
    try { flush() } catch (_:Exception) { pending=JSONArray().put(event("sensor_write_failed")) }
  }
  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) { pending.put(event("sensor_accuracy").put("sensor",names[sensor?.type]).put("accuracy",accuracy)) }
  override fun onDestroy() {
    handler.post { sensors.unregisterListener(this); pending.put(event("sensors_stopped")); try { flush() } catch (_:Exception) {} ; worker.quitSafely() }
    super.onDestroy()
  }
}
