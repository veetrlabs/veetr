/*******************************************************************************
 * Size: 12 px
 * Bpp: 1
 * Opts: --size 12 --bpp 1 --format lvgl --font fonts/VeetrSans.ttf --symbols ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:%+-[] --range 0x20-0x7F --lv-font-name veetr_annotation_12 --output src/screens/veetr_annotation_12.c
 ******************************************************************************/

#ifdef LV_LVGL_H_INCLUDE_SIMPLE
#include "lvgl.h"
#else
#include "lvgl/lvgl.h"
#endif

#ifndef VEETR_ANNOTATION_12
#define VEETR_ANNOTATION_12 1
#endif

#if VEETR_ANNOTATION_12

/*-----------------
 *    BITMAPS
 *----------------*/

/*Store the image of the glyphs*/
static LV_ATTRIBUTE_LARGE_CONST const uint8_t glyph_bitmap[] = {
    /* U+0020 " " */
    0x0,

    /* U+0021 "!" */
    0xff, 0xf3, 0xc0,

    /* U+0022 "\"" */
    0xdf, 0x6d, 0xb6,

    /* U+0023 "#" */
    0x36, 0x36, 0x7f, 0x7e, 0x24, 0xfe, 0xfe, 0x6c,
    0x68,

    /* U+0024 "$" */
    0x38, 0xfb, 0xf3, 0xc7, 0xc3, 0xb7, 0x3e, 0x78,
    0x20,

    /* U+0025 "%" */
    0x67, 0x3d, 0x8f, 0x63, 0xf0, 0x6b, 0x83, 0xf1,
    0xec, 0x5f, 0x33, 0x80,

    /* U+0026 "&" */
    0x38, 0x7c, 0x6c, 0x68, 0x76, 0xde, 0xce, 0xfe,
    0x7b,

    /* U+0027 "'" */
    0xff,

    /* U+0028 "(" */
    0x6f, 0x6d, 0xb6, 0xcd, 0x80,

    /* U+0029 ")" */
    0xd9, 0xb6, 0xdb, 0x7b, 0x0,

    /* U+002A "*" */
    0x33, 0x4c, 0xd3, 0x0,

    /* U+002B "+" */
    0x30, 0xcf, 0xff, 0x30, 0xc3, 0x0,

    /* U+002C "," */
    0x7f, 0x60,

    /* U+002D "-" */
    0xff,

    /* U+002E "." */
    0xfc,

    /* U+002F "/" */
    0x19, 0xcc, 0x63, 0x39, 0x8c, 0x67, 0x30,

    /* U+0030 "0" */
    0x79, 0xec, 0xf3, 0xcf, 0x3c, 0xde, 0x70,

    /* U+0031 "1" */
    0x7f, 0xf3, 0x33, 0x33, 0x30,

    /* U+0032 "2" */
    0x7b, 0xfc, 0xc7, 0x18, 0xe7, 0x3f, 0xfc,

    /* U+0033 "3" */
    0x7d, 0xfb, 0xb1, 0xe3, 0xc1, 0xb3, 0x7e, 0x78,

    /* U+0034 "4" */
    0x1c, 0x78, 0xf3, 0x66, 0xd9, 0xbf, 0xff, 0xc,

    /* U+0035 "5" */
    0xff, 0xfc, 0x3e, 0xfc, 0x3c, 0xff, 0x78,

    /* U+0036 "6" */
    0x3c, 0xfd, 0x9b, 0xef, 0xec, 0xd9, 0xbf, 0x3c,

    /* U+0037 "7" */
    0xff, 0xf1, 0xc6, 0x38, 0xc3, 0x1c, 0x60,

    /* U+0038 "8" */
    0x7d, 0xff, 0x3b, 0xe7, 0xd8, 0xf1, 0xff, 0x7c,

    /* U+0039 "9" */
    0x79, 0xfb, 0x3e, 0x7f, 0xef, 0xc3, 0xfe, 0x78,

    /* U+003A ":" */
    0xfc, 0xfc,

    /* U+003B ";" */
    0xfc, 0x3f, 0x80,

    /* U+003C "<" */
    0xc, 0xf7, 0xb8, 0x78, 0xf0, 0xc0,

    /* U+003D "=" */
    0xff, 0xf0, 0x3f, 0xfc,

    /* U+003E ">" */
    0xc3, 0xc7, 0xc7, 0x7b, 0xcc, 0x0,

    /* U+003F "?" */
    0x38, 0xfb, 0xb0, 0xe3, 0x86, 0x0, 0x18, 0x30,

    /* U+0040 "@" */
    0x1f, 0x18, 0x67, 0xef, 0xfb, 0xf6, 0xfd, 0xbd,
    0xbb, 0x0, 0x60, 0xf, 0x0,

    /* U+0041 "A" */
    0x3c, 0x3c, 0x3c, 0x3e, 0x66, 0x7e, 0x7e, 0x67,
    0xe7,

    /* U+0042 "B" */
    0xfd, 0xff, 0x3e, 0x7f, 0xdf, 0xf1, 0xff, 0xfc,

    /* U+0043 "C" */
    0x3c, 0xff, 0x3e, 0x7c, 0x19, 0xf3, 0xbf, 0x3c,

    /* U+0044 "D" */
    0xf9, 0xfb, 0x3e, 0x3c, 0x78, 0xf3, 0xfe, 0xf8,

    /* U+0045 "E" */
    0xff, 0xfc, 0x30, 0xff, 0xfc, 0x3f, 0xfc,

    /* U+0046 "F" */
    0xff, 0xfc, 0x30, 0xff, 0xfc, 0x30, 0xc0,

    /* U+0047 "G" */
    0x3c, 0xff, 0x1e, 0xc, 0xf9, 0xf1, 0xbf, 0x3c,

    /* U+0048 "H" */
    0xc7, 0x8f, 0x1e, 0x3f, 0xff, 0xf1, 0xe3, 0xc6,

    /* U+0049 "I" */
    0xff, 0xff, 0xc0,

    /* U+004A "J" */
    0xc, 0x30, 0xc3, 0xc, 0x3e, 0xff, 0x78,

    /* U+004B "K" */
    0xcf, 0xbb, 0x67, 0xcf, 0x9f, 0x37, 0x6e, 0xce,

    /* U+004C "L" */
    0xc3, 0xc, 0x30, 0xc3, 0xc, 0x3f, 0xfc,

    /* U+004D "M" */
    0xe3, 0xf1, 0xfd, 0xfe, 0xff, 0xfe, 0xef, 0x77,
    0x83, 0xc1, 0x80,

    /* U+004E "N" */
    0xc7, 0xcf, 0xdf, 0xbf, 0xfb, 0xf7, 0xe7, 0xc6,

    /* U+004F "O" */
    0x38, 0xfb, 0x1e, 0x3c, 0x78, 0xf1, 0xbe, 0x38,

    /* U+0050 "P" */
    0xfb, 0xfc, 0xf3, 0xcf, 0xff, 0xb0, 0xc0,

    /* U+0051 "Q" */
    0x38, 0xfb, 0x1e, 0x3c, 0x78, 0xf7, 0xbe, 0x3c,
    0xc,

    /* U+0052 "R" */
    0xfd, 0xff, 0x1e, 0x3f, 0xff, 0xb7, 0x67, 0xc6,

    /* U+0053 "S" */
    0x79, 0xfb, 0x37, 0x87, 0xc3, 0xb3, 0x7e, 0x78,

    /* U+0054 "T" */
    0xff, 0xfc, 0xc1, 0x83, 0x6, 0xc, 0x18, 0x30,

    /* U+0055 "U" */
    0xc7, 0x8f, 0x1e, 0x3c, 0x78, 0xf1, 0xff, 0x7c,

    /* U+0056 "V" */
    0xe7, 0x67, 0x66, 0x76, 0x76, 0x3e, 0x3c, 0x3c,
    0x3c,

    /* U+0057 "W" */
    0xe6, 0xfd, 0xdd, 0xbb, 0xb7, 0x66, 0xec, 0xd7,
    0x8e, 0xf1, 0xdc, 0x39, 0x80,

    /* U+0058 "X" */
    0xe7, 0x66, 0x7e, 0x3c, 0x3c, 0x3c, 0x7e, 0x6e,
    0xe7,

    /* U+0059 "Y" */
    0x66, 0x66, 0x7e, 0x3c, 0x3c, 0x18, 0x18, 0x18,
    0x18,

    /* U+005A "Z" */
    0xff, 0xf1, 0x8e, 0x31, 0xc6, 0x3f, 0xfc,

    /* U+005B "[" */
    0xff, 0xcc, 0xcc, 0xcc, 0xcf, 0xf0,

    /* U+005C "\\" */
    0xc7, 0x18, 0xc6, 0x38, 0xc6, 0x30, 0xc6,

    /* U+005D "]" */
    0xff, 0x33, 0x33, 0x33, 0x3f, 0xf0,

    /* U+005E "^" */
    0x39, 0xe6, 0xc0,

    /* U+005F "_" */
    0xff, 0xc0,

    /* U+0060 "`" */
    0xcc,

    /* U+0061 "a" */
    0x7b, 0xfc, 0xdf, 0xcf, 0xf6, 0xc0,

    /* U+0062 "b" */
    0xc3, 0xf, 0xbf, 0xcf, 0x3f, 0xff, 0xd8,

    /* U+0063 "c" */
    0x7b, 0xfc, 0xf0, 0xcf, 0xf7, 0x80,

    /* U+0064 "d" */
    0xc, 0x37, 0xff, 0xcf, 0x3c, 0xff, 0x7c,

    /* U+0065 "e" */
    0x7b, 0xff, 0xff, 0xcf, 0xf7, 0x80,

    /* U+0066 "f" */
    0x7b, 0xff, 0xf6, 0x31, 0x8c, 0x60,

    /* U+0067 "g" */
    0x7f, 0xfc, 0xf3, 0xff, 0xf6, 0xff, 0x78,

    /* U+0068 "h" */
    0xc3, 0xd, 0xbf, 0xcf, 0x3c, 0xf3, 0xcc,

    /* U+0069 "i" */
    0xf3, 0xff, 0xf0,

    /* U+006A "j" */
    0x6c, 0x36, 0xdb, 0x6f, 0xe0,

    /* U+006B "k" */
    0xc3, 0xd, 0xf6, 0xf3, 0xcf, 0xb6, 0xdc,

    /* U+006C "l" */
    0xff, 0xff, 0xc0,

    /* U+006D "m" */
    0xd9, 0xbf, 0xff, 0xff, 0x33, 0xcc, 0xf3, 0x3c,
    0xcc,

    /* U+006E "n" */
    0xdb, 0xff, 0xf3, 0xcf, 0x3c, 0xc0,

    /* U+006F "o" */
    0x7b, 0xfc, 0xf3, 0xcf, 0xf7, 0x80,

    /* U+0070 "p" */
    0xfb, 0xfc, 0xf3, 0xff, 0xfd, 0xb0, 0xc0,

    /* U+0071 "q" */
    0x6f, 0xfc, 0xf3, 0xcf, 0xf6, 0xc3, 0xc,

    /* U+0072 "r" */
    0xff, 0xf1, 0x8c, 0x63, 0x0,

    /* U+0073 "s" */
    0x73, 0xed, 0x9e, 0xdb, 0xe7, 0x80,

    /* U+0074 "t" */
    0x63, 0x3f, 0xf6, 0x31, 0x8f, 0x38,

    /* U+0075 "u" */
    0xcf, 0x3c, 0xf3, 0xff, 0xf6, 0xc0,

    /* U+0076 "v" */
    0xee, 0xd9, 0xb3, 0x66, 0xc7, 0xe, 0x0,

    /* U+0077 "w" */
    0xec, 0xdb, 0xb6, 0xed, 0xfe, 0x7b, 0x9e, 0xe3,
    0x38,

    /* U+0078 "x" */
    0xee, 0xd9, 0xf1, 0xc3, 0xcd, 0x9b, 0x80,

    /* U+0079 "y" */
    0xcd, 0xdb, 0xb3, 0xe7, 0x8f, 0xe, 0x78, 0xe0,

    /* U+007A "z" */
    0xff, 0xcc, 0xe6, 0x7f, 0xe0,

    /* U+007B "{" */
    0x3b, 0xd8, 0xce, 0x71, 0x8c, 0x63, 0xce,

    /* U+007C "|" */
    0xff, 0xff, 0xfc,

    /* U+007D "}" */
    0xe7, 0x8c, 0x63, 0x9c, 0xc6, 0x37, 0xb8,

    /* U+007E "~" */
    0x6f, 0xfd, 0x80
};


