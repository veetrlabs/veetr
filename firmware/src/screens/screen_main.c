#include "screen_main.h"
#include <math.h>

extern const lv_font_t veetr_value_83;
extern const lv_font_t veetr_annotation_12;

screen_main_t screen_main_create(void) {
    screen_main_t ui;

    lv_obj_t * scr = lv_obj_create(NULL);
    lv_obj_set_style_width(scr, 400, 0);
    lv_obj_set_style_height(scr, 300, 0);
    lv_obj_set_style_border_width(scr, 0, 0);
    lv_obj_set_style_bg_color(scr, lv_color_white(), 0);
    lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(scr, LV_SCROLLBAR_MODE_OFF);

    ui.screen = scr;

    ui.gps_status = lv_label_create(scr);
    lv_obj_set_pos(ui.gps_status, 26, 0);
    lv_label_set_text(ui.gps_status, "-68dB  SAT 12  TMP 22C");
    lv_obj_set_style_text_font(ui.gps_status, &veetr_annotation_12, 0);
    lv_obj_set_style_text_color(ui.gps_status, lv_color_black(), 0);

    const int gps_bar_x[] = {8, 13, 18};
    const int gps_bar_y[] = {11, 8, 5};
    const int gps_bar_h[] = {4, 7, 10};
    for (int i = 0; i < 3; i++) {
        lv_obj_t *bar = lv_obj_create(scr);
        lv_obj_set_pos(bar, gps_bar_x[i], gps_bar_y[i]);
        lv_obj_set_size(bar, 3, gps_bar_h[i]);
        lv_obj_set_style_bg_color(bar, lv_color_black(), 0);
        lv_obj_set_style_bg_opa(bar, LV_OPA_COVER, 0);
        lv_obj_set_style_border_width(bar, 0, 0);
    }

    ui.battery_status = lv_label_create(scr);
    lv_obj_set_pos(ui.battery_status, 32, 30);
    lv_label_set_text(ui.battery_status, "87%");
    lv_obj_set_style_text_font(ui.battery_status, &veetr_annotation_12, 0);
    lv_obj_set_style_text_color(ui.battery_status, lv_color_black(), 0);

    ui.time_status = lv_label_create(scr);
    lv_obj_set_pos(ui.time_status, 8, 17);
    lv_label_set_text(ui.time_status, "12:34:56");
    lv_obj_set_style_text_font(ui.time_status, &veetr_annotation_12, 0);
    lv_obj_set_style_text_color(ui.time_status, lv_color_black(), 0);

    lv_obj_t *battery_outline = lv_obj_create(scr);
    lv_obj_set_pos(battery_outline, 8, 31);
    lv_obj_set_size(battery_outline, 18, 9);
    lv_obj_set_style_bg_opa(battery_outline, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(battery_outline, 1, 0);
    lv_obj_set_style_border_color(battery_outline, lv_color_black(), 0);

    lv_obj_t *battery_terminal = lv_obj_create(scr);
    lv_obj_set_pos(battery_terminal, 26, 34);
    lv_obj_set_size(battery_terminal, 2, 3);
    lv_obj_set_style_bg_color(battery_terminal, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(battery_terminal, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(battery_terminal, 0, 0);

    lv_obj_t *battery_fill = lv_obj_create(scr);
    lv_obj_set_pos(battery_fill, 10, 33);
    lv_obj_set_size(battery_fill, 12, 5);
    lv_obj_set_style_bg_color(battery_fill, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(battery_fill, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(battery_fill, 0, 0);

    const int bolt_x[] = {16, 14, 16};
    const int bolt_y[] = {33, 35, 37};
    for (int i = 0; i < 3; i++) {
        lv_obj_t *bolt = lv_obj_create(scr);
        lv_obj_set_pos(bolt, bolt_x[i], bolt_y[i]);
        lv_obj_set_size(bolt, 3, 2);
        lv_obj_set_style_bg_color(bolt, lv_color_white(), 0);
        lv_obj_set_style_bg_opa(bolt, LV_OPA_COVER, 0);
        lv_obj_set_style_border_width(bolt, 0, 0);
    }

    ui.heading_status = lv_label_create(scr);
    ui.humidity_status = lv_label_create(scr);
    lv_obj_set_pos(ui.humidity_status, 8, 280);
    lv_label_set_text(ui.humidity_status, "HUM 64%");
    lv_obj_set_style_text_font(ui.humidity_status, &veetr_annotation_12, 0);
    lv_obj_set_style_text_color(ui.humidity_status, lv_color_black(), 0);

    lv_obj_set_pos(ui.heading_status, 78, 280);
    lv_label_set_text(ui.heading_status, "HDG 247");
    lv_obj_set_style_text_font(ui.heading_status, &veetr_annotation_12, 0);
    lv_obj_set_style_text_color(ui.heading_status, lv_color_black(), 0);

    ui.heel_status = lv_label_create(scr);
    lv_obj_set_pos(ui.heel_status, 145, 280);
    lv_label_set_text(ui.heel_status, "HEEL 4");
    lv_obj_set_style_text_font(ui.heel_status, &veetr_annotation_12, 0);
    lv_obj_set_style_text_color(ui.heel_status, lv_color_black(), 0);

    // Compass geometry is drawn directly into the RLCD framebuffer.
    ui.compass = lv_obj_create(scr);
    lv_obj_set_pos(ui.compass, 10, 45);
    lv_obj_set_size(ui.compass, 224, 224);
    lv_obj_set_style_bg_opa(ui.compass, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(ui.compass, 0, 0);

    ui.aws_label = lv_label_create(scr);
    lv_obj_set_pos(ui.aws_label, 264, 10);
    lv_obj_set_width(ui.aws_label, 105);
    lv_label_set_text(ui.aws_label, "AWS");
    lv_obj_set_style_text_color(ui.aws_label, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(ui.aws_label, 0, 0);
    lv_obj_set_style_pad_all(ui.aws_label, 0, 0);
    lv_obj_set_style_text_align(ui.aws_label, LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_set_style_text_font(ui.aws_label, &veetr_annotation_12, 0);

    ui.aws_value = lv_label_create(scr);
    lv_obj_set_pos(ui.aws_value, 250, 21);
    lv_obj_set_width(ui.aws_value, 142);
    lv_label_set_text(ui.aws_value, "0.0");
    lv_obj_set_style_text_color(ui.aws_value, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(ui.aws_value, 0, 0);
    lv_obj_set_style_pad_all(ui.aws_value, 0, 0);
    lv_obj_set_style_text_align(ui.aws_value, LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_set_style_text_font(ui.aws_value, &veetr_value_83, 0);

    ui.aws_kt = lv_label_create(scr);
    lv_obj_set_pos(ui.aws_kt, 378, 8);
    lv_obj_set_pos(ui.aws_kt, 376, 10);
    lv_label_set_text(ui.aws_kt, "kt");
    lv_obj_set_style_text_color(ui.aws_kt, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(ui.aws_kt, 0, 0);
    lv_obj_set_style_pad_all(ui.aws_kt, 0, 0);
    lv_obj_set_style_text_color(ui.aws_kt, lv_color_black(), 0);
    lv_obj_set_style_text_font(ui.aws_kt, &veetr_annotation_12, 0);

    ui.tws_label = lv_label_create(scr);
    lv_obj_set_pos(ui.tws_label, 264, 109);
    lv_obj_set_width(ui.tws_label, 105);
    lv_label_set_text(ui.tws_label, "TWS");
    lv_obj_set_style_text_color(ui.tws_label, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(ui.tws_label, 0, 0);
    lv_obj_set_style_pad_all(ui.tws_label, 0, 0);
    lv_obj_set_style_text_align(ui.tws_label, LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_set_style_text_font(ui.tws_label, &veetr_annotation_12, 0);

    ui.tws_value = lv_label_create(scr);
    lv_obj_set_pos(ui.tws_value, 250, 120);
    lv_obj_set_width(ui.tws_value, 142);
    lv_label_set_text(ui.tws_value, "0.0");
    lv_obj_set_style_text_color(ui.tws_value, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(ui.tws_value, 0, 0);
    lv_obj_set_style_pad_all(ui.tws_value, 0, 0);
    lv_obj_set_style_text_align(ui.tws_value, LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_set_style_text_font(ui.tws_value, &veetr_value_83, 0);

    ui.tws_kt = lv_label_create(scr);
    lv_obj_set_pos(ui.tws_kt, 378, 107);
    lv_obj_set_pos(ui.tws_kt, 376, 109);
    lv_label_set_text(ui.tws_kt, "kt");
    lv_obj_set_style_text_color(ui.tws_kt, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(ui.tws_kt, 0, 0);
    lv_obj_set_style_pad_all(ui.tws_kt, 0, 0);
    lv_obj_set_style_text_color(ui.tws_kt, lv_color_black(), 0);
    lv_obj_set_style_text_font(ui.tws_kt, &veetr_annotation_12, 0);

    ui.sog_label = lv_label_create(scr);
    lv_obj_set_pos(ui.sog_label, 264, 208);
    lv_obj_set_width(ui.sog_label, 105);
    lv_label_set_text(ui.sog_label, "SOG");
    lv_obj_set_style_text_color(ui.sog_label, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(ui.sog_label, 0, 0);
    lv_obj_set_style_pad_all(ui.sog_label, 0, 0);
    lv_obj_set_style_text_align(ui.sog_label, LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_set_style_text_font(ui.sog_label, &veetr_annotation_12, 0);

    ui.sog_value = lv_label_create(scr);
    lv_obj_set_pos(ui.sog_value, 250, 219);
    lv_obj_set_width(ui.sog_value, 142);
    lv_label_set_text(ui.sog_value, "0.0");
    lv_obj_set_style_text_color(ui.sog_value, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(ui.sog_value, 0, 0);
    lv_obj_set_style_pad_all(ui.sog_value, 0, 0);
    lv_obj_set_style_text_align(ui.sog_value, LV_TEXT_ALIGN_RIGHT, 0);
    lv_obj_set_style_text_font(ui.sog_value, &veetr_value_83, 0);

    ui.sog_kt = lv_label_create(scr);
    lv_obj_set_pos(ui.sog_kt, 378, 206);
    lv_obj_set_pos(ui.sog_kt, 376, 208);
    lv_label_set_text(ui.sog_kt, "kt");
    lv_obj_set_style_text_color(ui.sog_kt, lv_color_black(), 0);
    lv_obj_set_style_bg_opa(ui.sog_kt, 0, 0);
    lv_obj_set_style_pad_all(ui.sog_kt, 0, 0);
    lv_obj_set_style_text_color(ui.sog_kt, lv_color_black(), 0);
    lv_obj_set_style_text_font(ui.sog_kt, &veetr_annotation_12, 0);

    return ui;
}
