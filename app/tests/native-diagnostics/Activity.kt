package android.app
class ActivityManager {
  var exits=emptyList<ExitInfo>()
  fun getHistoricalProcessExitReasons(packageName:String,pid:Int,max:Int)=exits
}
class ExitInfo(val timestamp:Long,val reason:Int)
