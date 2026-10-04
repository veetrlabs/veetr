package expo.modules.location

import android.content.ComponentName
import android.content.ContextWrapper
import android.content.Intent
import expo.modules.kotlin.functions.UntypedAsyncFunctionComponent
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
class VeetrRecorderBridgeTest {
  private class Context : ContextWrapper(RuntimeEnvironment.getApplication()) {
    var starts = 0
    var denied = false
    override fun startForegroundService(intent: Intent): ComponentName {
      if (denied) throw IllegalStateException("Foreground start denied")
      starts++
      return ComponentName(this, VeetrRaceRecorderService::class.java)
    }
  }
  @Suppress("UNCHECKED_CAST")
  private fun body(module: LocationModule, name: String): (Array<out Any?>) -> Any? {
    val function = module.definition().asyncFunctions.getValue(name)
    return UntypedAsyncFunctionComponent::class.java.getDeclaredField("body").apply { isAccessible = true }.get(function) as (Array<out Any?>) -> Any?
  }
  @Test fun startAndWakeDoNotReturnAndroidObjectsToJavaScript() {
    val context = Context()
    val module = LocationModule()
    module.javaClass.getDeclaredField("mContext").apply { isAccessible = true }.set(module, context)
    try {
      assertEquals(Unit, body(module, "startVeetrRaceRecorder")(arrayOf("{\"url\":\"https://example.invalid\"}")))
      assertEquals(Unit, body(module, "wakeVeetrRaceRecorder")(emptyArray()))
      assertEquals(2, context.starts)
    } finally { java.io.File(context.filesDir, VeetrRaceRecorderService.CONFIG).delete() }
  }
  @Test fun actualServiceStartFailuresStillPropagate() {
    val context = Context().apply { denied = true }
    val module = LocationModule()
    module.javaClass.getDeclaredField("mContext").apply { isAccessible = true }.set(module, context)
    for (name in listOf("startVeetrRaceRecorder", "wakeVeetrRaceRecorder")) {
      try {
        body(module, name)(if (name.startsWith("start")) arrayOf("{\"url\":\"https://example.invalid\"}") else emptyArray())
        fail("Expected service failure for $name")
      } catch (e: IllegalStateException) { assertEquals("Foreground start denied", e.message) }
      finally { java.io.File(context.filesDir, VeetrRaceRecorderService.CONFIG).delete() }
    }
    assertEquals(0, context.starts)
  }
}
