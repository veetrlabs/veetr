package android.os
object Build { object VERSION { var SDK_INT=36 } }
class PowerManager {
  val isInteractive=false; val isPowerSaveMode=false; val isDeviceIdleMode=false
  fun isIgnoringBatteryOptimizations(packageName:String)=false
}
