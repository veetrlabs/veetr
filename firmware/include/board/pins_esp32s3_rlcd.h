#pragma once

//
// Pin assignment for Waveshare ESP32-S3-RLCD-4.2
//
// All external sensor/actuator signals are routed to the
// 2×8 expansion header (P1) so no soldering to the module
// edge castellations is required.
//
// Header P1 pinout (verified from schematic netlist):
//   Pin  1: VCC3V3          Pin  2: VBUS (5V USB)
//   Pin  3: GND             Pin  4: GND
//   Pin  5: GPIO0 (BOOT)    Pin  6: GPIO19 (USB D-)
//   Pin  7: GPIO1           Pin  8: GPIO20 (USB D+)
//   Pin  9: GPIO2           Pin 10: GPIO43 (U0TXD)
//   Pin 11: GPIO3 (SD CS)   Pin 12: GPIO44 (U0RXD)
//   Pin 13: GPIO17          Pin 14: GPIO13 (I2C SDA)
//   Pin 15: GPIO18 (KEY)    Pin 16: GPIO14 (I2C SCL)
//

// --- Onboard peripherals (do not reassign) ---
// I2C bus:          SDA=GPIO13  SCL=GPIO14  (P1-14, P1-16)
// KEY button:       GPIO18     (P1-15)
// BOOT button:      GPIO0      (P1-5)
// USB Serial/JTAG:  GPIO19/20  (P1-6, P1-8)
// SD card CS:       GPIO3      (P1-11)
// Display:          GPIO5,6,11,12,40,41
// Audio/I2S:        GPIO8,9,10,16,45,46
// Battery ADC:      GPIO4

// BNO080 IMU - shares onboard I2C bus (GPIO13/GPIO14 on P1-14, P1-16)
#define BNO080_SDA 13
#define BNO080_SCL 14

// RS485 Wind Sensor (UART2) - all signals on expansion header
// RX=GPIO1 (P1-7), TX=GPIO17 (P1-13)
// DE/RE moved from GPIO42 (not on header) to GPIO3 (P1-11, SD CS — SD card unused)
#define RS485_DE 3
#define RS485_RX 1
#define RS485_TX 17
#define RS485_UART 2

// GPS Module (UART1) - moved from GPIO6/GPIO7 (not on header) to
// GPIO43/GPIO44 (P1-10, P1-12 — U0TXD/U0RXD repurposed).
// Console output still works via USB Serial/JTAG on GPIO19/GPIO20.
#define GPS_RX 44
#define GPS_TX 43
#define GPS_UART 1

// Discovery Mode - onboard KEY button (GPIO18, P1-15, active LOW)
#define DISCOVERY_BUTTON_PIN 18
// Discovery LED moved from GPIO48 (not on header) to GPIO2 (P1-9, free)
#define DISCOVERY_LED_PIN 2
#define DISCOVERY_TIMEOUT_MS (5 * 60 * 1000)

// Anchor Light — moved from GPIO47 (not on header) to GPIO20 (P1-8, USB D+).
// USB Serial/JTAG is not used at runtime (USB only needed for flashing);
// the 22Ω series resistor to the USB-C connector prevents conflict.
#define ANCHOR_LIGHT_PIN 20

// Display - ST7305 RLCD (SPI) — onboard, no change
#define DISPLAY_CLK 11
#define DISPLAY_MOSI 12
#define DISPLAY_CS 40
#define DISPLAY_DC 5
#define DISPLAY_RST 41
