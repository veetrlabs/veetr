#include <Arduino.h>

#define DISCOVERY_LED_PIN 48

void setup() {
  pinMode(DISCOVERY_LED_PIN, OUTPUT);
  digitalWrite(DISCOVERY_LED_PIN, LOW);

  Serial.begin(115200);
  delay(2000);

  Serial.println("\n=== TEST FIRMWARE ===");
  Serial.println("ESP32-S3 RLCD Minimal Test");

  Serial.println("Setup complete, entering loop");
}

void loop() {
  static unsigned long lastToggle = 0;
  unsigned long now = millis();

  if (now - lastToggle >= 500) {
    lastToggle = now;
    digitalWrite(DISCOVERY_LED_PIN, !digitalRead(DISCOVERY_LED_PIN));
    Serial.printf("Blink: %lu\n", now / 1000);
  }
}
