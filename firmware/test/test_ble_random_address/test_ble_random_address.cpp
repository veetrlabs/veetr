#include <unity.h>

#include "ble_random_address.h"

void setUp() {}
void tearDown() {}

void test_normalize_random_address_sets_bits() {
  uint8_t addr[6] = {0x00, 0x11, 0x22, 0x33, 0x44, 0x00};

  normalizeRandomBleAddress(addr, sizeof(addr));

  TEST_ASSERT_EQUAL_UINT8(0xC0, addr[5] & 0xC0);
}

void test_normalize_random_address_ignores_short() {
  uint8_t addr[5] = {0};

  normalizeRandomBleAddress(addr, sizeof(addr));

  TEST_ASSERT_EQUAL_UINT8(0x00, addr[4]);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_normalize_random_address_sets_bits);
  RUN_TEST(test_normalize_random_address_ignores_short);
  return UNITY_END();
}
