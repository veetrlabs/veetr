#pragma once

// BNO080 IMU - shares onboard I2C bus of RLCD-4.2
// Onboard SHTC3 (0x70) and PCF85063 (0x51) also share this bus.
// BNO080 at 0x4A has no conflict.
#define BNO080_SDA 13
#define BNO080_SCL 14

// RS485 Wind Sensor (UART2)
#define RS485_DE 42
#define RS485_RX 1
#define RS485_TX 17
#define RS485_UART 2

// GPS Module (UART1)
#define GPS_RX 6
#define GPS_TX 7
#define GPS_UART 1

// Discovery Mode - use onboard KEY button (GPIO18, active LOW with pull-up)
#define DISCOVERY_BUTTON_PIN 18
#define DISCOVERY_LED_PIN 48
#define DISCOVERY_TIMEOUT_MS (5 * 60 * 1000)

// Anchor Light
#define ANCHOR_LIGHT_PIN 47

// Display - ST7305 RLCD (SPI)
#define DISPLAY_CLK 11
#define DISPLAY_MOSI 12
#define DISPLAY_CS 40
#define DISPLAY_DC 5
#define DISPLAY_RST 41
