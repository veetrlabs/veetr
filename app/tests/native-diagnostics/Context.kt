package android.content
// JVM test doubles; Android API compatibility is checked by compileReleaseKotlin separately.
class Context {
  companion object { const val MODE_PRIVATE=0; const val POWER_SERVICE="power"; const val LOCATION_SERVICE="location"; const val JOB_SCHEDULER_SERVICE="jobs"; const val ACTIVITY_SERVICE="activity" }
  val packageName="com.veetr.test"
  val prefs=Preferences()
  val jobs=android.app.job.JobScheduler()
  val activity=android.app.ActivityManager()
  fun getSharedPreferences(name:String,mode:Int)=prefs
  fun getSystemService(name:String):Any = when(name) {
    POWER_SERVICE -> android.os.PowerManager()
    LOCATION_SERVICE -> android.location.LocationManager()
    JOB_SCHEDULER_SERVICE -> jobs
    else -> activity
  }
}
class Preferences {
  val values=mutableMapOf<String,Any>()
  fun getBoolean(k:String,d:Boolean)=values[k] as? Boolean ?: d
  fun getLong(k:String,d:Long)=values[k] as? Long ?: d
  fun getString(k:String,d:String)=values[k] as? String ?: d
  fun contains(k:String)=values.containsKey(k)
  fun edit()=Editor(this)
}
class Editor(private val prefs:Preferences) {
  private val writes=mutableMapOf<String,Any?>(); private var clear=false
  fun clear()=apply {clear=true}
  fun putBoolean(k:String,v:Boolean)=apply {writes[k]=v}
  fun putLong(k:String,v:Long)=apply {writes[k]=v}
  fun putString(k:String,v:String)=apply {writes[k]=v}
  fun remove(k:String)=apply {writes[k]=null}
  fun apply() { if(clear) prefs.values.clear(); for((k,v) in writes) { if(v==null) prefs.values.remove(k) else prefs.values[k]=v } }
}
