#include "display_lvgl.h"
#include "display_driver.h"
#include "../screens/screen_main.h"
#include <lvgl.h>
#include <math.h>

static screen_main_t ui;

static lv_disp_draw_buf_t draw_buf;
static lv_disp_drv_t disp_drv;
static lv_color_t buf1[400 * 20];
static lv_color_t buf2[400 * 20];
static bool lvgl_initialized = false;

extern const lv_font_t veetr_logo_48;
extern const lv_font_t veetr_annotation_12;

// ─── Compass geometry helpers (used for custom overlay on top of LVGL meter) ───

static void draw_filled_triangle(int x0, int y0, int x1, int y1, int x2, int y2, bool black) {
    int xs[3] = {x0, x1, x2};
    int ys[3] = {y0, y1, y2};
    int min_y = ys[0], max_y = ys[0];
    for (int i = 1; i < 3; i++) {
        if (ys[i] < min_y) min_y = ys[i];
        if (ys[i] > max_y) max_y = ys[i];
    }
    for (int y = min_y; y <= max_y; y++) {
        int left = 9999, right = -1;
        for (int e = 0; e < 3; e++) {
            int x_a = xs[e], y_a = ys[e];
            int x_b = xs[(e+1)%3], y_b = ys[(e+1)%3];
            if (y_a == y_b) continue;
            if ((y_a <= y && y < y_b) || (y_b <= y && y < y_a)) {
                int x = x_a + (int)((float)(x_b - x_a) * (float)(y - y_a) / (float)(y_b - y_a));
                if (x < left) left = x;
                if (x > right) right = x;
            }
        }
        if (left <= right)
            display_draw_line(left, y, right, y, black);
    }
}

static void draw_dithered_triangle(int x0, int y0, int x1, int y1, int x2, int y2, bool black) {
    int xs[3] = {x0, x1, x2};
    int ys[3] = {y0, y1, y2};
    int min_y = ys[0], max_y = ys[0];
    for (int i = 1; i < 3; i++) {
        if (ys[i] < min_y) min_y = ys[i];
        if (ys[i] > max_y) max_y = ys[i];
    }
    for (int y = min_y; y <= max_y; y++) {
        int left = 9999, right = -1;
        for (int e = 0; e < 3; e++) {
            int x_a = xs[e], y_a = ys[e];
            int x_b = xs[(e + 1) % 3], y_b = ys[(e + 1) % 3];
            if (y_a == y_b) continue;
            if ((y_a <= y && y < y_b) || (y_b <= y && y < y_a)) {
                int x = x_a + (int)((float)(x_b - x_a) * (float)(y - y_a) / (float)(y_b - y_a));
                if (x < left) left = x;
                if (x > right) right = x;
            }
        }
        for (int x = left; x <= right; x++)
            if (((x + y) & 1) == 0) display_set_pixel(x, y, black);
    }
}

static void draw_dithered_rect(int x, int y, int w, int h, bool black) {
    for (int py = y; py < y + h; py++)
        for (int px = x; px < x + w; px++)
            if (((px + py) & 1) == 0) display_set_pixel(px, py, black);
}

static void draw_disc(int cx, int cy, int r, bool black) {
    for (int y = -r; y <= r; y++)
        for (int x = -r; x <= r; x++)
            if (x * x + y * y <= r * r)
                display_set_pixel(cx + x, cy + y, black);
}

static void draw_round_line(int x0, int y0, int x1, int y1, int stroke, bool black) {
    float dx = (float)(x1 - x0);
    float dy = (float)(y1 - y0);
    float len = sqrtf(dx * dx + dy * dy);
    if (len < 1.0f) return;
    float ux = dx / len;
    float uy = dy / len;
    int half = stroke / 2;
    for (int off = -half; off <= half; off++) {
        int px = (int)roundf(-uy * off);
        int py = (int)roundf(ux * off);
        display_draw_line(x0 + px, y0 + py, x1 + px, y1 + py, black);
    }
    draw_disc(x0, y0, half, black);
    draw_disc(x1, y1, half, black);
}

