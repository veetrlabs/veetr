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
void test_extended_packets_fit_and_absent_data_is_null(){
 SensorData d={};ImuService i;ImuDiagnostics x;StaticJsonDocument<512> doc;
 for(int part=0;part<4;part++){
  auto packet=vaneDiagnosticPacket(65535,part,4294967295UL,d,i,true,false,0,true,255,&x);
  TEST_ASSERT_TRUE(packet.length()>0 && packet.length()<=180);
  TEST_ASSERT_FALSE(deserializeJson(doc,packet.c_str()));
  if(part==0)TEST_ASSERT_EQUAL(4,doc["n"].as<int>());
  if(part==2){TEST_ASSERT_TRUE(doc["mx"].isNull());TEST_ASSERT_EQUAL(-1,doc["ma"].as<int>());}
 }
 x.magAt=x.gyroAt=x.calAt=1;x.mx=x.my=x.mz=-2048;x.gx=x.gy=x.gz=x.bx=x.by=x.bz=-32;x.cal=5;x.mq=x.gq=3;
 for(int part=2;part<4;part++){
  auto packet=vaneDiagnosticPacket(65535,part,4294967295UL,d,i,true,false,0,true,255,&x);
  TEST_ASSERT_TRUE(packet.length()>0 && packet.length()<=180);
  TEST_ASSERT_FALSE(deserializeJson(doc,packet.c_str()));
  if(part==2)TEST_ASSERT_EQUAL(-20480,doc["mx"].as<int>());
  if(part==3)TEST_ASSERT_EQUAL(-32000,doc["bz"].as<int>());
 }
}
int main() {UNITY_BEGIN(); RUN_TEST(test_packets_fit_and_missing_sensor_is_explicit); RUN_TEST(test_extended_packets_fit_and_absent_data_is_null); return UNITY_END();}
