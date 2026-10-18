package expo.modules.location

import kotlin.math.*

/** Motion corroborates GPS noise only; it cannot establish velocity or position. */
internal class VeetrMotionQuality {
  private data class Sample(val at: Long, val magnitude: Double)
  private val samples = ArrayDeque<Sample>()
  fun reset() = samples.clear()
  fun add(at: Long, x: Double, y: Double, z: Double) {
    if (samples.isNotEmpty() && at <= samples.last().at) return
    val magnitude = sqrt(x*x + y*y + z*z)
    // Retain invalid/high-impact samples as barriers, never as quiet motion.
    samples.addLast(Sample(at, if (magnitude.isFinite() && magnitude in 7.0..13.0) magnitude else Double.NaN))
    while (samples.isNotEmpty() && at - samples.first().at > 30_000) samples.removeFirst()
    while (samples.size > 300) samples.removeFirst()
  }
  fun quiet(at: Long): Boolean {
    val recent = samples.filter { it.at <= at && at - it.at <= 3000 }
    if (recent.size < 10 || at - recent.last().at > 600 ||
        recent.last().at - recent.first().at < 2000 || recent.any { !it.magnitude.isFinite() } ||
        recent.zipWithNext().any { (a, b) -> b.at - a.at > 600 }) return false
    val mean = recent.map { it.magnitude }.average()
    val variance = recent.map { (it.magnitude - mean).pow(2) }.average()
    return sqrt(variance) < 0.12 && recent.maxOf { it.magnitude } - recent.minOf { it.magnitude } < 0.4
  }
}

internal class VeetrPhoneSpeedQuality {
  private data class Fix(val at: Long, val lat: Double, val lon: Double, val accuracy: Double)
  private val history = ArrayDeque<Fix>()
  fun reset() = history.clear()
  fun speed(at: Long, lat: Double, lon: Double, accuracy: Double, speed: Double?, quiet: Boolean): Double? {
    if (history.isNotEmpty() && (at <= history.last().at || at - history.last().at > 15_000)) reset()
    while (history.isNotEmpty() && at - history.first().at > 30_000) history.removeFirst()
    val anchor = history.firstOrNull()
    val span = if (anchor == null) 0 else at - anchor.at
    val rad = PI / 180
    val distance = if (anchor == null) 0.0 else {
      val h = sin((lat-anchor.lat)*rad/2).pow(2) + cos(lat*rad)*cos(anchor.lat*rad)*sin((lon-anchor.lon)*rad/2).pow(2)
      6371000 * 2 * asin(sqrt(h.coerceIn(0.0, 1.0)))
    }
    val displaced = anchor != null && span >= 5000 && distance > max(3.0, accuracy + anchor.accuracy)
    history.addLast(Fix(at, lat, lon, accuracy))
    return when {
      speed == null || !speed.isFinite() || speed < 0 || speed > 100 -> null
      !displaced && speed < 0.15 -> 0.0
      !displaced && span >= 5000 && quiet && speed < (if (accuracy <= 25) 0.3 else 0.6) -> 0.0
      accuracy > 25 -> null
      else -> speed
    }
  }
}
