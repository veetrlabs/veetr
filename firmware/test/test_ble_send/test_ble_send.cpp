#include <unity.h>

#include "ble_send.h"

namespace {

static unsigned long fakeMillis = 0;
unsigned long testMillis() { return fakeMillis; }

void testDelay(unsigned long ms) { fakeMillis += ms; }

struct MockCharacteristic {
  uint8_t lastValue[64] = {0};
  size_t lastLen = 0;
  int notifyCalls = 0;
  bool setValueOk = true;
};

bool mockSetValue(void* characteristic, const uint8_t* value, size_t len) {
  auto* ch = static_cast<MockCharacteristic*>(characteristic);
  if (!ch->setValueOk) {
    return false;
  }
  ch->lastLen = len > sizeof(ch->lastValue) ? sizeof(ch->lastValue) : len;
  memcpy(ch->lastValue, value, ch->lastLen);
  return true;
}

void mockNotify(void* characteristic) {
  auto* ch = static_cast<MockCharacteristic*>(characteristic);
  ch->notifyCalls++;
}

} // namespace

void setUp() {}
void tearDown() {}

void test_send_fails_without_server_or_characteristic() {
  bool sending = false;
  String data = "{";

  bool ok = safeBleSendCore(nullptr,
                            0,
                            nullptr,
                            sending,
                            data,
                            false,
                            testMillis,
                            testDelay,
                            mockSetValue,
                            mockNotify);

  TEST_ASSERT_FALSE(ok);
}

void test_send_fails_when_already_sending_and_timeout() {
  bool sending = true;
  MockCharacteristic ch;
  String data = "{}";
  fakeMillis = 0;

  bool ok = safeBleSendCore(reinterpret_cast<void*>(0x1),
                            1,
                            &ch,
                            sending,
                            data,
                            false,
                            testMillis,
                            testDelay,
                            mockSetValue,
                            mockNotify);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_TRUE(sending);
}

void test_send_succeeds_and_notifies() {
  bool sending = false;
  MockCharacteristic ch;
  String data = "{" "\"x\"" ":1}";
  fakeMillis = 0;

  bool ok = safeBleSendCore(reinterpret_cast<void*>(0x1),
                            1,
                            &ch,
                            sending,
                            data,
                            true,
                            testMillis,
                            testDelay,
                            mockSetValue,
                            mockNotify);

  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_EQUAL_INT(1, ch.notifyCalls);
  TEST_ASSERT_EQUAL_UINT8(data.length(), ch.lastLen);
}

void test_send_fails_when_set_value_fails() {
  bool sending = false;
  MockCharacteristic ch;
  ch.setValueOk = false;
  String data = "{}";

  bool ok = safeBleSendCore(reinterpret_cast<void*>(0x1),
                            1,
                            &ch,
                            sending,
                            data,
                            false,
                            testMillis,
                            testDelay,
                            mockSetValue,
                            mockNotify);

  TEST_ASSERT_FALSE(ok);
  TEST_ASSERT_EQUAL_INT(0, ch.notifyCalls);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_send_fails_without_server_or_characteristic);
  RUN_TEST(test_send_fails_when_already_sending_and_timeout);
  RUN_TEST(test_send_succeeds_and_notifies);
  RUN_TEST(test_send_fails_when_set_value_fails);
  return UNITY_END();
}
