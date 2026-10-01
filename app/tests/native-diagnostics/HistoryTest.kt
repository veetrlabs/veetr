package expo.modules.location
import android.content.Context
import org.json.JSONArray

fun main() {
  val context=Context()
  VeetrLocationDiagnostics.record(context,"tripStarted")
  check(context.prefs.values.isEmpty()) {"Disabled diagnostics wrote data"}
  VeetrLocationDiagnostics.setEnabled(context,true)
  VeetrLocationDiagnostics.record(context,"tripStarted")
  VeetrLocationDiagnostics.record(context,"fix",441)
  VeetrLocationDiagnostics.record(context,"jsTask",440)
  VeetrLocationDiagnostics.record(context,"saved",440)
  val now=System.currentTimeMillis()
  context.prefs.edit().putLong("since",now-2*86400000L).putLong("savedAt",now-21758000L).apply()
  // Simulate recreation with the same persisted preferences.
  val flag=VeetrLocationDiagnostics::class.java.getDeclaredField("processObserved")
  flag.isAccessible=true; flag.setBoolean(null,false)
  context.activity.exits=listOf(android.app.ExitInfo(now-100000L,3))
  context.jobs.history=listOf(android.app.job.PendingJobReasonsInfo(now-90000L,intArrayOf(14)))
  VeetrLocationDiagnostics.record(context,"resume")
  VeetrLocationDiagnostics.record(context,"fix")
  VeetrLocationDiagnostics.record(context,"saved",1)
  val history=VeetrLocationDiagnostics.history(context)
  val gap=history.single {it["event"]=="gap"}
  check((gap["saved"] as Number).toLong()==440L && (gap["fixes"] as Number).toLong()==441L) {"Gap evidence overwritten by recovery"}
  check((gap["savedAgeSeconds"] as Number).toLong()>=21758)
  check(VeetrLocationDiagnostics.snapshot(context)["fixCount"]==442L) {"24-hour reset lost prior evidence"}
  check(history.count {it["event"]=="processStarted"}==2)
  check(history.any {it["event"]=="processExit" && it["reason"]==3 && it["fixes"]==null})
  check(history.count {it["event"]=="jobPending" && it["reason"]==14}==1)
  check(VeetrLocationDiagnostics.history(context).count {it["event"]=="jobPending"}==1) {"Pending history duplicated"}
  VeetrLocationDiagnostics.record(context,"jobStopped",10)
  check(VeetrLocationDiagnostics.history(context).any {it["event"]=="jobStopped" && it["reason"]==10})
  // Retention and report bounds across long active trips.
  val rows=JSONArray(context.prefs.getString("history","[]"))
  val sample=rows.getJSONObject(0)
  val bulk=JSONArray()
  for(i in 0..1100) bulk.put(org.json.JSONObject(sample.toString()).put("at",now-(1100-i)*600000L).put("event","checkpoint"))
  context.prefs.edit().putString("history",bulk.toString()).apply()
  VeetrLocationDiagnostics.record(context,"recovery")
  check(JSONArray(context.prefs.getString("history","[]")).length()<=1024)
  check(VeetrLocationDiagnostics.history(context).size<=64)
  check(VeetrLocationDiagnostics.history(context).all {(it["ageSeconds"] as Long)<=604800})
  VeetrLocationDiagnostics.setEnabled(context,false)
  check(context.prefs.values.isEmpty())
  check(VeetrLocationDiagnostics.history(context).isEmpty())
  VeetrLocationDiagnostics.record(context,"fix")
  check(context.prefs.values.isEmpty())
  println("Native history: opt-in, restart, 24h retention, pre-recovery gap, OS reasons, bounds and deletion PASS")
}