static void draw_dashed_line(int x0, int y0, int x1, int y1, bool black) {
    float dx = (float)(x1 - x0);
    float dy = (float)(y1 - y0);
    float len = sqrtf(dx * dx + dy * dy);
    if (len < 1.0f) return;

    for (float start = 0.0f; start < len; start += 7.0f) {
        float end = fminf(start + 3.0f, len);
        int sx = x0 + (int)roundf(dx * start / len);
        int sy = y0 + (int)roundf(dy * start / len);
        int ex = x0 + (int)roundf(dx * end / len);
        int ey = y0 + (int)roundf(dy * end / len);
        display_draw_line(sx, sy, ex, ey, black);
    }
}

static void draw_thick_line(int x0, int y0, int x1, int y1, float ux, float uy, int half_width, bool black) {
    for (int off = -half_width; off <= half_width; off++) {
        int px = (int)roundf(uy * off);
        int py = (int)roundf(-ux * off);
        display_draw_line(x0 + px, y0 + py, x1 + px, y1 + py, black);
    }
}

static void draw_wedge_chevron(int base_cx, int base_cy, float ux, float uy, int depth, int half_base, bool black) {
    int inner_x = base_cx - (int)(depth * ux);
    int inner_y = base_cy - (int)(depth * uy);
    int top_x = base_cx + (int)(half_base * uy);
    int top_y = base_cy - (int)(half_base * ux);
    int bot_x = base_cx - (int)(half_base * uy);
    int bot_y = base_cy + (int)(half_base * ux);
    draw_round_line(top_x, top_y, inner_x, inner_y, 2, black);
    draw_round_line(inner_x, inner_y, bot_x, bot_y, 2, black);
}

static void draw_open_wedge(int tip_x, int tip_y, int b1x, int b1y, int b2x, int b2y, int stroke, bool black) {
    draw_round_line(tip_x, tip_y, b1x, b1y, stroke, black);
    draw_round_line(tip_x, tip_y, b2x, b2y, stroke, black);
}

static int normalize_angle(int deg, int fallback) {
    if (deg < 0 || deg > 360) return fallback;
    return deg % 360;
}

static float move_angle_toward(float current, float target, float max_step) {
    float delta = fmodf(target - current + 540.0f, 360.0f) - 180.0f;
    if (fabsf(delta) <= max_step) return target;
    current += delta > 0.0f ? max_step : -max_step;
    if (current < 0.0f) current += 360.0f;
    if (current >= 360.0f) current -= 360.0f;
    return current;
}

// ─── Custom compass overlay drawn on top of LVGL meter ───

