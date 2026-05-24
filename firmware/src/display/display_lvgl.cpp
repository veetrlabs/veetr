#include "display_lvgl.h"
#include "display_driver.h"
#include "font_6x8.h"
#include <lvgl.h>
#include <math.h>

static lv_disp_draw_buf_t draw_buf;
static lv_disp_drv_t disp_drv;
static lv_color_t buf1[400 * 20];
static lv_color_t buf2[400 * 20];

enum {
    VALUE_DIGIT_W = 30,
    VALUE_DIGIT_H = 76,
    VALUE_STROKE = 5,
    VALUE_GAP = 3,
    VALUE_DOT_W = 7,
};

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

static void draw_arrowhead(int tip_x, int tip_y, float ux, float uy, int len, bool black) {
    int blx = tip_x - (int)(len * ux) - (int)(len * 0.5f * uy);
    int bly = tip_y - (int)(len * uy) + (int)(len * 0.5f * ux);
    int brx = tip_x - (int)(len * ux) + (int)(len * 0.5f * uy);
    int bry = tip_y - (int)(len * uy) - (int)(len * 0.5f * ux);
    draw_filled_triangle(tip_x, tip_y, blx, bly, brx, bry, black);
}

static void draw_dot(int x, int y, int size, bool black) {
    int half = size / 2;
    for (int dy = -half; dy <= half; dy++)
        for (int dx = -half; dx <= half; dx++)
            display_set_pixel(x + dx, y + dy, black);
}

