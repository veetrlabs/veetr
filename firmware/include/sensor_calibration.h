#pragma once
#include <stdint.h>
#include <string.h>
// Runs exclusively on the sensor task. BLE callbacks only enqueue commands.
class SensorCalibration {
 public:
  const char* state = "idle";
  uint8_t mag = 0, accel = 0, gyro = 0;
  bool active = false;
  unsigned long lastMag = 0;
  template<class Imu> void command(unsigned int op, Imu& imu, unsigned long now) {
    if (op == 2) { heartbeat = now; return; }
    if (op == 1 && !active) {
      mag = accel = gyro = 0; lastMag = 0; started = heartbeat = pendingSince = now;
      restoring = false; active = true; state = "starting"; waiting = 7; expected = imu.commandSequenceNumber;
      imu.calibrateAll(); return;
    }
    if (op == 3 && active && stateIs("running") && ready(now)) {
      state = "saving"; waiting = 6; expected = imu.commandSequenceNumber; pendingSince = now;
      imu.saveCalibration(); return;
    }
    if (op == 4 && active && !restoring && !stateIs("saving")) finish(imu, "cancelled", now);
  }
  bool ready(unsigned long now) const { return active && !restoring && stateIs("running") && mag >= 2 && lastMag && now-lastMag < 1000 && now-started >= 15000; }
  template<class Imu> void tick(Imu& imu, unsigned long now, bool connected) {
    if (!active) return;
    // Save may already be in progress on the chip; await its response even on disconnect.
    if (!restoring && !stateIs("saving") && (!connected || now-heartbeat>10000 || now-started>600000)) { finish(imu,"cancelled",now); return; }
    if (waiting && now-pendingSince>5000) {
      if (restoring) complete(imu,"unconfirmed");
      else finish(imu,"unconfirmed",now);
      return;
    }
    const auto report=imu.getReadings();
    if (report==0xF1 && waiting && imu.shtpHeader[2]==2 && imu.shtpData[2]==waiting && imu.shtpData[3]==expected) {
      const auto command=waiting; waiting=0;
      if (restoring) {complete(imu,imu.shtpData[5]==0 ? result_ : "unconfirmed");return;}
      if (imu.shtpData[5]!=0) {finish(imu,"failed",now);return;}
      if (command==6) {finish(imu,"saved",now);return;}
      imu.enableRotationVector(0); imu.enableGameRotationVector(100);
      imu.enableMagnetometer(20); imu.enableAccelerometer(50); imu.enableGyro(50);
      state="running";
    } else if (report==0x03) {mag=imu.getMagAccuracy();lastMag=now;}
    else if (report==0x01) accel=imu.getAccelAccuracy();
    else if (report==0x02) gyro=imu.getGyroAccuracy();
  }
 private:
  bool restoring=false;
  const char* result_="idle";
  uint8_t waiting=0, expected=0;
  unsigned long started=0, heartbeat=0, pendingSince=0;
  bool stateIs(const char* value) const { return strcmp(state,value)==0; }
  template<class Imu> void finish(Imu& imu,const char* result,unsigned long now) {
    // Restore BNO08x's normal accel+mag calibration policy; gyro dynamic
    // calibration is only enabled for the guided stationary/motion procedure.
    // endCalibration() disables ALL three and does not restore the boot policy.
    restoring=true; result_=result; pendingSince=now;
    waiting=7; expected=imu.commandSequenceNumber;
    for (uint8_t x=3;x<12;++x) imu.shtpData[x]=0;
    imu.shtpData[3]=1; // accelerometer calibration
    imu.shtpData[5]=1; // magnetometer calibration
    imu.sendCommand(7); // Configure ME Calibration, subcommand 0
    // Keep the existing protocol states while waiting for the restore ACK.
    state=strcmp(result,"saved")==0 ? "saving" : "starting";
  }
  template<class Imu> void complete(Imu& imu,const char* result) {
    imu.enableMagnetometer(0); imu.enableGameRotationVector(0); imu.enableGyro(0);
    imu.enableRotationVector(100); imu.enableAccelerometer(50);
    active=false;restoring=false;waiting=0;state=result;
  }
};
