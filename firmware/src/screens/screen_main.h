#pragma once

#include <lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    lv_obj_t * screen;
    lv_obj_t * compass;
    lv_obj_t * gps_status;
    lv_obj_t * battery_status;
    lv_obj_t * time_status;
    lv_obj_t * humidity_status;
    lv_obj_t * heading_status;
    lv_obj_t * heel_status;
    lv_obj_t * aws_label;
    lv_obj_t * aws_value;
    lv_obj_t * aws_kt;
    lv_obj_t * tws_label;
    lv_obj_t * tws_value;
    lv_obj_t * tws_kt;
    lv_obj_t * sog_label;
    lv_obj_t * sog_value;
    lv_obj_t * sog_kt;
} screen_main_t;

screen_main_t screen_main_create(void);

#ifdef __cplusplus
}
#endif
