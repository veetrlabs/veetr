---
title: Správa verzí
description: Vytváření, ověřování a řešení problémů s vydáními Veetr.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/cs/VERSION_MANAGEMENT.md
---

Projekt používá centralizovanou správu verzí s `package.json` aplikace jako hlavním zdrojem.

## Současný systém verzí

- **Zdroj verze:** pole version v `/app/package.json`
- **Webová aplikace:** synchronizace do `/app/src/utils/version.ts`
- **Firmware:** synchronizace do `#define FIRMWARE_VERSION` v `/firmware/src/main.cpp`

## Vytvoření vydání (doporučeno)

### 🚀 Automatické vydání

```bash
./veetr release 0.0.1   # Vytvoří větev, commit, tag a odešle změny
```

**Automatické kroky:**

1. Ověření formátu verze semver.
2. Kontrola čistého pracovního adresáře Git.
3. Aktualizace všech odkazů na verzi.
4. Commit přímo do main se zprávou `"Bump to version 0.0.1"`.
5. Vytvoření a odeslání tagu `0.0.1`.
6. Odeslání změn větve main.

**Následně GitHub Actions:**

1. Ověří shodu verzí ve všech souborech.
2. Sestaví webovou aplikaci a firmware a zkontroluje chyby.
3. Automaticky vytvoří vydání na GitHubu s binárními soubory.

## Celý postup vydání

```bash
# 1. Vytvoření vydání (automatické kroky)
./veetr release 1.2.3

# 2. GitHub Actions ověří, sestaví a vytvoří vydání
# 3. Ověřte nové vydání na stránce Releases
```

## Automatizace GitHub Actions

### Při vytvoření tagu

- **Ověření:** shodné verze ve všech souborech.
- **Sestavení:** webová aplikace a firmware.
- **Vytvoření:** vydání na GitHubu s firmwarem.
- **Výsledek:** úspěch či chyba s podrobnými informacemi.

## Řešení problémů

### Příkaz vydání selže

- Ověřte čistý pracovní adresář: `git status`.
- Ověřte větev main: `git branch`.
- Použijte semver, například `1.2.3`.

### Neshoda verzí

- CLI veetr obsahuje synchronizaci verzí.
- Zkontrolujte validační výstup GitHub Actions.

### Chyba GitHub Actions

- Prohlédněte protokoly daného běhu.
- Ověřte, že lze vše úspěšně sestavit místně.
