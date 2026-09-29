#include <unity.h>
#include "north_alignment.h"
struct Imu { float real=1; float getQuatI(){return 0;} float getQuatJ(){return 0;} float getQuatK(){return 0;} float getQuatReal(){return real;} };
struct Service { unsigned long quaternionReports=1,lastQuaternionMs=100; bool ready=true; bool canAlignNorth(unsigned long)const{return ready;} };
struct Prefs { bool fail=false; int writes=0; size_t putFloat(const char* key,float value){++writes;TEST_ASSERT_EQUAL_STRING("northOffsetV2",key);TEST_ASSERT_FLOAT_WITHIN(.01,0,value);return fail?0:sizeof(float);} };
void setUp(){} void tearDown(){}
void test_accept_only_after_save(){Imu i;Service s;Prefs p;float offset=75;bool calibrated=false;TEST_ASSERT_EQUAL_STRING("accepted",alignCompassNorth(true,200,i,s,p,offset,calibrated));TEST_ASSERT_TRUE(calibrated);TEST_ASSERT_EQUAL_FLOAT(0,offset);TEST_ASSERT_EQUAL(1,p.writes);}
void test_rejections_preserve_reference(){Imu i;Service s;Prefs p;float offset=75;bool calibrated=true;
 TEST_ASSERT_EQUAL_STRING("sensor_unavailable",alignCompassNorth(false,200,i,s,p,offset,calibrated));
 TEST_ASSERT_EQUAL_STRING("stale_reading",alignCompassNorth(true,1200,i,s,p,offset,calibrated));
 s.ready=false;TEST_ASSERT_EQUAL_STRING("quality_not_ready",alignCompassNorth(true,200,i,s,p,offset,calibrated));
 s.ready=true;i.real=NAN;TEST_ASSERT_EQUAL_STRING("invalid_reading",alignCompassNorth(true,200,i,s,p,offset,calibrated));
 TEST_ASSERT_EQUAL(0,p.writes);i.real=1;p.fail=true;TEST_ASSERT_EQUAL_STRING("storage_failed",alignCompassNorth(true,200,i,s,p,offset,calibrated));
 TEST_ASSERT_EQUAL_FLOAT(75,offset);TEST_ASSERT_TRUE(calibrated);
}
int main(int,char**){UNITY_BEGIN();RUN_TEST(test_accept_only_after_save);RUN_TEST(test_rejections_preserve_reference);return UNITY_END();}
