package expo.modules.location

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [28])
class VeetrTripDiagnosticStoreTest {
  @Test fun consentStopExpiryAndSnapshotAcrossConnections() {
    val c = RuntimeEnvironment.getApplication()
    val rows = JSONArray().put(JSONObject().put("type","sensor").put("value",1.23456789))
    TripDiagnosticStore.configure(c,false,null,0.0,"{}")
    TripDiagnosticStore.append(c,"trip",rows)
    assertEquals(0L,TripDiagnosticStore.snapshot(c,"trip")["through"])
    TripDiagnosticStore.configure(c,true,"trip",System.currentTimeMillis()+60000.0,"{}")
    TripDiagnosticStore.append(c,"trip",rows)
    val through = TripDiagnosticStore.snapshot(c,"trip")["through"] as Long
    TripDiagnosticStore.append(c,"trip",rows)
    val snapshot = TripDiagnosticStore.read(c,"trip",0,through)
    assertEquals(2,snapshot.size)
    assertEquals(1.23456789,JSONObject(snapshot.last()["body"] as String).getDouble("value"),0.0)
    TripDiagnosticStore.finish(c,"trip")
    val stopped = TripDiagnosticStore.snapshot(c,"trip")
    TripDiagnosticStore.append(c,"trip",rows)
    assertEquals(stopped,TripDiagnosticStore.snapshot(c,"trip"))
    TripDiagnosticStore.configure(c,true,"expired",1.0,"{}")
    assertNull(TripDiagnosticStore.active(c))
    TripDiagnosticStore.append(c,"expired",rows)
    assertEquals(1,TripDiagnosticStore.read(c,"expired",0,Long.MAX_VALUE).size)
    TripDiagnosticStore.configure(c,false,null,0.0,"{}")
    TripDiagnosticStore.append(c,"trip",rows)
    assertTrue(TripDiagnosticStore.read(c,"trip",0,Long.MAX_VALUE).isEmpty())
    assertTrue(TripDiagnosticStore.read(c,"expired",0,Long.MAX_VALUE).isEmpty())
  }
}
