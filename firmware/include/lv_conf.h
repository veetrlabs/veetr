#ifndef LV_CONF_H
#define LV_CONF_H

#include <stdint.h>

#define LV_COLOR_DEPTH 1

#define LV_HOR_RES_MAX 400
#define LV_VER_RES_MAX 300

#define LV_MEM_SIZE (48 * 1024)

#define LV_TICK_CUSTOM 1
#define LV_TICK_CUSTOM_INCLUDE "Arduino.h"
#define LV_TICK_CUSTOM_SYS_TIME_EXPR (millis())

#define LV_USE_LABEL 1
#define LV_USE_METER 1
#define LV_USE_XML 1

#define LV_FONT_MONTSERRAT_12 1
#define LV_FONT_MONTSERRAT_10 1
#define LV_FONT_MONTSERRAT_16 1
#define LV_FONT_MONTSERRAT_24 1
#define LV_FONT_MONTSERRAT_28 1
#define LV_FONT_MONTSERRAT_48 1

#define LV_USE_LOG 0
#define LV_DISP_DEF_REFR_PERIOD 30

#define LV_DPI_DEF 130

#endif
