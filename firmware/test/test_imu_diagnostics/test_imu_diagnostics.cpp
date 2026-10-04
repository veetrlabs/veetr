#include <unity.h>
#include "imu_diagnostics.h"
struct Imu {
 uint8_t commandSequenceNumber=0,shtpHeader[4]={0,0,2,0},shtpData[16]={};
 int magRate=0,gyroRate=0,queries=0;
 void enableMagnetometer(int rate){magRate=rate;}void enableUncalibratedGyro(int rate){gyroRate=rate;}
 void requestCalibrationStatus(){queries++;commandSequenceNumber++;}
 float getMagX(){return 20;}float getMagY(){return -10;}float getMagZ(){return 30;}int getMagAccuracy(){return 1;}
 float getUncalibratedGyroX(){return .1;}float getUncalibratedGyroY(){return .2;}float getUncalibratedGyroZ(){return .3;}
 float getUncalibratedGyroBiasX(){return .01;}float getUncalibratedGyroBiasY(){return .02;}float getUncalibratedGyroBiasZ(){return .03;}int getUncalibratedGyroAccuracy(){return 2;}
};
void setUp(){}void tearDown(){}
void test_reports_expire_without_changing_calibration(){
 Imu i;ImuDiagnostics d;d.request(i,100);TEST_ASSERT_EQUAL(100,i.magRate);TEST_ASSERT_EQUAL(1,i.queries);
 d.observe(i,3,110);d.observe(i,7,120);TEST_ASSERT_FLOAT_WITHIN(.001,-10,d.my);TEST_ASSERT_FLOAT_WITHIN(.001,.03,d.bz);
 TEST_ASSERT_EQUAL(110,d.magAt);TEST_ASSERT_EQUAL(120,d.gyroAt);
 d.tick(i,8100,true);TEST_ASSERT_TRUE(d.active);d.tick(i,8101,true);TEST_ASSERT_FALSE(d.active);TEST_ASSERT_EQUAL(0,i.magRate);TEST_ASSERT_EQUAL(0,i.gyroRate);TEST_ASSERT_EQUAL(0,d.magAt);
}
void test_status_requires_matching_successful_response(){
 Imu i;ImuDiagnostics d;d.request(i,100);
 i.shtpData[2]=7;i.shtpData[3]=1;i.shtpData[6]=1;i.shtpData[8]=1;
 d.observe(i,0xf1,110);TEST_ASSERT_EQUAL(-1,d.cal);
 i.shtpData[3]=0;d.observe(i,0xf1,120);TEST_ASSERT_EQUAL(5,d.cal);TEST_ASSERT_EQUAL(120,d.calAt);
 d.request(i,200);i.shtpData[3]=1;i.shtpData[5]=1;d.observe(i,0xf1,210);TEST_ASSERT_EQUAL(-1,d.cal);
 d.tick(i,220,false);TEST_ASSERT_FALSE(d.active);
}
int main(){UNITY_BEGIN();RUN_TEST(test_reports_expire_without_changing_calibration);RUN_TEST(test_status_requires_matching_successful_response);return UNITY_END();}