static void draw_compass_overlay(const SensorData &data) {
    const bool BLACK = true;
    const int cx = 122, cy = 157, cr = 111;

    static int lastAwa = 135;
    static int lastTwa = 90;
    static bool hasAwa = false;
    static bool hasTwa = false;
    static float shownHeading = 0.0f;
    static float shownAwa = 135.0f;
    static float shownTwa = 90.0f;
    static unsigned long lastFrameMs = 0;
    static bool animationInitialized = false;

    int targetHeading = normalize_angle(data.HDM, 0);
    if (!isnan(data.windSpeed) && data.windSpeed > 0.05f) {
        lastAwa = normalize_angle(data.windAngle, lastAwa);
        hasAwa = true;
    }
    if (!isnan(data.trueWindSpeed) && data.trueWindSpeed > 0.05f) {
        lastTwa = normalize_angle(data.trueWindAngle, lastTwa);
        hasTwa = true;
    }

    unsigned long now = millis();
    float dt = lastFrameMs == 0 ? 0.0f : (now - lastFrameMs) / 1000.0f;
    if (dt > 0.1f) dt = 0.1f;
    lastFrameMs = now;
    if (!animationInitialized) {
        shownHeading = targetHeading;
        shownAwa = lastAwa;
        shownTwa = lastTwa;
        animationInitialized = true;
    } else {
        shownHeading = move_angle_toward(shownHeading, targetHeading, 220.0f * dt);
        shownAwa = move_angle_toward(shownAwa, lastAwa, 240.0f * dt);
        shownTwa = move_angle_toward(shownTwa, lastTwa, 240.0f * dt);
    }

    float heading = shownHeading;
    float awa = shownAwa;
    float twa = shownTwa;
    bool showAwa = hasAwa;
    bool showTwa = hasTwa;
    int diff = abs((int)roundf(awa - twa));
    if (diff > 180) diff = 360 - diff;
    if (diff < 8) showTwa = false;

    // A single clean stroke reads better than a simulated thick ring at 1-bit.
    display_draw_circle(cx, cy, cr, BLACK);

    // Heading reference: filled north marker outside the ring.
    {
        float rad = heading * 3.14159265f / 180.0f;
        float ux = sinf(rad), uy = -cosf(rad);
        int base_cx = cx + (int)(cr * ux);
        int base_cy = cy + (int)(cr * uy);
        int tip_x = cx + (int)((cr + 16) * ux);
        int tip_y = cy + (int)((cr + 16) * uy);
        int half_base = 8;
        int b1x = base_cx + (int)(half_base * uy);
        int b1y = base_cy - (int)(half_base * ux);
        int b2x = base_cx - (int)(half_base * uy);
        int b2y = base_cy + (int)(half_base * ux);
        draw_filled_triangle(tip_x, tip_y, b1x, b1y, b2x, b2y, BLACK);
    }

    // Outer-ring marks every 30 degrees.
    for (int deg = 0; deg < 360; deg += 30) {
        float rad = deg * 3.14159265f / 180.0f;
        int x = cx + (int)((cr - 2) * sinf(rad));
        int y = cy - (int)((cr - 2) * cosf(rad));
        display_set_pixel(x, y, BLACK);
    }

    // No-sail boundaries: fixed +/-40 degrees from the bow.
    for (int side = -1; side <= 1; side += 2) {
        float rad = side * 40.0f * 3.14159265f / 180.0f;
        int tip_x = cx + (int)((cr - 3) * sinf(rad));
        int tip_y = cy - (int)((cr - 3) * cosf(rad));
        draw_dashed_line(cx, cy, tip_x, tip_y, BLACK);
    }

    // Center boat: simple filled silhouette, matching the preview's hierarchy.
    {
        draw_dithered_triangle(cx, cy - 30, cx - 8, cy, cx + 8, cy, BLACK);
        draw_dithered_triangle(cx - 8, cy, cx + 8, cy, cx + 6, cy + 23, BLACK);
        draw_dithered_triangle(cx - 8, cy, cx + 6, cy + 23, cx - 6, cy + 23, BLACK);
    }

    // AWA: filled wedge from the boat toward the wind origin.
    if (showAwa) {
        float rad = awa * 3.14159265f / 180.0f;
        float ux = sinf(rad), uy = -cosf(rad);
        int base_cx = cx + (int)((cr - 1) * ux);
        int base_cy = cy + (int)((cr - 1) * uy);
        int half_base = 7;
        int b1x = base_cx + (int)(half_base * uy);
        int b1y = base_cy - (int)(half_base * ux);
        int b2x = base_cx - (int)(half_base * uy);
        int b2y = base_cy + (int)(half_base * ux);
        draw_filled_triangle(cx, cy, b1x, b1y, b2x, b2y, BLACK);

        // Keep the A label beside the filled wedge instead of obscuring it.
        float label_radius = 0.65f * (cr - 1);
        int label_x = cx + (int)(label_radius * ux + 13.0f * uy) - 3;
        int label_y = cy + (int)(label_radius * uy - 13.0f * ux) - 4;
        display_draw_char(label_x, label_y, 'A', BLACK);
    }

    // TWA: clean filled wedge, distinct from the lighter/dithered boat hull.
    if (showTwa) {
        float rad = twa * 3.14159265f / 180.0f;
        float ux = sinf(rad), uy = -cosf(rad);
        int base_cx = cx + (int)((cr - 1) * ux);
        int base_cy = cy + (int)((cr - 1) * uy);
        int half_base = 8;
        int b1x = base_cx + (int)(half_base * uy);
        int b1y = base_cy - (int)(half_base * ux);
        int b2x = base_cx - (int)(half_base * uy);
        int b2y = base_cy + (int)(half_base * ux);
        int tip_x = cx + (int)(0.72f * cr * ux);
        int tip_y = cy + (int)(0.72f * cr * uy);
        draw_filled_triangle(tip_x, tip_y, b1x, b1y, b2x, b2y, BLACK);
        display_draw_char(base_cx - 10, base_cy - 12, 'T', BLACK);
    }

    // Mast reference, kept above both wind indicators.
    draw_disc(cx, cy, 2, BLACK);
}

// ─── Helper to format speed as a short string ───

