#pragma once
#include "sensor_data.h"

struct DisplayStatus {
    int satellites;
    int batteryPercent;
    float temperatureC;
    float humidityPercent;
    int hour;
    int minute;
    int second;
    bool environmentValid;
    bool clockValid;
    bool usbConnected;
};

void display_lvgl_init();
void display_lvgl_update(const SensorData& data, const DisplayStatus& status);
void display_boot_splash();
