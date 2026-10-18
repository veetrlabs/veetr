package expo.modules.location

import org.junit.Assert.*
import org.junit.Test

class VeetrMotionQualityTest {
  @Test fun delayedBatchesUseMotionAtFixTime() {
    val motion = VeetrMotionQuality()
    for (t in 0L..12000L step 200) motion.add(t, 0.0, 0.0, if (t <= 3000) 9.81 else if (t % 400 == 0L) 11.0 else 9.0)
    assertTrue(motion.quiet(2800))
    assertFalse(motion.quiet(12000))
    assertFalse(motion.quiet(14000))
    assertFalse(motion.quiet(-1))
  }
  @Test fun missingInterruptedOrInvalidMotionIsNotStillness() {
    val motion = VeetrMotionQuality()
    assertFalse(motion.quiet(0))
    for (t in 0L..1800L step 200) motion.add(t, 0.0, 0.0, 9.81)
    motion.add(3000, 0.0, 0.0, 9.81)
    assertFalse(motion.quiet(3000))
    for (t in 3200L..6000L step 200) motion.add(t, 0.0, 0.0, 9.81)
    assertTrue(motion.quiet(6000))
    motion.add(6200, Double.NaN, 0.0, 0.0)
    assertFalse(motion.quiet(6200))
    motion.reset()
    assertFalse(motion.quiet(6000))
  }
  @Test fun quietSensorDoesNotStopSmoothTravel() {
    val filter = VeetrPhoneSpeedQuality()
    filter.speed(1000, 49.0, 14.0, 4.0, 2.0, true)
    assertEquals(2.0, filter.speed(7000, 49.0 + 12.0/111195, 14.0, 4.0, 2.0, true)!!, 0.0001)
  }
  @Test fun slowMeasuredTravelAndSessionResetArePreserved() {
    val filter = VeetrPhoneSpeedQuality()
    for (t in 0L..30000L step 1000) filter.speed(t, 49.0 + (t / 1000.0 * 0.12)/111195, 14.0, 0.5, 0.12, true)
    assertEquals(0.12, filter.speed(31000, 49.0 + 3.72/111195, 14.0, 0.5, 0.12, true)!!, 0.0001)
    filter.reset()
    assertEquals(0.25, filter.speed(32000, 49.0, 14.0, 4.0, 0.25, true)!!, 0.0001)
  }
  @Test fun quietSensorCorroboratesOnlyLowSpeedNoise() {
    val filter = VeetrPhoneSpeedQuality()
    filter.speed(1000, 49.0, 14.0, 4.0, 0.25, true)
    assertEquals(0.0, filter.speed(7000, 49.0, 14.0, 4.0, 0.25, true)!!, 0.0001)
    assertEquals(0.25, filter.speed(8000, 49.0, 14.0, 4.0, 0.25, false)!!, 0.0001)
    assertNull(filter.speed(9000, 49.0, 14.0, 40.0, 2.0, false))
    assertNull(filter.speed(10000, 49.0, 14.0, 4.0, Double.NaN, true))
    assertNull(filter.speed(11000, 49.0, 14.0, 4.0, null, true))
    assertEquals(0.25, filter.speed(40000, 49.0, 14.0, 4.0, 0.25, true)!!, 0.0001)
  }
}
