#include <unity.h>
#include <string.h>

#include "wind_sensor.h"
#include "wind_math.h"

namespace {

static unsigned long fakeMillis = 0;
unsigned long testMillis() { return fakeMillis; }

void noopTx() {}

struct MockSerial {
  uint32_t lastBaud = 0;
  uint32_t lastConfig = 0;
  int lastRx = 0;
  int lastTx = 0;
  int beginCalls = 0;
  int endCalls = 0;

  void begin(uint32_t baud, uint32_t config, int rx, int tx) {
    lastBaud = baud;
    lastConfig = config;
    lastRx = rx;
    lastTx = tx;
    beginCalls++;
  }

  void end() { endCalls++; }

  void print(const char*) {}
  void println(const char*) {}
  void printf(const char*, ...) {}
};

struct MockModbus {
  static constexpr uint8_t ku8MBSuccess = 0x00;

  uint16_t response[4] = {0};
  uint8_t nextResult = ku8MBSuccess;
  uint16_t lastAddr = 0xFFFF;
  uint16_t lastQty = 0xFFFF;
  bool cleared = false;
  int beginCalls = 0;

  void clearResponseBuffer() { cleared = true; }

  uint8_t readHoldingRegisters(uint16_t addr, uint16_t qty) {
    lastAddr = addr;
    lastQty = qty;
    return nextResult;
  }

  uint16_t getResponseBuffer(uint8_t idx) { return response[idx]; }

  template <typename Serial>
  void begin(uint8_t, Serial&) { beginCalls++; }

  void preTransmission(void (*)()) {}
  void postTransmission(void (*)()) {}
};

void floatToRegs(float value, uint16_t& low, uint16_t& high) {
  uint32_t combined = 0;
  memcpy(&combined, &value, sizeof(value));
  low = static_cast<uint16_t>(combined & 0xFFFFu);
  high = static_cast<uint16_t>((combined >> 16) & 0xFFFFu);
}

} // namespace

void setUp() {}
void tearDown() {}

void test_ieee754_format_parses_speed_and_angle() {
  MockModbus modbus;
  MockSerial serial;

  WindSensorReader<MockModbus, MockSerial, MockSerial> reader(
      modbus,
      serial,
      32,
      33,
      noopTx,
      noopTx,
      testMillis,
      0,
      1,
      nullptr);

  uint16_t low = 0;
  uint16_t high = 0;
  floatToRegs(5.5f, low, high);
  modbus.response[0] = 120;  // angle
  modbus.response[1] = low;
  modbus.response[2] = high;

  fakeMillis = 100;
  float speed = 0.0f;
  int angle = 0;

  bool ok = reader.read(speed, angle);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_EQUAL_UINT16(0x0001, modbus.lastAddr);
  TEST_ASSERT_EQUAL_UINT16(4, modbus.lastQty);
  TEST_ASSERT_EQUAL_INT(120, angle);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 5.5f, speed);
  TEST_ASSERT_TRUE(reader.sensorTypeDetected());
}

void test_integer_format_happy_path_direct() {
  MockModbus modbus;
  MockSerial serial;

  WindSensorReader<MockModbus, MockSerial, MockSerial> reader(
      modbus,
      serial,
      32,
      33,
      noopTx,
      noopTx,
      testMillis,
      0,
      1,
      nullptr,
      false);

  modbus.response[0] = 250;  // 2.50 m/s
  modbus.response[1] = 315;  // angle

  fakeMillis = 100;
  float speed = 0.0f;
  int angle = 0;

  bool ok = reader.read(speed, angle);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_EQUAL_UINT16(0x0000, modbus.lastAddr);
  TEST_ASSERT_EQUAL_UINT16(2, modbus.lastQty);
  TEST_ASSERT_EQUAL_INT(315, angle);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 2.50f, speed);
  TEST_ASSERT_EQUAL_INT(0, serial.beginCalls);
  TEST_ASSERT_EQUAL_INT(0, serial.endCalls);
}

void test_integer_format_fallback_after_invalid_ieee() {
  MockModbus modbus;
  MockSerial serial;

  WindSensorReader<MockModbus, MockSerial, MockSerial> reader(
      modbus,
      serial,
      32,
      33,
      noopTx,
      noopTx,
      testMillis,
      0,
      1,
      nullptr);

  modbus.response[0] = 500;  // invalid angle
  modbus.response[1] = 0;
  modbus.response[2] = 0;

  fakeMillis = 100;
  float speed = 0.0f;
  int angle = 0;

  bool ok = reader.read(speed, angle);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_FALSE(reader.useIEEE754Format());
  TEST_ASSERT_EQUAL_INT(1, serial.endCalls);
  TEST_ASSERT_EQUAL_INT(1, serial.beginCalls);
  TEST_ASSERT_EQUAL_UINT32(4800, serial.lastBaud);

  modbus.response[0] = 123;  // speed raw
  modbus.response[1] = 270;  // angle

  fakeMillis = 250;
  ok = reader.read(speed, angle);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_EQUAL_UINT16(0x0000, modbus.lastAddr);
  TEST_ASSERT_EQUAL_UINT16(2, modbus.lastQty);
  TEST_ASSERT_EQUAL_INT(270, angle);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 1.23f, speed);
  TEST_ASSERT_TRUE(reader.sensorTypeDetected());
}