static void format_speed(float value, char *buf, size_t len) {
    if (isnan(value) || value < 0.0f) value = 0.0f;
    if (value < 10.0f)
        snprintf(buf, len, "%.1f", value);
    else
        snprintf(buf, len, "%.0f", value > 999.0f ? 999.0f : value);
}

// ─── LVGL flush callback ───

static void flush_cb(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_p) {
    for (int32_t y = area->y1; y <= area->y2; y++) {
        for (int32_t x = area->x1; x <= area->x2; x++) {
            bool black = (color_p->full == 0);
            display_set_pixel(x, y, black);
            color_p++;
        }
    }
    lv_disp_flush_ready(drv);
}

static bool init_lvgl_display() {
    if (!display_init()) return false;
    if (lvgl_initialized) return true;

    lv_init();
    lv_disp_draw_buf_init(&draw_buf, buf1, buf2, 400 * 20);
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = 400;
    disp_drv.ver_res = 300;
    disp_drv.draw_buf = &draw_buf;
    disp_drv.flush_cb = flush_cb;
    disp_drv.color_chroma_key = lv_color_white();
    lv_disp_drv_register(&disp_drv);
    lvgl_initialized = true;
    return true;
}

// ─── Public API ───

void display_boot_splash() {
    if (!init_lvgl_display()) return;

    display_clear();
    lv_obj_t *splash = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(splash, lv_color_white(), 0);
    lv_obj_set_style_border_width(splash, 0, 0);

    lv_obj_t *logo = lv_label_create(splash);
    lv_label_set_text(logo, "VEETR");
    lv_obj_set_style_text_color(logo, lv_color_black(), 0);
    lv_obj_set_style_text_font(logo, &veetr_logo_48, 0);
    lv_obj_align(logo, LV_ALIGN_CENTER, 0, -18);

    lv_obj_t *status = lv_label_create(splash);
    lv_label_set_text(status, "STARTING");
    lv_obj_set_style_text_color(status, lv_color_black(), 0);
    lv_obj_set_style_text_font(status, &veetr_annotation_12, 0);
    lv_obj_align(status, LV_ALIGN_CENTER, 0, 30);

    lv_scr_load(splash);
    lv_task_handler();
    display_update();
}

void display_lvgl_init() {
    if (!init_lvgl_display()) return;

    display_clear();

    ui = screen_main_create();
    lv_scr_load(ui.screen);

    display_update();
}

void display_lvgl_update(const SensorData& data, const DisplayStatus& status) {
    display_clear();

    char buf[16];
    format_speed(data.windSpeed, buf, sizeof(buf));
    lv_label_set_text(ui.aws_value, buf);

    format_speed(data.trueWindSpeed, buf, sizeof(buf));
    lv_label_set_text(ui.tws_value, buf);

    format_speed(data.speed, buf, sizeof(buf));
    lv_label_set_text(ui.sog_value, buf);

    int heading = normalize_angle(data.HDM, 0);
    int heel = isnan(data.tilt) ? 0 : (int)roundf(fabsf(data.tilt));
    snprintf(buf, sizeof(buf), "HDG %03d", heading);
    lv_label_set_text(ui.heading_status, buf);
    snprintf(buf, sizeof(buf), "HEEL %d", heel);
    lv_label_set_text(ui.heel_status, buf);

    snprintf(buf, sizeof(buf), "SAT %d  TMP %.0fC", status.satellites, status.environmentValid ? status.temperatureC : 0.0f);
    lv_label_set_text(ui.gps_status, buf);
    snprintf(buf, sizeof(buf), "%02d:%02d:%02d", status.clockValid ? status.hour : 0, status.clockValid ? status.minute : 0, status.clockValid ? status.second : 0);
    lv_label_set_text(ui.time_status, buf);
    snprintf(buf, sizeof(buf), "%d%%", status.batteryPercent);
    lv_label_set_text(ui.battery_status, buf);
    snprintf(buf, sizeof(buf), "HUM %.0f%%", status.environmentValid ? status.humidityPercent : 0.0f);
    lv_label_set_text(ui.humidity_status, buf);

    // The full framebuffer was cleared above; force static widgets to redraw too.
    lv_obj_invalidate(ui.screen);

    // Process LVGL rendering (flush callback writes to framebuffer)
    lv_task_handler();

    // Custom overlay drawn directly on framebuffer on top of LVGL content
    draw_compass_overlay(data);

    display_update();
}