/*---------------------
 *  GLYPH DESCRIPTION
 *--------------------*/

static const lv_font_fmt_txt_glyph_dsc_t glyph_dsc[] = {
    {.bitmap_index = 0, .adv_w = 0, .box_w = 0, .box_h = 0, .ofs_x = 0, .ofs_y = 0} /* id = 0 reserved */,
    {.bitmap_index = 0, .adv_w = 41, .box_w = 1, .box_h = 1, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 1, .adv_w = 63, .box_w = 2, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 4, .adv_w = 116, .box_w = 6, .box_h = 4, .ofs_x = 1, .ofs_y = 5},
    {.bitmap_index = 7, .adv_w = 126, .box_w = 8, .box_h = 9, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 16, .adv_w = 126, .box_w = 7, .box_h = 10, .ofs_x = 0, .ofs_y = -1},
    {.bitmap_index = 25, .adv_w = 159, .box_w = 10, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 37, .adv_w = 139, .box_w = 8, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 46, .adv_w = 60, .box_w = 2, .box_h = 4, .ofs_x = 1, .ofs_y = 5},
    {.bitmap_index = 47, .adv_w = 81, .box_w = 3, .box_h = 11, .ofs_x = 1, .ofs_y = -2},
    {.bitmap_index = 52, .adv_w = 81, .box_w = 3, .box_h = 11, .ofs_x = 1, .ofs_y = -2},
    {.bitmap_index = 57, .adv_w = 92, .box_w = 5, .box_h = 5, .ofs_x = 0, .ofs_y = 4},
    {.bitmap_index = 61, .adv_w = 126, .box_w = 6, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 67, .adv_w = 50, .box_w = 3, .box_h = 4, .ofs_x = 0, .ofs_y = -2},
    {.bitmap_index = 69, .adv_w = 79, .box_w = 4, .box_h = 2, .ofs_x = 1, .ofs_y = 2},
    {.bitmap_index = 70, .adv_w = 62, .box_w = 2, .box_h = 3, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 71, .adv_w = 81, .box_w = 5, .box_h = 11, .ofs_x = 0, .ofs_y = -2},
    {.bitmap_index = 78, .adv_w = 127, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 85, .adv_w = 98, .box_w = 4, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 90, .adv_w = 120, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 97, .adv_w = 123, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 105, .adv_w = 127, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 113, .adv_w = 124, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 120, .adv_w = 128, .box_w = 7, .box_h = 9, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 128, .adv_w = 115, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 135, .adv_w = 131, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 143, .adv_w = 128, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 151, .adv_w = 62, .box_w = 2, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 153, .adv_w = 62, .box_w = 2, .box_h = 9, .ofs_x = 1, .ofs_y = -2},
    {.bitmap_index = 156, .adv_w = 126, .box_w = 6, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 162, .adv_w = 126, .box_w = 6, .box_h = 5, .ofs_x = 1, .ofs_y = 1},
    {.bitmap_index = 166, .adv_w = 126, .box_w = 6, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 172, .adv_w = 101, .box_w = 7, .box_h = 9, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 180, .adv_w = 171, .box_w = 10, .box_h = 10, .ofs_x = 1, .ofs_y = -1},
    {.bitmap_index = 193, .adv_w = 132, .box_w = 8, .box_h = 9, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 202, .adv_w = 128, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 210, .adv_w = 129, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 218, .adv_w = 135, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 226, .adv_w = 115, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 233, .adv_w = 111, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 240, .adv_w = 132, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 248, .adv_w = 142, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 256, .adv_w = 66, .box_w = 2, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 259, .adv_w = 119, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 266, .adv_w = 133, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 274, .adv_w = 105, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 281, .adv_w = 164, .box_w = 9, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 292, .adv_w = 137, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 300, .adv_w = 137, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 308, .adv_w = 124, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 315, .adv_w = 137, .box_w = 7, .box_h = 10, .ofs_x = 1, .ofs_y = -1},
    {.bitmap_index = 324, .adv_w = 130, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 332, .adv_w = 125, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 340, .adv_w = 110, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 348, .adv_w = 137, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 356, .adv_w = 130, .box_w = 8, .box_h = 9, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 365, .adv_w = 180, .box_w = 11, .box_h = 9, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 378, .adv_w = 125, .box_w = 8, .box_h = 9, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 387, .adv_w = 122, .box_w = 8, .box_h = 9, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 396, .adv_w = 119, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 403, .adv_w = 81, .box_w = 4, .box_h = 11, .ofs_x = 1, .ofs_y = -2},
    {.bitmap_index = 409, .adv_w = 81, .box_w = 5, .box_h = 11, .ofs_x = 0, .ofs_y = -2},
    {.bitmap_index = 416, .adv_w = 81, .box_w = 4, .box_h = 11, .ofs_x = 1, .ofs_y = -2},
    {.bitmap_index = 422, .adv_w = 103, .box_w = 6, .box_h = 3, .ofs_x = 0, .ofs_y = 5},
    {.bitmap_index = 425, .adv_w = 86, .box_w = 5, .box_h = 2, .ofs_x = 0, .ofs_y = -3},
    {.bitmap_index = 427, .adv_w = 94, .box_w = 3, .box_h = 2, .ofs_x = 1, .ofs_y = 8},
    {.bitmap_index = 428, .adv_w = 113, .box_w = 6, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 434, .adv_w = 123, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 441, .adv_w = 110, .box_w = 6, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 447, .adv_w = 123, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 454, .adv_w = 113, .box_w = 6, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 460, .adv_w = 85, .box_w = 5, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 466, .adv_w = 123, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = -2},
    {.bitmap_index = 473, .adv_w = 123, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 480, .adv_w = 62, .box_w = 2, .box_h = 10, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 483, .adv_w = 62, .box_w = 3, .box_h = 12, .ofs_x = 0, .ofs_y = -2},
    {.bitmap_index = 488, .adv_w = 121, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 495, .adv_w = 62, .box_w = 2, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 498, .adv_w = 179, .box_w = 10, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 507, .adv_w = 122, .box_w = 6, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 513, .adv_w = 115, .box_w = 6, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 519, .adv_w = 123, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = -2},
    {.bitmap_index = 526, .adv_w = 123, .box_w = 6, .box_h = 9, .ofs_x = 1, .ofs_y = -2},
    {.bitmap_index = 533, .adv_w = 88, .box_w = 5, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 538, .adv_w = 108, .box_w = 6, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 544, .adv_w = 87, .box_w = 5, .box_h = 9, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 550, .adv_w = 122, .box_w = 6, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 556, .adv_w = 112, .box_w = 7, .box_h = 7, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 563, .adv_w = 167, .box_w = 10, .box_h = 7, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 572, .adv_w = 116, .box_w = 7, .box_h = 7, .ofs_x = 0, .ofs_y = 0},
    {.bitmap_index = 579, .adv_w = 114, .box_w = 7, .box_h = 9, .ofs_x = 1, .ofs_y = -2},
    {.bitmap_index = 587, .adv_w = 103, .box_w = 5, .box_h = 7, .ofs_x = 1, .ofs_y = 0},
    {.bitmap_index = 592, .adv_w = 81, .box_w = 5, .box_h = 11, .ofs_x = 0, .ofs_y = -2},
    {.bitmap_index = 599, .adv_w = 81, .box_w = 2, .box_h = 11, .ofs_x = 1, .ofs_y = -2},
    {.bitmap_index = 602, .adv_w = 81, .box_w = 5, .box_h = 11, .ofs_x = 0, .ofs_y = -2},
    {.bitmap_index = 609, .adv_w = 109, .box_w = 6, .box_h = 3, .ofs_x = 0, .ofs_y = 3}
};