void test_modbus_error_switches_format() {
  MockModbus modbus;
  MockSerial serial;

  WindSensorReader<MockModbus, MockSerial, MockSerial> reader(
      modbus,
      serial,
      32,
      33,
      noopTx,
      noopTx,
      testMillis,
      0,
      1,
      nullptr);

  modbus.nextResult = 0xE2;
  fakeMillis = 150;
  float speed = 0.0f;
  int angle = 0;

  bool ok = reader.read(speed, angle);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_FALSE(reader.useIEEE754Format());
  TEST_ASSERT_EQUAL_INT(1, serial.endCalls);
  TEST_ASSERT_EQUAL_INT(1, serial.beginCalls);
  TEST_ASSERT_EQUAL_UINT32(4800, serial.lastBaud);
}

void test_throttle_prevents_fast_polling() {
  MockModbus modbus;
  MockSerial serial;

  WindSensorReader<MockModbus, MockSerial, MockSerial> reader(
      modbus,
      serial,
      32,
      33,
      noopTx,
      noopTx,
      testMillis,
      0,
      1,
      nullptr);

  fakeMillis = 0;
  float speed = 0.0f;
  int angle = 0;

  bool ok = reader.read(speed, angle);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_EQUAL_UINT16(0xFFFF, modbus.lastAddr);
  TEST_ASSERT_EQUAL_UINT16(0xFFFF, modbus.lastQty);
  TEST_ASSERT_FALSE(modbus.cleared);

  uint16_t low = 0;
  uint16_t high = 0;
  floatToRegs(2.25f, low, high);
  modbus.response[0] = 45;
  modbus.response[1] = low;
  modbus.response[2] = high;

  fakeMillis = 100;
  ok = reader.read(speed, angle);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_EQUAL_INT(45, angle);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 2.25f, speed);
}

void test_throttle_boundary_values() {
  MockModbus modbus;
  MockSerial serial;

  WindSensorReader<MockModbus, MockSerial, MockSerial> reader(
      modbus,
      serial,
      32,
      33,
      noopTx,
      noopTx,
      testMillis,
      0,
      1,
      nullptr);

  fakeMillis = 0;
  float speed = 0.0f;
  int angle = 0;

  bool ok = reader.read(speed, angle);
  TEST_ASSERT_FALSE(ok);

  uint16_t low = 0;
  uint16_t high = 0;
  floatToRegs(1.00f, low, high);
  modbus.response[0] = 0;
  modbus.response[1] = low;
  modbus.response[2] = high;

  fakeMillis = 100;
  ok = reader.read(speed, angle);
  TEST_ASSERT_TRUE(ok);

  fakeMillis = 199;
  ok = reader.read(speed, angle);
  TEST_ASSERT_FALSE(ok);

  fakeMillis = 200;
  ok = reader.read(speed, angle);
  TEST_ASSERT_TRUE(ok);
}

void test_detected_format_does_not_switch_on_error() {
  MockModbus modbus;
  MockSerial serial;

  WindSensorReader<MockModbus, MockSerial, MockSerial> reader(
      modbus,
      serial,
      32,
      33,
      noopTx,
      noopTx,
      testMillis,
      0,
      1,
      nullptr);

  uint16_t low = 0;
  uint16_t high = 0;
  floatToRegs(3.75f, low, high);
  modbus.response[0] = 90;
  modbus.response[1] = low;
  modbus.response[2] = high;

  fakeMillis = 100;
  float speed = 0.0f;
  int angle = 0;

  bool ok = reader.read(speed, angle);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_TRUE(reader.sensorTypeDetected());
  TEST_ASSERT_TRUE(reader.useIEEE754Format());
  TEST_ASSERT_EQUAL_INT(0, serial.beginCalls);
  TEST_ASSERT_EQUAL_INT(0, serial.endCalls);

  modbus.nextResult = 0xE2;
  fakeMillis = 250;
  ok = reader.read(speed, angle);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_TRUE(reader.sensorTypeDetected());
  TEST_ASSERT_TRUE(reader.useIEEE754Format());
  TEST_ASSERT_EQUAL_INT(0, serial.beginCalls);
  TEST_ASSERT_EQUAL_INT(0, serial.endCalls);
}

