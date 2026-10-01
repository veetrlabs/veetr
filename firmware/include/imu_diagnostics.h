#pragma once
#include <stdint.h>
#include <math.h>

// Temporary report subscriptions only. Never changes calibration or saves DCD.
class ImuDiagnostics {
 public:
  float mx=NAN,my=NAN,mz=NAN,gx=NAN,gy=NAN,gz=NAN,bx=NAN,by=NAN,bz=NAN;
  int mq=0,gq=0,cal=-1;
  unsigned long magAt=0,gyroAt=0,calAt=0;
  bool active=false;
  template<class Imu> void request(Imu& imu,unsigned long now) {
    touched=now;
    if (!active) {
      active=true;magAt=gyroAt=calAt=0;cal=-1;
      imu.enableMagnetometer(100);imu.enableUncalibratedGyro(100);
    }
    expected=imu.commandSequenceNumber;waiting=true;
    imu.requestCalibrationStatus();
  }
  template<class Imu> void stop(Imu& imu) {
    if(active){imu.enableMagnetometer(0);imu.enableUncalibratedGyro(0);}
    active=false;waiting=false;magAt=gyroAt=calAt=0;cal=-1;
  }
  template<class Imu> void tick(Imu& imu,unsigned long now,bool allowed) {
    if(active&&(!allowed||now-touched>8000))stop(imu);
  }
  template<class Imu> void observe(Imu& imu,uint16_t report,unsigned long now) {
    if(!active)return;
    if(report==3){mx=imu.getMagX();my=imu.getMagY();mz=imu.getMagZ();mq=imu.getMagAccuracy();magAt=now;}
    if(report==7){gx=imu.getUncalibratedGyroX();gy=imu.getUncalibratedGyroY();gz=imu.getUncalibratedGyroZ();
      bx=imu.getUncalibratedGyroBiasX();by=imu.getUncalibratedGyroBiasY();bz=imu.getUncalibratedGyroBiasZ();
      gq=imu.getUncalibratedGyroAccuracy();gyroAt=now;}
    if(report==0xf1&&waiting&&imu.shtpHeader[2]==2&&imu.shtpData[2]==7&&imu.shtpData[3]==expected){
      waiting=false;
      if(imu.shtpData[5]==0&&imu.shtpData[6]<=1&&imu.shtpData[7]<=1&&imu.shtpData[8]<=1){
        cal=imu.shtpData[6]|(imu.shtpData[7]<<1)|(imu.shtpData[8]<<2);calAt=now;
      }else{cal=-1;calAt=0;}
    }
  }
 private:
  unsigned long touched=0;
  bool waiting=false;uint8_t expected=0;
};
