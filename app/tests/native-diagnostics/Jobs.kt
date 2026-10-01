package android.app.job
class JobScheduler {
  companion object {const val PENDING_JOB_REASON_QUOTA=14}
  var allPendingJobs=listOf(JobInfo())
  var history=emptyList<PendingJobReasonsInfo>()
  fun getPendingJobReasons(id:Int)=intArrayOf(PENDING_JOB_REASON_QUOTA)
  fun getPendingJobReasonsHistory(id:Int)=history
}
class JobInfo { val id=999; val service=Component() }
class Component { val className="expo.modules.taskManager.TaskJobService" }
class PendingJobReasonsInfo(val timestampMillis:Long,val pendingJobReasons:IntArray)
