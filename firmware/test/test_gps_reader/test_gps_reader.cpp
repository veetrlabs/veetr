#include <unity.h>

#include "gps_reader.h"

namespace {

struct FakeSerial {
  int availableCount = 0;
  int reads = 0;
  int available() { return availableCount - reads; }
  int read() { return reads++; }
};

struct FakeGps {
  int encodeCalls = 0;
  int trueEvery = 1;
  bool encode(int) {
    encodeCalls++;
    return (encodeCalls % trueEvery) == 0;
  }
};

} // namespace

void setUp() {}
void tearDown() {}

void test_reads_up_to_limit() {
  FakeSerial serial;
  FakeGps gps;
  serial.availableCount = 300;

  GpsReadResult result = readGpsStream(serial, gps, 256);

  TEST_ASSERT_EQUAL_INT(256, result.bytesRead);
  TEST_ASSERT_EQUAL_INT(256, gps.encodeCalls);
}

void test_reads_all_available_if_below_limit() {
  FakeSerial serial;
  FakeGps gps;
  serial.availableCount = 10;

  GpsReadResult result = readGpsStream(serial, gps, 256);

  TEST_ASSERT_EQUAL_INT(10, result.bytesRead);
  TEST_ASSERT_EQUAL_INT(10, gps.encodeCalls);
}

void test_new_data_flag_when_encode_true() {
  FakeSerial serial;
  FakeGps gps;
  gps.trueEvery = 2;
  serial.availableCount = 3;

  GpsReadResult result = readGpsStream(serial, gps, 256);

  TEST_ASSERT_TRUE(result.newData);
}

void test_new_data_false_when_encode_never_true() {
  FakeSerial serial;
  FakeGps gps;
  gps.trueEvery = 999;
  serial.availableCount = 3;

  GpsReadResult result = readGpsStream(serial, gps, 256);

  TEST_ASSERT_FALSE(result.newData);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_reads_up_to_limit);
  RUN_TEST(test_reads_all_available_if_below_limit);
  RUN_TEST(test_new_data_flag_when_encode_true);
  RUN_TEST(test_new_data_false_when_encode_never_true);
  return UNITY_END();
}

