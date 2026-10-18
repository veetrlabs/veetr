package expo.modules.location

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
class VeetrTrackingQualityTest {
  @Test fun consentGatesConstructionAndClearsUnsentSamplesAcrossDatabaseConnections() {
    val context = RuntimeEnvironment.getApplication()
    VeetrTrackingQuality.setEnabled(context, false)
    var built = 0
    val build = { built++; JSONObject().put("version", 1).put("rawSpeedMps", 0.25) }
    VeetrTrackingQuality.record(context, build)
    assertEquals(0, built)
    assertTrue(VeetrTrackingQuality.snapshot(context).isEmpty())
    VeetrTrackingQuality.setEnabled(context, true)
    VeetrTrackingQuality.record(context, build)
    assertEquals(1, built)
    assertEquals(1, VeetrTrackingQuality.snapshot(context).size)
    VeetrTrackingQuality.setEnabled(context, false)
    VeetrTrackingQuality.record(context, build)
    assertEquals(1, built)
    assertTrue(VeetrTrackingQuality.snapshot(context).isEmpty())
    VeetrTrackingQuality.setEnabled(context, true)
    assertTrue(VeetrTrackingQuality.snapshot(context).isEmpty())
    repeat(150) { i -> VeetrTrackingQuality.record(context) { JSONObject().put("version", 1).put("rawSpeedMps", i) } }
    val rows = VeetrTrackingQuality.snapshot(context)
    assertEquals(32, rows.size)
    assertEquals(149, rows.last()["rawSpeedMps"])
    VeetrTrackingQuality.setEnabled(context, false)
  }
}
