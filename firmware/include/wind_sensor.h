#pragma once

#include <stdint.h>
#include <math.h>
#include <string.h>

struct WindSensorReading {
  float speed;
  int angle;
  bool ok;
};

template <typename Modbus, typename Serial, typename Debug = void>
class WindSensorReader {
 public:
  WindSensorReader(Modbus& modbus,
                   Serial& serial,
                   int rxPin,
                   int txPin,
                   void (*preTx)(),
                   void (*postTx)(),
                   unsigned long (*millisFn)(),
                   uint32_t serialConfigIEEE,
                   uint32_t serialConfigInt,
                   Debug* debug = nullptr,
                   bool initialIEEE = true)
      : modbus_(modbus),
        serial_(serial),
        rxPin_(rxPin),
        txPin_(txPin),
        preTx_(preTx),
        postTx_(postTx),
        millisFn_(millisFn),
        serialConfigIEEE_(serialConfigIEEE),
        serialConfigInt_(serialConfigInt),
        debug_(debug),
        useIEEE754Format_(initialIEEE) {}

  bool read(float& windSpeed, int& windAngle) {
    // Don't hammer the sensor - minimum 100ms between attempts
    const unsigned long now = millisFn_();
    if (now - lastAttempt_ < 100) {
      return false;
    }
    lastAttempt_ = now;

#ifdef DEBUG_WIND_SENSOR
    if (debug_) {
      debug_->print("[Wind Sensor] Reading ");
      if (useIEEE754Format_) {
        debug_->print("IEEE754 format (9600,8E1,float)... ");
      } else {
        debug_->print("integer format (4800,8N1,int)... ");
      }
      debug_->printf("(took %lums) ", 0UL);
    }
#endif

    modbus_.clearResponseBuffer();

    uint8_t result;
    if (useIEEE754Format_) {
      result = modbus_.readHoldingRegisters(0x0001, 4);
    } else {
      result = modbus_.readHoldingRegisters(0x0000, 2);
    }

    if (result == Modbus::ku8MBSuccess) {
      if (useIEEE754Format_) {
        windAngle = modbus_.getResponseBuffer(0);
        uint16_t speedLow = modbus_.getResponseBuffer(1);
        uint16_t speedHigh = modbus_.getResponseBuffer(2);
        windSpeed = regsToFloat(speedLow, speedHigh);

        if (!sensorTypeDetected_ && (windAngle < 0 || windAngle > 359 ||
                                     isnan(windSpeed) || windSpeed < 0 || windSpeed > 50)) {
          useIEEE754Format_ = false;
          reconfigureSerial();
          return false;
        }
      } else {
        uint16_t speedRaw = modbus_.getResponseBuffer(0);
        windSpeed = speedRaw / 100.0f;
        windAngle = modbus_.getResponseBuffer(1);

        if (!sensorTypeDetected_ && (windAngle < 0 || windAngle > 359 || windSpeed < 0 || windSpeed > 50)) {
          useIEEE754Format_ = true;
          reconfigureSerial();
          return false;
        }
      }

      if (!sensorTypeDetected_ && windAngle >= 0 && windAngle <= 359 &&
          windSpeed >= 0 && windSpeed <= 50 && !isnan(windSpeed)) {
        sensorTypeDetected_ = true;
      }

      return true;
    }

    if (!sensorTypeDetected_) {
      useIEEE754Format_ = !useIEEE754Format_;
      reconfigureSerial();
    }

    return false;
  }

  bool useIEEE754Format() const { return useIEEE754Format_; }
  bool sensorTypeDetected() const { return sensorTypeDetected_; }

 private:
  static float regsToFloat(uint16_t lowReg, uint16_t highReg) {
    uint32_t combined = ((uint32_t)highReg << 16) | lowReg;
    float value;
    memcpy(&value, &combined, sizeof(value));
    return value;
  }

  void reconfigureSerial() {
    serial_.end();
    if (useIEEE754Format_) {
      serial_.begin(9600, serialConfigIEEE_, rxPin_, txPin_);
    } else {
      serial_.begin(4800, serialConfigInt_, rxPin_, txPin_);
    }
    modbus_.begin(1, serial_);
    modbus_.preTransmission(preTx_);
    modbus_.postTransmission(postTx_);
  }

  Modbus& modbus_;
  Serial& serial_;
  int rxPin_;
  int txPin_;
  void (*preTx_)();
  void (*postTx_)();
  unsigned long (*millisFn_)();
  uint32_t serialConfigIEEE_;
  uint32_t serialConfigInt_;
  Debug* debug_;

  unsigned long lastAttempt_ = 0;
  bool sensorTypeDetected_ = false;
  bool useIEEE754Format_ = true;
};
