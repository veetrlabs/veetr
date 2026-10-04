package org.veetr.anchor

import android.app.*
import android.content.*
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class VeetrAnchorAlarmModule : Module() {
  private fun context() = requireNotNull(appContext.reactContext) { "Open Veetr to use anchor alarms." }
  override fun definition() = ModuleDefinition {
    Name("VeetrAnchorAlarm")
    AsyncFunction("prepare") { NativeAlarms.check(context()); NativeAlarms.prefs(context()).edit().remove("error").apply() }
    AsyncFunction("check") { NativeAlarms.check(context()); NativeAlarms.prefs(context()).getString("error", null)?.let { error(it) } }
    AsyncFunction("trigger") { title: String, sound: String, test: Boolean -> NativeAlarms.trigger(context(), title, sound, test) }
    AsyncFunction("watchdog") { title: String, sound: String, deadline: Double -> NativeAlarms.watchdog(context(), title, sound, deadline.toLong()) }
    AsyncFunction("stop") { NativeAlarms.stop(context(), false) }
    AsyncFunction("stopTest") { NativeAlarms.stop(context(), true) }
    AsyncFunction("openSettings") {
      val c = context()
      val alarms = c.getSystemService(AlarmManager::class.java)
      val notifications = c.getSystemService(NotificationManager::class.java)
      val intent = when {
        Build.VERSION.SDK_INT >= 31 && !alarms.canScheduleExactAlarms() -> Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${c.packageName}"))
        !notifications.areNotificationsEnabled() -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, c.packageName)
        notifications.currentInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALL &&
          notifications.currentInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALARMS &&
          !notifications.isNotificationPolicyAccessGranted -> Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
        else -> Intent(Settings.ACTION_SOUND_SETTINGS)
      }
      c.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}

internal object NativeAlarms {
  const val TEST = 901
  const val DRAG = 902
  const val WATCH = 903
  fun prefs(c: Context) = c.getSharedPreferences("veetr-anchor-alarm", Context.MODE_PRIVATE)
  fun check(c: Context) {
    val alarms = c.getSystemService(AlarmManager::class.java)
    check(Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) { "Allow Alarms & reminders for Veetr in Android settings, then retry." }
    val audio = c.getSystemService(AudioManager::class.java)
    check(audio.getStreamVolume(AudioManager.STREAM_ALARM) > 0) { "Raise Android's alarm volume before starting." }
    val notifications = c.getSystemService(NotificationManager::class.java)
    check(notifications.areNotificationsEnabled()) { "Allow notifications for Veetr before starting." }
    val filter = notifications.currentInterruptionFilter
    val allowed = filter == NotificationManager.INTERRUPTION_FILTER_ALL || filter == NotificationManager.INTERRUPTION_FILTER_ALARMS ||
      (filter == NotificationManager.INTERRUPTION_FILTER_PRIORITY && notifications.isNotificationPolicyAccessGranted &&
        notifications.notificationPolicy.priorityCategories and NotificationManager.Policy.PRIORITY_CATEGORY_ALARMS != 0)
    check(allowed) { "Allow alarms in Do Not Disturb. To check this setting, grant Veetr Do Not Disturb access or turn Do Not Disturb off." }
  }
  private fun intent(c: Context, kind: Int) = Intent(c, AnchorAlarmReceiver::class.java).setAction("org.veetr.anchor.$kind")
  private fun pending(c: Context, kind: Int, extras: Intent? = null): PendingIntent = PendingIntent.getBroadcast(c, kind,
    extras ?: intent(c, kind), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  private fun schedule(c: Context, kind: Int, title: String, sound: String, deadline: Long) {
    check(c)
    val generation = prefs(c).getLong("generation.$kind", 0)
    val request = intent(c, kind).putExtra("kind", kind).putExtra("title", title).putExtra("sound", sound).putExtra("generation", generation)
    val alarm = c.getSystemService(AlarmManager::class.java)
    val show = PendingIntent.getActivity(c, kind, c.packageManager.getLaunchIntentForPackage(c.packageName)!!,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    // Alarm-clock scheduling wakes the receiver even in Doze; playback then runs
    // in its own foreground service using the alarm audio stream.
    alarm.setAlarmClock(AlarmManager.AlarmClockInfo(maxOf(deadline, System.currentTimeMillis() + 1000), show), pending(c, kind, request))
  }
  @Synchronized fun trigger(c: Context, title: String, sound: String, test: Boolean) {
    if (!test && prefs(c).getBoolean("fired", false)) return
    if (!test) {
      schedule(c, DRAG, title, sound, System.currentTimeMillis() + 1000)
      prefs(c).edit().putBoolean("fired", true).apply()
      cancel(c, WATCH)
    } else schedule(c, TEST, title, sound, System.currentTimeMillis() + 5000)
  }
  @Synchronized fun watchdog(c: Context, title: String, sound: String, deadline: Long) {
    if (prefs(c).getBoolean("fired", false) || AnchorSoundService.activeKind == WATCH) return
    schedule(c, WATCH, title, sound, deadline)
  }
  private fun cancel(c: Context, kind: Int) {
    c.getSystemService(AlarmManager::class.java).cancel(pending(c, kind))
    val p = prefs(c)
    p.edit().putLong("generation.$kind", p.getLong("generation.$kind", 0) + 1).apply()
  }
  @Synchronized fun stop(c: Context, testOnly: Boolean) {
    if (testOnly) {
      cancel(c, TEST)
      if (AnchorSoundService.activeKind == TEST) c.stopService(Intent(c, AnchorSoundService::class.java))
    } else {
      listOf(TEST, DRAG, WATCH).forEach { cancel(c, it) }
      prefs(c).edit().remove("fired").remove("error").apply()
      c.stopService(Intent(c, AnchorSoundService::class.java))
    }
  }
  @Synchronized fun deliver(c: Context, intent: Intent) {
    val kind = intent.getIntExtra("kind", -1)
    if (kind !in listOf(TEST, DRAG, WATCH)) return
    if (intent.getLongExtra("generation", -1) != prefs(c).getLong("generation.$kind", 0)) return
    val service = Intent(c, AnchorSoundService::class.java).putExtras(intent)
    if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(service) else c.startService(service)
  }
}

class AnchorAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    try { NativeAlarms.deliver(context, intent) }
    catch (error: Exception) { NativeAlarms.prefs(context).edit().putString("error", error.message).apply() }
  }
}
