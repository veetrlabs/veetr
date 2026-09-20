#include "display_ui.h"
#include "display_driver.h"
#include "sensor_data.h"
#include <math.h>

void display_ui_init() {
    if (display_init()) {
        display_clear();
        display_update();
    }
}

static void draw_arrowhead(int tip_x, int tip_y, float ux, float uy, int len, bool black) {
    int blx = tip_x - (int)(len * ux) - (int)(len * 0.5f * uy);
    int bly = tip_y - (int)(len * uy) + (int)(len * 0.5f * ux);
    int brx = tip_x - (int)(len * ux) + (int)(len * 0.5f * uy);
    int bry = tip_y - (int)(len * uy) - (int)(len * 0.5f * ux);

    display_draw_line(tip_x, tip_y, blx, bly, black);
    display_draw_line(tip_x, tip_y, brx, bry, black);
    display_draw_line(blx, bly, brx, bry, black);
}

static void draw_dot(int x, int y, int size, bool black) {
    int half = size / 2;
    for (int dy = -half; dy <= half; dy++)
        for (int dx = -half; dx <= half; dx++)
            display_set_pixel(x + dx, y + dy, black);
}

void display_ui_update(const SensorData& data) {
    display_clear();
    const bool BLACK = true;
    char buf[16];

    // Demo angles when no sensor data
    int awa = (data.windAngle >= 0 && data.windAngle <= 360) ? data.windAngle : 135;
    int twa = (data.trueWindAngle >= 0 && data.trueWindAngle <= 360) ? data.trueWindAngle : 90;

    bool showTwa = true;
    int diff = abs(awa - twa);
    if (diff > 180) diff = 360 - diff;
    if (diff < 10) showTwa = false;

    // ─── LEFT PANEL: SPEEDS at scale 6 ───
    // "100.0" at scale 6 spans exactly 184px (x=5..188)
    // Circle lives from x=188..398 (cx=293, cr=105)
    const int nx = 5;
    float sog = (!isnan(data.speed) && data.speed >= 0) ? data.speed : 0.0f;
    float aws = (!isnan(data.windSpeed) && data.windSpeed >= 0) ? data.windSpeed : 0.0f;
    float tws = (!isnan(data.trueWindSpeed) && data.trueWindSpeed >= 0) ? data.trueWindSpeed : 0.0f;

    display_draw_string(nx, 8, "SOG", BLACK);
    snprintf(buf, sizeof(buf), "%.1f", sog);
    display_draw_string_scaled(nx, 24, buf, 6, BLACK);

    display_draw_string(nx, 112, "AWS", BLACK);
    snprintf(buf, sizeof(buf), "%.1f", aws);
    display_draw_string_scaled(nx, 128, buf, 6, BLACK);

    display_draw_string(nx, 216, "TWS", BLACK);
    snprintf(buf, sizeof(buf), "%.1f", tws);
    display_draw_string_scaled(nx, 232, buf, 6, BLACK);

    // ─── COMPASS ROSE ───
    const int cx = 293, cy = 150, cr = 105;

    display_draw_circle(cx, cy, cr, BLACK);

    // Degree dots every 30°
    for (int deg = 0; deg < 360; deg += 30) {
        float rad = deg * 3.14159265f / 180.0f;
        int dx = (int)((cr - 4) * sinf(rad));
        int dy = (int)((cr - 4) * cosf(rad));
        if (deg == 0)
            display_draw_line(cx, cy - cr + 3, cx, cy - cr + 12, BLACK);
        else
            draw_dot(cx + dx, cy - dy, 3, BLACK);
    }

    // AWA arrow — biggest, thickest
    {
        float rad = awa * 3.14159265f / 180.0f;
        float ux = sinf(rad), uy = -cosf(rad);

        int tip_x = cx + (int)(0.92f * cr * ux);
        int tip_y = cy + (int)(0.92f * cr * uy);

        display_draw_line(cx, cy, tip_x, tip_y, BLACK);
        int px = (int)(uy * 1), py = (int)(-ux * 1);
        display_draw_line(cx + px, cy + py, tip_x + px, tip_y + py, BLACK);
        display_draw_line(cx - px, cy - py, tip_x - px, tip_y - py, BLACK);

        draw_arrowhead(tip_x, tip_y, ux, uy, 14, BLACK);

        int lx = cx + (int)(0.55f * cr * ux);
        int ly = cy + (int)(0.55f * cr * uy);
        display_draw_char_scaled(lx - 6, ly - 8, 'A', 2, BLACK);
    }

    // TWA arrow — thinner, shorter
    if (showTwa) {
        float rad = twa * 3.14159265f / 180.0f;
        float ux = sinf(rad), uy = -cosf(rad);

        int tip_x = cx + (int)(0.72f * cr * ux);
        int tip_y = cy + (int)(0.72f * cr * uy);

        display_draw_line(cx, cy, tip_x, tip_y, BLACK);
        draw_arrowhead(tip_x, tip_y, ux, uy, 10, BLACK);

        int lx = cx + (int)(0.38f * cr * ux);
        int ly = cy + (int)(0.38f * cr * uy);
        display_draw_char_scaled(lx - 6, ly - 8, 'T', 2, BLACK);
    }

    display_update();
}
