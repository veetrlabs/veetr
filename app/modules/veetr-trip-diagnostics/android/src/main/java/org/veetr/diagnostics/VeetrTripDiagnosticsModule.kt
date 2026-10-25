package org.veetr.diagnostics

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

class VeetrTripDiagnosticsModule : Module() {
  private fun context() = requireNotNull(appContext.reactContext)
  override fun definition() = ModuleDefinition {
    Name("VeetrTripDiagnostics")
    AsyncFunction("configure") { enabled: Boolean, session: String?, expires: Double, metadata: String ->
      val c = context()
      TripDiagnosticStore.configure(c, enabled, session, expires, metadata)
      val intent = Intent(c, TripSensorService::class.java)
      if (enabled && session != null) {
        try { if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(intent) else c.startService(intent) }
        catch (e: Exception) { TripDiagnosticStore.append(c,session,JSONArray().put(org.json.JSONObject().put("type","event").put("event","sensor_service_unavailable").put("atMs",System.currentTimeMillis()).put("reason",e.javaClass.simpleName))) }
      } else c.stopService(intent)
    }
    AsyncFunction("append") { session: String, records: String -> TripDiagnosticStore.append(context(),session,JSONArray(records)) }
    AsyncFunction("snapshot") { session: String -> TripDiagnosticStore.snapshot(context(),session) }
    AsyncFunction("read") { session: String, after: Double, through: Double -> TripDiagnosticStore.read(context(),session,after.toLong(),through.toLong()) }
    AsyncFunction("delete") { session: String -> TripDiagnosticStore.delete(context(),session) }
  }
}
