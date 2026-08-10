#include "firmware.h"
#include "firmware_gen.h"

void firmware_init(const char * asset_path)
{
    (void)asset_path;

    firmware_init_gen(asset_path);
    lv_xml_register_image(NULL, "compass_wind_art", compass_wind_art);
}
