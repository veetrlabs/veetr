---
name: lvgl-editor-wasm
description: LVGL Pro Editor WASM preview runtime constraints — tiny TTF fails without FreeType, fonts are limited, gen files are auto-generated, screen loading differs from embedded
---

# LVGL Pro Editor WASM Preview

## Architecture

### File Roles
| File | Editable? | Purpose |
|---|---|---|
| `globals.xml` | **Yes** — hand-edit | Defines colors, styles, images, fonts for the code generator |
| `screens/screen_*.xml` | **Yes** — hand-edit | Screen layout (Editor's design view reads this directly) |
| `firmware.c` | **Yes** — hand-edit | User init logic — NOT regenerated |
| `firmware.h` | **Yes** — hand-edit | Exports — NOT regenerated |
| `lv_conf.h` | **Yes** — hand-edit | LVGL build config |
| `firmware_gen.c` | **No** — auto-generated | Code generator reads `globals.xml` → produces globals init + asset registration |
| `firmware_gen.h` | **No** — auto-generated | Extern declarations for globals (styles, fonts, images) |
| `screens/screen_main_gen.c` | **No** — auto-generated | Code generator reads `screen_main.xml` → produces `screen_main_create()` |
| `screens/screen_main_gen.h` | **No** — auto-generated | Header for generated screen function |

**Critical:** Never edit `_gen.*` files — they're overwritten every time the Editor opens or "Generate Code" is triggered.

### Init Flow
1. Editor JS loads WASM runtime (`lved-runtime.js` + `.wasm`)
2. Editor calls `_lvrt_initialize()` — LVGL + display driver + input setup
3. Editor calls `_firmware_init(path)` — your code in `firmware_init()`
4. Edior sets up the preview pane

`firmware_init()` is the ONLY entry point from the Editor. All screen creation and app logic must happen here.

## WASM Preview Constraints

### No FreeType → No tiny TTF
The WASM runtime has **no FreeType library**. `lv_tiny_ttf_create_file()` calls compile fine (the function exists) but always fail at runtime with `lv_tiny_ttf_create: tiny_ttf: init failed`.

**Do NOT put `<tiny_ttf>` entries in `globals.xml`.** The code generator will produce `lv_tiny_ttf_create_file()` calls in `firmware_gen.c`, and the WASM runtime will crash/hang when these fail.

### Built-in Fonts Only
The Editor's LVGL WASM build includes only a subset of built-in fonts. Common sizes like `lv_font_montserrat_24` and `lv_font_montserrat_48` are **not compiled in** — referencing them causes a link error or crash.

The WASM's `lv_conf.h` defines `LV_FONT_MONTSERRAT_14` but not 24/48. To check which fonts are available, look at the compiler errors in the Editor console or inspect `lv_conf.h` in the preview-bin.

### `<lv_scale>` Is Silently Ignored
The code generator (targeting LVGL 8.3) does not generate C code for `<lv_scale>`. The element renders in the Editor's design view (which uses its own renderer) but produces zero output in `screen_main_gen.c`.

To display a compass/scale on the device, implement it separately in the embedded code (e.g., custom drawing in `display_lvgl.cpp`).

## Screen Creation Pattern

### Works for Preview
```c
void firmware_init(const char * asset_path)
{
    (void)asset_path;

    // Init global styles (must happen BEFORE firmware_init_gen)
    lv_style_init(&style_reset);
    lv_style_set_width(&style_reset, LV_SIZE_CONTENT);
    lv_style_set_height(&style_reset, LV_SIZE_CONTENT);
    lv_style_set_bg_opa(&style_reset, 0);
    lv_style_set_border_width(&style_reset, 0);
    lv_style_set_radius(&style_reset, 0);
    lv_style_set_pad_all(&style_reset, 0);

    lv_style_init(&style_label);
    lv_style_set_text_color(&style_label, TEXT);

    firmware_init_gen(asset_path);
    screen_main_create();
}
```

Both the style init and `firmware_init_gen()` are needed. The reason is not fully understood — `firmware_init_gen()` alone (without prior manual style init) fails to show the preview, despite doing the same style init internally (with a `static bool` guard). The hypothesis is a WASM static variable initialization quirk where the guard variable `style_inited` is not properly initialized to `false`, causing it to skip the style init block.

**Do NOT call `lv_scr_load()`** — it conflicts with the Editor's screen management and causes the loading circle to spin indefinitely. The Editor's JS code handles screen loading automatically after `firmware_init()` returns.

## Debugging Checklist

| Symptom | Likely Cause | Fix |
|---|---|---|
| Loading circle (hang) | `lv_scr_load()` called | Remove call; let Editor manage screens |
| Loading circle (hang) | `lv_scr_load()` called | Remove call; let Editor manage screens |
| No preview (no errors) | `firmware_init_gen()` called without prior style init | Add manual style init BEFORE `firmware_init_gen()` |
| Loading circle (hang) | `<tiny_ttf>` in globals.xml | Remove `<tiny_ttf>` entries |
| No preview, no errors | Screen not created | Verify `screen_main_create()` is called |
| Compile error: undefined font | `style_text_font` references missing font | Remove `style_text_font` from XML, or don't use custom fonts |
| Design view shows compass, but gen code has no compass code | `<lv_scale>` silently ignored by code generator | Expected — implement compass separately on device |
| Preview shows loading circle but never finishes | Screen creation takes too long or blocks | Check for infinite loops or blocking calls in init |

## Embedded Build (PlatformIO / ESP32-S3)

The embedded build is separate from the Editor preview. The embedded build:
- Uses FreeType (`LV_USE_FREETYPE`) → tiny TTF works
- Has more fonts compiled in
- Has a display driver for the RLCD panel

The embedded build compiles `firmware.c` with `#if !LV_EDITOR_PREVIEW` guards (if needed) to use the full init flow including `firmware_init_gen()` and `lv_scr_load()`:

```c
void firmware_init(const char * asset_path)
{
    (void)asset_path;

#if !defined(LV_EDITOR_PREVIEW)
    // Embedded: call firmware_init_gen (with working FreeType/tiny TTF)
    firmware_init_gen(asset_path);
    lv_obj_t * scr = screen_main_create();
    lv_scr_load(scr);
#else
    // Editor preview: manual style init + firmware_init_gen, no scr_load
    lv_style_init(&style_reset);
    lv_style_set_width(&style_reset, LV_SIZE_CONTENT);
    lv_style_set_height(&style_reset, LV_SIZE_CONTENT);
    lv_style_set_bg_opa(&style_reset, 0);
    lv_style_set_border_width(&style_reset, 0);
    lv_style_set_radius(&style_reset, 0);
    lv_style_set_pad_all(&style_reset, 0);

    lv_style_init(&style_label);
    lv_style_set_text_color(&style_label, TEXT);

    firmware_init_gen(asset_path);
    screen_main_create();
#endif
}
```

This allows the same `firmware.c` to work in both environments.

## globals.xml Best Practices

- Keep `<fonts>` section **empty** to avoid generating tiny TTF code that fails in WASM
- Define colors and styles in `<consts>` and `<styles>` as normal
- The code generator produces `style_reset` and `style_label` global style variables from `<styles>` entries
- Use `#color_name` syntax in XML to reference global colors

## Key Lessons Learned
1. `_gen.*` files are auto-generated — do not edit
2. The Editor's WASM runtime is NOT the same as the embedded LVGL — no FreeType, fewer fonts, different display driver
3. `<tiny_ttf>` in globals.xml → generated tiny TTF calls → WASM crash/hang
4. `lv_scr_load()` must NOT be called from `firmware_init()` — Editor manages screen loading
5. Manual style init must precede `firmware_init_gen()` — static variable guard in generated code may not initialize reliably in WASM
6. `<lv_scale>` renders in design view but generates no C code (LVGL 8.3 code generator limitation)
7. The Editor's design view renders XML directly (its own renderer) — the WASM preview is separate
