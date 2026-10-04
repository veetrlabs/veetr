package org.veetr.anchor

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.*
import android.net.Uri
import android.os.*

class AnchorSoundService : Service() {
  companion object { @Volatile var activeKind = 0 }
  private var player: MediaPlayer? = null
  private var focus: AudioFocusRequest? = null
  private val audio by lazy { getSystemService(AudioManager::class.java) }
  private val vibrator by lazy { getSystemService(VIBRATOR_SERVICE) as Vibrator }
  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    if (change == AudioManager.AUDIOFOCUS_LOSS) stopSelf()
    else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) player?.pause()
    else if (change == AudioManager.AUDIOFOCUS_GAIN) player?.start()
  }
  override fun onBind(intent: Intent?) = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == "dismiss") { stopSelf(); return START_NOT_STICKY }
    val kind = intent?.getIntExtra("kind", 0) ?: 0
    if (kind == 0) { stopSelf(); return START_NOT_STICKY }
    // A sound test must never replace an actual anchor warning.
    if (activeKind != 0 && kind == NativeAlarms.TEST) return START_NOT_STICKY
    if (activeKind == kind && player?.isPlaying == true) return START_NOT_STICKY
    if (intent?.getLongExtra("generation", -1) != NativeAlarms.prefs(this).getLong("generation.$kind", 0)) {
      if (activeKind == 0) stopSelf()
      return START_NOT_STICKY
    }
    activeKind = kind
    val notifications = getSystemService(NotificationManager::class.java)
    val channel = "veetr-native-anchor-alarm"
    if (Build.VERSION.SDK_INT >= 26) notifications.createNotificationChannel(NotificationChannel(channel, "Anchor alarm", NotificationManager.IMPORTANCE_HIGH).apply {
      setSound(null, null) // MediaPlayer owns alarm audio, not notification volume.
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    })
    val open = PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName)!!,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val dismiss = PendingIntent.getService(this, 0, Intent(this, AnchorSoundService::class.java).setAction("dismiss"),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, channel) else Notification.Builder(this)
    val notification = builder.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(intent?.getStringExtra("title") ?: "Anchor alarm")
      .setContentText("Check your boat. Dismissing the sound does not stop anchor monitoring.")
      .setCategory(Notification.CATEGORY_ALARM).setVisibility(Notification.VISIBILITY_PUBLIC)
      .setContentIntent(open).setOngoing(true).addAction(android.R.drawable.ic_media_pause, "Dismiss sound", dismiss).build()
    if (Build.VERSION.SDK_INT >= 29) startForeground(910, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    else startForeground(910, notification)
    try {
      player?.release()
      val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
      val granted = if (Build.VERSION.SDK_INT >= 26) {
        focus?.let { audio.abandonAudioFocusRequest(it) }
        focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes).setOnAudioFocusChangeListener(focusListener).build()
        audio.requestAudioFocus(focus!!)
      } else audio.requestAudioFocus(focusListener, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
      check(granted == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) { "Alarm audio focus was not granted." }
      val uri = if (intent?.getStringExtra("sound") == "siren") Uri.parse("android.resource://$packageName/${R.raw.veetr_anchor_siren}")
        else RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      player = MediaPlayer().apply {
        setAudioAttributes(attributes)
        setWakeMode(this@AnchorSoundService, PowerManager.PARTIAL_WAKE_LOCK)
        setDataSource(this@AnchorSoundService, uri)
        isLooping = true
        setOnErrorListener { _, _, _ ->
          NativeAlarms.prefs(this@AnchorSoundService).edit().putString("error", "Alarm audio playback failed.").apply()
          stopSelf(); true
        }
        prepare(); start()
      }
      if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 800, 400), 0))
      else vibrator.vibrate(longArrayOf(0, 800, 400), 0)
    } catch (error: Exception) {
      NativeAlarms.prefs(this).edit().putString("error", error.message).apply()
      stopSelf()
    }
    return START_NOT_STICKY
  }
  override fun onDestroy() {
    player?.release(); player = null
    vibrator.cancel()
    if (Build.VERSION.SDK_INT >= 26) focus?.let { audio.abandonAudioFocusRequest(it) }
    else audio.abandonAudioFocus(focusListener)
    activeKind = 0
    super.onDestroy()
  }
}
