#include <unity.h>
#include "vane_diagnostics.h"
void setUp() {}
void tearDown() {}
void test_packets_fit_and_missing_sensor_is_explicit() {
 SensorData d={}; ImuService i;
 auto packet=vaneDiagnosticPacket(65535,0,4294967295UL,d,i,false,false,0,false,0);
 StaticJsonDocument<512> doc;
 TEST_ASSERT_TRUE(packet.length()>0 && packet.length()<=180);
 TEST_ASSERT_FALSE(deserializeJson(doc,packet.c_str()));
 TEST_ASSERT_EQUAL(-1,doc["age"].as<int>());
 i.quaternionReports=i.accelReports=4294967295U; d.headingRejected=4294967295UL;
 d.headingRaw=359.999f; d.HDM=359; d.headingQuality=3;
 for(int part=0;part<2;part++) {
  packet=vaneDiagnosticPacket(65535,part,4294967295UL,d,i,true,true,-359.9f,false,255);
  TEST_ASSERT_TRUE(packet.length()>0 && packet.length()<=180);
  TEST_ASSERT_FALSE(deserializeJson(doc,packet.c_str()));
  TEST_ASSERT_EQUAL(65535,doc["id"].as<int>());
 }
 i.quaternionReports=0;
 packet=vaneDiagnosticPacket(1,1,100,d,i,false,false,0,false,0);
 TEST_ASSERT_FALSE(deserializeJson(doc,packet.c_str()));
 TEST_ASSERT_TRUE(doc["raw"].isNull());
}
int main() {UNITY_BEGIN(); RUN_TEST(test_packets_fit_and_missing_sensor_is_explicit); return UNITY_END();}
