#include <unity.h>

#include "ota_chunk.h"

void setUp() {}
void tearDown() {}

void test_decode_valid_chunk() {
  String input = "TWFu";
  OtaChunk chunk;
  bool ok = decodeOtaChunk(input, chunk);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_EQUAL_INT(3, chunk.length);
  TEST_ASSERT_EQUAL_UINT8('M', chunk.data[0]);
  TEST_ASSERT_EQUAL_UINT8('a', chunk.data[1]);
  TEST_ASSERT_EQUAL_UINT8('n', chunk.data[2]);

  freeOtaChunk(chunk);
}

void test_decode_empty_fails() {
  String input = "";
  OtaChunk chunk;
  bool ok = decodeOtaChunk(input, chunk);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_EQUAL_INT(0, chunk.length);
}

void test_decode_invalid_length_fails() {
  String input = "abc";
  OtaChunk chunk;
  bool ok = decodeOtaChunk(input, chunk);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_EQUAL_INT(0, chunk.length);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_decode_valid_chunk);
  RUN_TEST(test_decode_empty_fails);
  RUN_TEST(test_decode_invalid_length_fails);
  return UNITY_END();
}

