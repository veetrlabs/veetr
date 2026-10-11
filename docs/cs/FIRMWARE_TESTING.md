---
title: Testování firmwaru
description: Hranice plánovaného automatického a hardwarového testování firmwaru Veetr.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/FIRMWARE_TESTING.md
---

Tento dokument popisuje plán automatického testování firmwaru ESP32. Cílem jsou rychlé a opakovatelné jednotkové testy v CI se simulovaným ESP32 a snímači na hostitelském počítači a místní ověřování na hardwaru.

> Tato stránka zachycuje původní návrh testovací strategie. Aktuální dostupné testy ověřte v `firmware/test/` a `platformio.ini`.

## Cíle

- Zachytit regrese logiky před zkouškou hardwaru.
- Udržet CI rychlé a deterministické bez skutečného zařízení.
- Oddělit čistou logiku od hardwarové integrace.

## Princip CI testování

Návrh používá PlatformIO Test Runner (Unity) s nativním prostředím, které sestaví a spustí logiku na CI stroji:

- **Nativní testy:** hlavní logika se sestaví pro hostitele (`native`) s náhradami API ESP32 a snímačů.
- **Bez hardwaru:** BLE, Wi-Fi, I2C/SPI, GPIO a časově citlivý kód se nahradí nebo vynechá.
- **Deterministické provedení:** bez čekání, skutečných časovačů a úloh na pozadí.

Postup CI:

1. Instalace PlatformIO a závislostí.
2. Sestavení a spuštění `pio test -e native`.
3. Výsledek a artefakty, například protokoly testů.

## Místní spuštění

Příkazy se spouštějí z kořene repozitáře; dostupnost prostředí ověřte v `platformio.ini`:

```bash
# Nativní jednotkové testy
pio test -e native

# Volitelně testy na skutečném ESP32
pio test -e esp32dev
```

Prostředí **native** používá náhrady hardwaru. **esp32dev** je určeno pro omezené integrační testy na zařízení.

## Nový test

Testy PlatformIO patří do `firmware/test/`.

Doporučená struktura:

```text
firmware/test/
  test_<module_name>/
    test_<module_name>.cpp
```

Příklad Unity:

```cpp
#include <unity.h>

void test_example(void) {
  TEST_ASSERT_EQUAL_INT(2, 1 + 1);
}

void setup() {
  UNITY_BEGIN();
  RUN_TEST(test_example);
  UNITY_END();
}

void loop() {
  // V jednotkových testech se nepoužívá
}
```

Pravidla:

- Upřednostňujte **čisté funkce** a **malé jednotky**.
- Rozhraní BLE, I2C, SPI, GPIO a časovače nahrazujte mocky či falešnými implementacemi.
- Nepoužívejte `delay()` a skutečný čas; čas musí být ovladatelný testem.
- Testy mají být opakovatelné a rychlé.

## Co lze ověřit v CI

- Parsování a kódování NMEA, JSON a binárních dat
- Matematika a filtry fúze snímačů se simulovanými vstupy
- Stavové automaty a zpracování událostí
- Kalibrační transformace a převody jednotek
- Příkazy a nastavení
- Zpracování chyb a opakování pokusů

## Co nelze spolehlivě ověřit nativním CI

- Skutečný BLE stack a připojení
- Wi-Fi, síť, OTA a specifická API ESP-IDF
- Chování sběrnic I2C/SPI, časování GPIO a přerušení
- Skutečné snímače BNO080, GPS a Modbus bez hardwaru
- Spotřeba, rádiový výkon a plánování v reálném čase

To vyžaduje **hardware-in-loop** nebo ruční zkoušku ESP32.

## Hranice testování

Oddělujte **hlavní logiku**, testovatelnou v CI, od **hardwarových adaptérů**, které se v CI nahrazují a ověřují na zařízení. U nových funkcí přidávejte testy především do vrstvy hlavní logiky.
