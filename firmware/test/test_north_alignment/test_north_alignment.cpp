#include <unity.h>
#include "north_alignment.h"
struct Imu { float real=1,k=0; float getQuatI(){return 0;} float getQuatJ(){return 0;} float getQuatK(){return k;} float getQuatReal(){return real;} };
struct Service { unsigned long quaternionReports=1,lastQuaternionMs=100; bool ready=true; bool canAlignNorth(unsigned long)const{return ready;} };
struct Prefs { bool fail=false,v2=false,legacy=false; float saved=0; int writes=0; bool isKey(const char*){return v2;} bool getBool(const char*,bool){return legacy;} float getFloat(const char*,float){return saved;} size_t putFloat(const char* key,float value){++writes;TEST_ASSERT_EQUAL_STRING("northOffsetV2",key);if(!fail){saved=value;v2=true;}return fail?0:sizeof(float);} };
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
void test_old_reference_and_new_save_preserve_north() {
 Prefs p;float offset=0;
 p.v2=true;p.saved=90;
 TEST_ASSERT_TRUE(loadCompassNorth(p,offset));TEST_ASSERT_EQUAL_FLOAT(270,offset);
 p.v2=false;p.legacy=true;p.saved=350;
 TEST_ASSERT_TRUE(loadCompassNorth(p,offset));TEST_ASSERT_EQUAL_FLOAT(10,offset);
 Imu i;i.k=sinf(kPi/4);i.real=cosf(kPi/4);Service service;bool calibrated=false;
 TEST_ASSERT_EQUAL_STRING("accepted",alignCompassNorth(true,200,i,service,p,offset,calibrated));
 TEST_ASSERT_FLOAT_WITHIN(.01,270,offset);TEST_ASSERT_FLOAT_WITHIN(.01,90,p.saved);
 float reloaded=0;TEST_ASSERT_TRUE(loadCompassNorth(p,reloaded));TEST_ASSERT_EQUAL_FLOAT(offset,reloaded);
 float heading;computeHeadingDegreesFromQuaternion(0,0,sinf(kPi/3),cosf(kPi/3),heading);
 // From the saved reference a further 30-degree left turn is heading 330.
 TEST_ASSERT_FLOAT_WITHIN(.01,330,fmodf(heading-reloaded+360,360));
}
void test_missing_or_invalid_reference_is_not_loaded() {
 Prefs p;float offset=75;TEST_ASSERT_FALSE(loadCompassNorth(p,offset));
 p.v2=true;p.saved=NAN;TEST_ASSERT_FALSE(loadCompassNorth(p,offset));
 TEST_ASSERT_EQUAL_FLOAT(75,offset);
}
int main(int,char**){UNITY_BEGIN();RUN_TEST(test_old_reference_and_new_save_preserve_north);RUN_TEST(test_missing_or_invalid_reference_is_not_loaded);RUN_TEST(test_accept_only_after_save);RUN_TEST(test_rejections_preserve_reference);return UNITY_END();}
