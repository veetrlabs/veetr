#include <unity.h>
#include "sensor_calibration.h"
struct Imu {
 uint8_t commandSequenceNumber=0,shtpHeader[4]={0,0,2,0},shtpData[32]={};
 int saves=0,stops=0; uint8_t restoredAccel=0,restoredGyro=0,restoredMag=0; uint16_t report=0; uint8_t quality=0;
 void calibrateAll(){commandSequenceNumber++;} void saveCalibration(){saves++;commandSequenceNumber++;}
 void sendCommand(uint8_t cmd){TEST_ASSERT_EQUAL(7,cmd);restoredAccel=shtpData[3];restoredGyro=shtpData[4];restoredMag=shtpData[5];commandSequenceNumber++;}
 void enableRotationVector(int){} void enableGameRotationVector(int){} void enableMagnetometer(int){} void enableAccelerometer(int){} void enableGyro(int){}
 uint16_t getReadings(){auto r=report;report=0;return r;}
 uint8_t getMagAccuracy(){return quality;} uint8_t getAccelAccuracy(){return quality;} uint8_t getGyroAccuracy(){return quality;}
 void ack(int command,int seq,int status=0){report=0xf1;shtpData[2]=command;shtpData[3]=seq;shtpData[5]=status;}
};
void setUp(){} void tearDown(){}
void test_calibration_requires_matching_sensor_save_ack(){
 Imu i; SensorCalibration c;c.command(1,i,100);
 TEST_ASSERT_EQUAL_STRING("starting",c.state);
 i.ack(7,1);c.tick(i,101,true);TEST_ASSERT_EQUAL_STRING("starting",c.state);
 i.ack(7,0);c.tick(i,102,true);TEST_ASSERT_EQUAL_STRING("running",c.state);
 c.command(3,i,103);TEST_ASSERT_EQUAL(0,i.saves);
 c.command(2,i,16000);i.report=3;i.quality=2;c.tick(i,16000,true);
 TEST_ASSERT_TRUE(c.ready(16001));c.command(3,i,16001);TEST_ASSERT_EQUAL(1,i.saves);
 i.ack(6,0);c.tick(i,16002,true);TEST_ASSERT_EQUAL_STRING("saving",c.state);
 i.ack(6,1);c.tick(i,16003,true);
 TEST_ASSERT_EQUAL_STRING("saving",c.state);TEST_ASSERT_TRUE(c.active);
 TEST_ASSERT_EQUAL(1,i.restoredAccel);TEST_ASSERT_EQUAL(0,i.restoredGyro);TEST_ASSERT_EQUAL(1,i.restoredMag);
 i.ack(7,1);c.tick(i,16004,true);TEST_ASSERT_EQUAL_STRING("saving",c.state);
 i.ack(7,2);c.tick(i,16005,true);TEST_ASSERT_EQUAL_STRING("saved",c.state);TEST_ASSERT_FALSE(c.active);
}
void test_disconnect_and_timeout_never_claim_saved(){
 Imu i;SensorCalibration c;c.command(1,i,10);c.tick(i,11,false);
 TEST_ASSERT_TRUE(c.active);TEST_ASSERT_EQUAL(0,i.saves);
 i.ack(7,1);c.tick(i,12,false);TEST_ASSERT_EQUAL_STRING("cancelled",c.state);
 c.command(1,i,100);c.command(2,i,5101);c.tick(i,5101,true);
 TEST_ASSERT_TRUE(c.active);c.tick(i,10102,true);TEST_ASSERT_FALSE(c.active);
 TEST_ASSERT_EQUAL_STRING("unconfirmed",c.state);
}
void test_restore_rejection_never_claims_saved(){
 Imu i;SensorCalibration c;c.command(1,i,100);i.ack(7,0);c.tick(i,101,true);
 c.command(2,i,16000);i.report=3;i.quality=2;c.tick(i,16000,true);c.command(3,i,16001);
 i.ack(6,1);c.tick(i,16002,true);i.ack(7,2,1);c.tick(i,16003,true);
 TEST_ASSERT_EQUAL_STRING("unconfirmed",c.state);TEST_ASSERT_FALSE(c.active);
}
int main(){UNITY_BEGIN();RUN_TEST(test_calibration_requires_matching_sensor_save_ack);RUN_TEST(test_disconnect_and_timeout_never_claim_saved);RUN_TEST(test_restore_rejection_never_claims_saved);return UNITY_END();}
