#include <unity.h>
#include "imu_service.h"
static unsigned long clockMs;
static int stored;
static unsigned long now() { return clockMs; }
static void store(float, float, float) { ++stored; }
struct MockImu {
  int remaining = 0;
  int report = 5;
  int accelEnables = 0;
  int rotationEnables = 0;
  uint16_t getReadings() { if (remaining <= 0) return 0; --remaining; return report; }
  float getQuatI() { return 0; }
  float getQuatJ() { return 0; }
  float getQuatK() { return 0; }
  float getQuatReal() { return 1; }
  float getAccelX() { return 0; }
  float getAccelY() { return 0; }
  float getAccelZ() { return 9.81; }
  void enableAccelerometer(int) { ++accelEnables; }
  void enableRotationVector(int) { ++rotationEnables; }
};
void setUp() { clockMs = 100; stored = 0; }
void tearDown() {}
void test_drains_queue_and_only_stores_fresh_accel() {
  ImuService service; MockImu imu; SensorData data = {};
  imu.remaining = 4;
  service.poll(imu, data, now, 0, 0, 0, false, store);
  TEST_ASSERT_EQUAL(4, service.quaternionReports);
  TEST_ASSERT_EQUAL(0, stored);
  TEST_ASSERT_EQUAL(1, imu.accelEnables);
  clockMs += 10; imu.report = 1; imu.remaining = 3;
  service.poll(imu, data, now, 0, 0, 0, false, store);
  TEST_ASSERT_EQUAL(3, stored);
  TEST_ASSERT_EQUAL(3, service.accelReports);
}
void test_bounded_drain_and_poll_interval() {
  ImuService service; MockImu imu; SensorData data = {};
  imu.remaining = 100;
  service.poll(imu, data, now, 0, 0, 0, false, store);
  TEST_ASSERT_EQUAL(92, imu.remaining);
  service.poll(imu, data, now, 0, 0, 0, false, store);
  TEST_ASSERT_EQUAL(92, imu.remaining);
}
void test_accel_traffic_does_not_mask_stale_heading() {
  ImuService service; MockImu imu; SensorData data = {};
  imu.remaining = 1;
  service.poll(imu, data, now, 0, 0, 0, false, store);
  clockMs = 6000; imu.report = 1; imu.remaining = 1;
  service.poll(imu, data, now, 0, 0, 0, false, store);
  TEST_ASSERT_EQUAL(-1, data.HDM);
  TEST_ASSERT_EQUAL(1, imu.rotationEnables);
  TEST_ASSERT_EQUAL(1, stored);
}
void test_polling_through_two_second_modbus_wait_keeps_up() {
  ImuService service; MockImu imu; SensorData data = {};
  for (clockMs = 100; clockMs < 2100; clockMs += 10) {
    if (clockMs % 100 == 0) { imu.report = 5; imu.remaining = 1; }
    service.poll(imu, data, now, 0, 0, 0, false, store);
  }
  TEST_ASSERT_EQUAL(20, service.quaternionReports);
  TEST_ASSERT_EQUAL(2000, service.lastQuaternionMs);
}
int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_drains_queue_and_only_stores_fresh_accel);
  RUN_TEST(test_bounded_drain_and_poll_interval);
  RUN_TEST(test_accel_traffic_does_not_mask_stale_heading);
  RUN_TEST(test_polling_through_two_second_modbus_wait_keeps_up);
  return UNITY_END();
}
