#pragma once

// BNO080 IMU (I2C)
#define BNO080_SDA 21
#define BNO080_SCL 22

// RS485 Wind Sensor (UART2)
#define RS485_DE 14
#define RS485_RX 32
#define RS485_TX 33
#define RS485_UART 2

// GPS Module (UART1)
#define GPS_RX 17
#define GPS_TX 16
#define GPS_UART 1

// Discovery Mode
#define DISCOVERY_BUTTON_PIN 0      // BOOT button
#define DISCOVERY_LED_PIN 2         // Built-in LED
#define DISCOVERY_TIMEOUT_MS (5 * 60 * 1000)

// Anchor Light
#define ANCHOR_LIGHT_PIN 25