/*---------------------
 *  CHARACTER MAPPING
 *--------------------*/



/*Collect the unicode lists and glyph_id offsets*/
static const lv_font_fmt_txt_cmap_t cmaps[] =
{
    {
        .range_start = 32, .range_length = 95, .glyph_id_start = 1,
        .unicode_list = NULL, .glyph_id_ofs_list = NULL, .list_length = 0, .type = LV_FONT_FMT_TXT_CMAP_FORMAT0_TINY
    }
};



/*--------------------
 *  ALL CUSTOM DATA
 *--------------------*/

#if LVGL_VERSION_MAJOR == 8
/*Store all the custom data of the font*/
static  lv_font_fmt_txt_glyph_cache_t cache;
#endif

#if LVGL_VERSION_MAJOR >= 8
static const lv_font_fmt_txt_dsc_t font_dsc = {
#else
static lv_font_fmt_txt_dsc_t font_dsc = {
#endif
    .glyph_bitmap = glyph_bitmap,
    .glyph_dsc = glyph_dsc,
    .cmaps = cmaps,
    .kern_dsc = NULL,
    .kern_scale = 0,
    .cmap_num = 1,
    .bpp = 1,
    .kern_classes = 0,
    .bitmap_format = 0,
#if LVGL_VERSION_MAJOR == 8
    .cache = &cache
#endif
};



/*-----------------
 *  PUBLIC FONT
 *----------------*/

/*Initialize a public general font descriptor*/
#if LVGL_VERSION_MAJOR >= 8
const lv_font_t veetr_annotation_12 = {
#else
lv_font_t veetr_annotation_12 = {
#endif
    .get_glyph_dsc = lv_font_get_glyph_dsc_fmt_txt,    /*Function pointer to get glyph's data*/
    .get_glyph_bitmap = lv_font_get_bitmap_fmt_txt,    /*Function pointer to get glyph's bitmap*/
    .line_height = 13,          /*The maximum line height required by the font*/
    .base_line = 3,             /*Baseline measured from the bottom of the line*/
#if !(LVGL_VERSION_MAJOR == 6 && LVGL_VERSION_MINOR == 0)
    .subpx = LV_FONT_SUBPX_NONE,
#endif
#if LV_VERSION_CHECK(7, 4, 0) || LVGL_VERSION_MAJOR >= 8
    .underline_position = 0,
    .underline_thickness = 0,
#endif
    .dsc = &font_dsc,          /*The custom font data. Will be accessed by `get_glyph_bitmap/dsc` */
#if LV_VERSION_CHECK(8, 2, 0) || LVGL_VERSION_MAJOR >= 9
    .fallback = NULL,
#endif
    .user_data = NULL,
};



#endif /*#if VEETR_ANNOTATION_12*/