static void draw_disc(int cx, int cy, int r, bool black) {
    for (int y = -r; y <= r; y++) {
        for (int x = -r; x <= r; x++) {
            if (x * x + y * y <= r * r) {
                display_set_pixel(cx + x, cy + y, black);
            }
        }
    }
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

static void draw_segment(int x0, int y0, int x1, int y1, bool black) {
    draw_round_line(x0, y0, x1, y1, VALUE_STROKE, black);
}

static void draw_label_char(int x, int y, char c, int scale, int stroke, bool black) {
    const int l = x;
    const int r = x + 5 * scale;
    const int t = y;
    const int m = y + 3 * scale;
    const int b = y + 7 * scale;
    const int cx = x + (5 * scale) / 2;

    switch (c) {
        case 'A':
            draw_round_line(l, b, cx, t, stroke, black);
            draw_round_line(cx, t, r, b, stroke, black);
            draw_round_line(l + scale, m + scale, r - scale, m + scale, stroke, black);
            break;
        case 'G':
            draw_round_line(r, t + scale, cx, t, stroke, black);
            draw_round_line(cx, t, l, t + scale, stroke, black);
            draw_round_line(l, t + scale, l, b - scale, stroke, black);
            draw_round_line(l, b - scale, cx, b, stroke, black);
            draw_round_line(cx, b, r, b - scale, stroke, black);
            draw_round_line(r, b - scale, r, m + scale, stroke, black);
            draw_round_line(cx, m + scale, r, m + scale, stroke, black);
            break;
        case 'N':
            draw_round_line(l, b, l, t, stroke, black);
            draw_round_line(l, t, r, b, stroke, black);
            draw_round_line(r, b, r, t, stroke, black);
            break;
        case 'O':
            draw_round_line(l, t + scale, l, b - scale, stroke, black);
            draw_round_line(l, t + scale, cx, t, stroke, black);
            draw_round_line(cx, t, r, t + scale, stroke, black);
            draw_round_line(r, t + scale, r, b - scale, stroke, black);
            draw_round_line(r, b - scale, cx, b, stroke, black);
            draw_round_line(cx, b, l, b - scale, stroke, black);
            break;
        case 'S':
            draw_round_line(r, t, l + scale, t, stroke, black);
            draw_round_line(l + scale, t, l, m, stroke, black);
            draw_round_line(l, m, r - scale, m, stroke, black);
            draw_round_line(r - scale, m, r, b, stroke, black);
            draw_round_line(r, b, l, b, stroke, black);
            break;
        case 'T':
            draw_round_line(l, t, r, t, stroke, black);
            draw_round_line(cx, t, cx, b, stroke, black);
            break;
        case 'W':
            draw_round_line(l, t, l + scale, b, stroke, black);
            draw_round_line(l + scale, b, cx, m + scale, stroke, black);
            draw_round_line(cx, m + scale, r - scale, b, stroke, black);
            draw_round_line(r - scale, b, r, t, stroke, black);
            break;
        default:
            break;
    }
}

static void draw_label_text(int x, int y, const char *text, int scale, int stroke, bool black) {
    int cx = x;
    while (*text) {
        draw_label_char(cx, y, *text, scale, stroke, black);
        cx += 6 * scale;
        text++;
    }
}

static void draw_bitmap_char_scaled(int x, int y, unsigned char c, int scale, bool black) {
    if (c < FONT_FIRST_CHAR || c > FONT_LAST_CHAR) return;
    int idx = c - FONT_FIRST_CHAR;
    for (int col = 0; col < FONT_WIDTH; col++) {
        uint8_t byte = font_6x8[idx][col];
        for (int row = 0; row < FONT_HEIGHT; row++) {
            if (byte & (1 << row)) {
                for (int sx = 0; sx < scale; sx++) {
                    for (int sy = 0; sy < scale; sy++) {
                        display_set_pixel(x + col * scale + sx, y + row * scale + sy, black);
                    }
                }
            }
        }
    }
}

static void draw_bitmap_text_scaled(int x, int y, const char *text, int scale, bool black) {
    int cx = x;
    while (*text) {
        draw_bitmap_char_scaled(cx, y, (unsigned char)*text, scale, black);
        cx += (FONT_WIDTH + 1) * scale;
        text++;
    }
}

static void draw_bitmap_text_vertical(int x, int y, const char *text, int scale, bool black) {
    int cy = y;
    while (*text) {
        draw_bitmap_char_scaled(x, cy, (unsigned char)*text, scale, black);
        cy += (FONT_HEIGHT + 1) * scale;
        text++;
    }
}

static void draw_value_digit(int x, int y, char c, bool black) {
    const int l = x + 2;
    const int r = x + VALUE_DIGIT_W - 3;
    const int t = y + 2;
    const int m = y + VALUE_DIGIT_H / 2;
    const int b = y + VALUE_DIGIT_H - 3;

    bool a = false, bseg = false, cseg = false, d = false, e = false, f = false, g = false;
    switch (c) {
        case '0': a = bseg = cseg = d = e = f = true; break;
        case '1': bseg = cseg = true; break;
        case '2': a = bseg = g = e = d = true; break;
        case '3': a = bseg = cseg = d = g = true; break;
        case '4': f = g = bseg = cseg = true; break;
        case '5': a = f = g = cseg = d = true; break;
        case '6': a = f = e = d = cseg = g = true; break;
        case '7': a = bseg = cseg = true; break;
        case '8': a = bseg = cseg = d = e = f = g = true; break;
        case '9': a = bseg = cseg = d = f = g = true; break;
        default: return;
    }

    if (a) draw_segment(l, t, r, t, black);
    if (bseg) draw_segment(r, t, r, m, black);
    if (cseg) draw_segment(r, m, r, b, black);
    if (d) draw_segment(l, b, r, b, black);
    if (e) draw_segment(l, m, l, b, black);
    if (f) draw_segment(l, t, l, m, black);
    if (g) draw_segment(l, m, r, m, black);
}

static void draw_value_text(int x, int y, const char *text) {
    int cx = x;
    while (*text) {
        if (*text == '.') {
            draw_disc(cx + VALUE_DOT_W / 2, y + VALUE_DIGIT_H - 4, 3, true);
            cx += VALUE_DOT_W + VALUE_GAP;
        } else {
            draw_value_digit(cx, y, *text, true);
            cx += VALUE_DIGIT_W + VALUE_GAP;
        }
        text++;
    }
}

static void format_speed(float value, char *buf, size_t len) {
    if (isnan(value) || value < 0.0f) value = 0.0f;
    if (value < 10.0f) {
        snprintf(buf, len, "%.1f", value);
    } else {
        snprintf(buf, len, "%.0f", value > 999.0f ? 999.0f : value);
    }
}

static void draw_speed_readout(int y, const char *label, float value) {
    char buf[16];
    format_speed(value, buf, sizeof(buf));
    const int value_y = y + 10;
    draw_value_text(296, value_y, buf);
    draw_bitmap_text_vertical(376, y + 2, label, 2, true);
    draw_bitmap_text_scaled(374, value_y + VALUE_DIGIT_H - 8, "kt", 1, true);
}

static void draw_thick_line(int x0, int y0, int x1, int y1, float ux, float uy, int half_width, bool black) {
    for (int off = -half_width; off <= half_width; off++) {
        int px = (int)roundf(uy * off);
        int py = (int)roundf(-ux * off);
        display_draw_line(x0 + px, y0 + py, x1 + px, y1 + py, black);
    }
}

static void draw_dashed_line(int x0, int y0, float ux, float uy, int len, int dash, int gap, int half_width, bool black) {
    for (int start = 0; start < len; start += dash + gap) {
        int end = start + dash;
        if (end > len) end = len;
        int sx = x0 + (int)(ux * start);
        int sy = y0 + (int)(uy * start);
        int ex = x0 + (int)(ux * end);
        int ey = y0 + (int)(uy * end);
        draw_thick_line(sx, sy, ex, ey, ux, uy, half_width, black);
    }
}

static int normalize_angle(int deg, int fallback) {
    if (deg < 0 || deg > 360) return fallback;
    return deg % 360;
}

static void draw_outline_triangle(int x0, int y0, int x1, int y1, int x2, int y2, bool black) {
    display_draw_line(x0, y0, x1, y1, black);
    display_draw_line(x1, y1, x2, y2, black);
    display_draw_line(x2, y2, x0, y0, black);
}

static void draw_outline_triangle_thick(int x0, int y0, int x1, int y1, int x2, int y2, int stroke, bool black) {
    draw_round_line(x0, y0, x1, y1, stroke, black);
    draw_round_line(x1, y1, x2, y2, stroke, black);
    draw_round_line(x2, y2, x0, y0, stroke, black);
}

static void draw_open_wedge(int tip_x, int tip_y, int b1x, int b1y, int b2x, int b2y, int stroke, bool black) {
    draw_round_line(tip_x, tip_y, b1x, b1y, stroke, black);
    draw_round_line(tip_x, tip_y, b2x, b2y, stroke, black);
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

static void draw_compass(const SensorData &data) {
    const bool BLACK = true;
    const int cx = 139, cy = 150, cr = 118;

    int heading = normalize_angle(data.HDM, 0);
    int awa = normalize_angle(data.windAngle, 135);
    int twa = normalize_angle(data.trueWindAngle, 90);

    bool showTwa = true;
    int diff = abs(awa - twa);
    if (diff > 180) diff = 360 - diff;
    if (diff < 8) showTwa = false;

    for (int r = cr - 2; r <= cr; r++)
        display_draw_circle(cx, cy, r, BLACK);

    draw_bitmap_text_scaled(10, 10, "VEETR", 2, BLACK);

    for (int deg = 0; deg < 360; deg += 30) {
        float rad = deg * 3.14159265f / 180.0f;
        int dx = (int)((cr - 4) * sinf(rad));
        int dy = (int)((cr - 4) * cosf(rad));
        draw_dot(cx + dx, cy - dy, deg % 90 == 0 ? 5 : 3, BLACK);
    }

    // North/heading reference: a hollow triangle outside the rose.
    {
        float rad = heading * 3.14159265f / 180.0f;
        float ux = sinf(rad), uy = -cosf(rad);
        int base_cx = cx + (int)((cr + 1) * ux);
        int base_cy = cy + (int)((cr + 1) * uy);
        int tip_x = cx + (int)((cr + 25) * ux);
        int tip_y = cy + (int)((cr + 25) * uy);
        int half_base = 11;
        int b1x = base_cx + (int)(half_base * uy);
        int b1y = base_cy - (int)(half_base * ux);
        int b2x = base_cx - (int)(half_base * uy);
        int b2y = base_cy + (int)(half_base * ux);
        draw_outline_triangle(tip_x, tip_y, b1x, b1y, b2x, b2y, BLACK);
        draw_wedge_chevron(base_cx, base_cy, ux, uy, -12, half_base, BLACK);
    }

    // TWA is the secondary cue: same direction language as AWA, but hollow and smaller.
    if (showTwa) {
        float rad = twa * 3.14159265f / 180.0f;
        float ux = sinf(rad), uy = -cosf(rad);

        int base_cx = cx + (int)((cr - 18) * ux);
        int base_cy = cy + (int)((cr - 18) * uy);
        int half_base = 13;
        int b1x = base_cx + (int)(half_base * uy);
        int b1y = base_cy - (int)(half_base * ux);
        int b2x = base_cx - (int)(half_base * uy);
        int b2y = base_cy + (int)(half_base * ux);
        int tip_x = cx + (int)(0.55f * cr * ux);
        int tip_y = cy + (int)(0.55f * cr * uy);
        draw_open_wedge(tip_x, tip_y, b1x, b1y, b2x, b2y, 2, BLACK);
        draw_wedge_chevron(base_cx, base_cy, ux, uy, 10, half_base, BLACK);
    }

    // AWA is the primary cue: dark wedge from wind origin on the rose into the boat center.
    {
        float rad = awa * 3.14159265f / 180.0f;
        float ux = sinf(rad), uy = -cosf(rad);

        int base_cx = cx + (int)((cr - 16) * ux);
        int base_cy = cy + (int)((cr - 16) * uy);
        int half_base = 22;
        int b1x = base_cx + (int)(half_base * uy);
        int b1y = base_cy - (int)(half_base * ux);
        int b2x = base_cx - (int)(half_base * uy);
        int b2y = base_cy + (int)(half_base * ux);
        draw_filled_triangle(cx, cy, b1x, b1y, b2x, b2y, BLACK);

        int notch_x = base_cx - (int)(18 * ux);
        int notch_y = base_cy - (int)(18 * uy);
        int tail_x = base_cx + (int)(30 * uy);
        int tail_y = base_cy - (int)(30 * ux);
        draw_filled_triangle(notch_x, notch_y, b1x, b1y, tail_x, tail_y, BLACK);
        draw_wedge_chevron(base_cx, base_cy, ux, uy, 14, half_base, false);
    }

    draw_dot(cx, cy, 5, BLACK);
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

// ─── Public API ───

void display_lvgl_init() {
    if (!display_init()) return;

    display_clear();

    lv_init();

    lv_disp_draw_buf_init(&draw_buf, buf1, buf2, 400 * 20);

    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res = 400;
    disp_drv.ver_res = 300;
    disp_drv.draw_buf = &draw_buf;
    disp_drv.flush_cb = flush_cb;
    disp_drv.color_chroma_key = lv_color_white();
    lv_disp_drv_register(&disp_drv);

    lv_obj_set_style_bg_color(lv_scr_act(), lv_color_white(), 0);

    display_update();
}

void display_lvgl_update(const SensorData& data) {
    display_clear();

    draw_compass(data);

    draw_speed_readout(0, "AWS", data.windSpeed);
    draw_speed_readout(100, "TWS", data.trueWindSpeed);
    draw_speed_readout(200, "SOG", data.speed);

    display_update();
}