void test_invalid_ieee_nan_triggers_format_switch() {
  MockModbus modbus;
  MockSerial serial;

  WindSensorReader<MockModbus, MockSerial, MockSerial> reader(
      modbus,
      serial,
      32,
      33,
      noopTx,
      noopTx,
      testMillis,
      0,
      1,
      nullptr);

  float nanValue = NAN;
  uint16_t low = 0;
  uint16_t high = 0;
  floatToRegs(nanValue, low, high);
  modbus.response[0] = 10;
  modbus.response[1] = low;
  modbus.response[2] = high;

  fakeMillis = 100;
  float speed = 0.0f;
  int angle = 0;

  bool ok = reader.read(speed, angle);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_FALSE(reader.useIEEE754Format());
  TEST_ASSERT_EQUAL_INT(1, serial.endCalls);
  TEST_ASSERT_EQUAL_INT(1, serial.beginCalls);
  TEST_ASSERT_EQUAL_UINT32(4800, serial.lastBaud);
}

void test_invalid_integer_angle_switches_back_to_ieee() {
  MockModbus modbus;
  MockSerial serial;

  WindSensorReader<MockModbus, MockSerial, MockSerial> reader(
      modbus,
      serial,
      32,
      33,
      noopTx,
      noopTx,
      testMillis,
      0,
      1,
      nullptr);

  modbus.response[0] = 500;
  modbus.response[1] = 0;
  modbus.response[2] = 0;

  fakeMillis = 100;
  float speed = 0.0f;
  int angle = 0;

  bool ok = reader.read(speed, angle);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_FALSE(reader.useIEEE754Format());

  modbus.response[0] = 100;  // 1.00 m/s
  modbus.response[1] = 400;  // invalid angle

  fakeMillis = 250;
  ok = reader.read(speed, angle);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_TRUE(reader.useIEEE754Format());
  TEST_ASSERT_EQUAL_UINT32(9600, serial.lastBaud);
}

void test_invalid_ieee_speed_out_of_range_switches() {
  MockModbus modbus;
  MockSerial serial;

  WindSensorReader<MockModbus, MockSerial, MockSerial> reader(
      modbus,
      serial,
      32,
      33,
      noopTx,
      noopTx,
      testMillis,
      0,
      1,
      nullptr);

  uint16_t low = 0;
  uint16_t high = 0;
  floatToRegs(60.0f, low, high);
  modbus.response[0] = 45;
  modbus.response[1] = low;
  modbus.response[2] = high;

  fakeMillis = 100;
  float speed = 0.0f;
  int angle = 0;

  bool ok = reader.read(speed, angle);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_FALSE(reader.useIEEE754Format());
  TEST_ASSERT_EQUAL_UINT32(4800, serial.lastBaud);
}

void test_invalid_integer_speed_out_of_range_switches() {
  MockModbus modbus;
  MockSerial serial;

  WindSensorReader<MockModbus, MockSerial, MockSerial> reader(
      modbus,
      serial,
      32,
      33,
      noopTx,
      noopTx,
      testMillis,
      0,
      1,
      nullptr,
      false);

  modbus.response[0] = 6000;  // 60.00 m/s
  modbus.response[1] = 90;

  fakeMillis = 100;
  float speed = 0.0f;
  int angle = 0;

  bool ok = reader.read(speed, angle);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_TRUE(reader.useIEEE754Format());
  TEST_ASSERT_EQUAL_UINT32(9600, serial.lastBaud);
}

void test_true_wind_calculation_known_cases() {
  float tws = 0.0f;
  int twa = 0;

  calculateTrueWind(0.0f, 90, 10.0f, tws, twa);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 10.0f, tws);
  TEST_ASSERT_EQUAL_INT(90, twa);

  calculateTrueWind(5.0f, 0, 5.0f, tws, twa);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.0f, tws);
  TEST_ASSERT_EQUAL_INT(0, twa);

  calculateTrueWind(5.0f, 180, 10.0f, tws, twa);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 15.0f, tws);
  TEST_ASSERT_EQUAL_INT(180, twa);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_ieee754_format_parses_speed_and_angle);
  RUN_TEST(test_integer_format_happy_path_direct);
  RUN_TEST(test_integer_format_fallback_after_invalid_ieee);
  RUN_TEST(test_modbus_error_switches_format);
  RUN_TEST(test_throttle_prevents_fast_polling);
  RUN_TEST(test_throttle_boundary_values);
  RUN_TEST(test_detected_format_does_not_switch_on_error);
  RUN_TEST(test_invalid_ieee_nan_triggers_format_switch);
  RUN_TEST(test_invalid_integer_angle_switches_back_to_ieee);
  RUN_TEST(test_invalid_ieee_speed_out_of_range_switches);
  RUN_TEST(test_invalid_integer_speed_out_of_range_switches);
  RUN_TEST(test_true_wind_calculation_known_cases);
  return UNITY_END();
}
