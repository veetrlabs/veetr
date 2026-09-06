---
title: Compliance and certifications
description: Current regulatory context and certification considerations for Veetr hardware.
editUrl: https://github.com/veetrlabs/veetr/edit/main/docs/COMPLIANCE.md
---

> **Important:** This page describes the project's current understanding and is not legal, regulatory, engineering, or certification advice.

This document outlines the regulatory compliance and certifications for the Veetr device.

## ESP32 Module Certifications

The Veetr system is built around the ESP32-WROOM-32U module, which holds the following certifications:

### FCC Certification (United States)
- **FCC ID**: 2AC7Z-ESP32WROOM32U
- **Module**: ESP32-WROOM-32U
- **Manufacturer**: Espressif Systems
- **Compliance**: FCC Part 15, Subpart C (15.247)
- **Frequency**: 2.412-2.484 GHz (Wi-Fi/Bluetooth)

### IC Certification (Canada)
- **IC ID**: 21098-ESP32WROOM32U
- **Module**: ESP32-WROOM-32U
- **Compliance**: RSS-247 Issue 2

### CE Marking (European Union)
- **Module**: ESP32-WROOM-32U
- **Standards**: EN 300 328, EN 301 489, EN 62479
- **Directives**: 2014/53/EU (Radio Equipment Directive)

## Regulatory Compliance

### ESP32 Module Compliance

The Veetr project is based on the **ESP32-WROOM-32U** module, which holds the following pre-existing certifications:

**FCC (United States)**: FCC ID 2AC7Z-ESP32WROOM32U
**IC (Canada)**: IC ID 21098-ESP32WROOM32U  
**CE (European Union)**: Compliant with RED 2014/53/EU

### Compliance Approach

**For DIY Builders:**
- Use only certified ESP32-WROOM-32U modules with valid markings
- Personal use devices generally exempt from additional certification
- Follow the reference design and specified antenna configurations
- Check local regulations for personal electronics

**For Commercial Kit Sales:**
- ESP32 module certification typically covers radio compliance when used as designed
- Kit sellers should verify they're following the certified module configuration
- Additional certification may be required for significant modifications or specific markets
- Consult regulations in target markets - requirements vary significantly by region

### Important Notes

This open hardware project does **not** provide product certifications. The compliance information refers only to the ESP32 module used in the design. Anyone building or selling Veetr devices is responsible for ensuring compliance in their jurisdiction.

## FCC Compliance Statement

### United States - FCC Part 15

This device complies with Part 15 of the FCC Rules. Operation is subject to the following two conditions:
1. This device may not cause harmful interference
2. This device must accept any interference received, including interference that may cause undesired operation

**FCC Warning:**
Changes or modifications not expressly approved by the party responsible for compliance could void the user's authority to operate the equipment.

**RF Exposure Information:**
This equipment complies with FCC radiation exposure limits set forth for an uncontrolled environment. This equipment should be installed and operated with minimum distance of 20 cm between the radiator and your body.

**Modular Approval:**
This product contains FCC ID: 2AC7Z-ESP32WROOM32U. The modular device complies with FCC Part 15 rules.

## Canada - IC Compliance

### Innovation, Science and Economic Development Canada (ISED)

This device complies with Innovation, Science and Economic Development Canada licence-exempt RSS standard(s). Operation is subject to the following two conditions:
1. This device may not cause interference
2. This device must accept any interference, including interference that may cause undesired operation of the device

**IC Warning:**
This device complies with IC RSS-102 radiation exposure limits set forth for an uncontrolled environment.

**French (Canada):**
Le présent appareil est conforme aux CNR d'Industrie Canada applicables aux appareils radio exempts de licence. L'exploitation est autorisée aux deux conditions suivantes:
1. L'appareil ne doit pas produire de brouillage
2. L'utilisateur de l'appareil doit accepter tout brouillage radioélectrique subi, même si le brouillage est susceptible d'en compromettre le fonctionnement

## Additional Compliance Notes

### Open Source Hardware Project
- **Open Design**: All hardware designs, schematics, and code are open source
- **DIY Building**: Individuals can build devices for personal use from published designs
- **Component Sourcing**: Builders should source certified ESP32 modules from authorized distributors
- **Personal Use Exemption**: Most jurisdictions exempt personal-use devices from certification requirements

### Commercial Kit Sales
- **Kit Certification**: Commercial kit sellers must obtain appropriate certifications for their market
- **Quality Control**: Kit manufacturers responsible for component quality and compliance verification
- **Documentation**: Must provide compliance documentation and assembly instructions
- **Support**: Kit sellers should provide technical support and warranty coverage

### Certification Scope
- **Module-Based Design**: Relies on pre-certified ESP32-WROOM-32U modules
- **Low-Power Sensors**: Additional sensors (GPS, IMU, wind) operate below regulatory thresholds
- **External Power**: Uses external 5V USB-C power supply (not subject to radio regulations)
- **Antenna Compliance**: Must use antennas matching ESP32 module certification

### Regional Variations
- Different countries may have additional requirements
- Consult local regulatory authorities for specific market requirements
- Some markets may require local representative or importer registration

## Disclaimer

**This document is for reference only.** The Veetr project:

- **Does NOT provide product certifications** for complete devices
- **Only references** existing ESP32 module certifications
- **Is an open hardware design** - builders are responsible for their own compliance
- **Cannot guarantee compliance** of derivative works or modifications

**Users building or selling Veetr devices must:**

1. Verify current certification status of all components
2. Obtain independent legal and regulatory advice
3. Secure appropriate certifications for commercial sales
4. Ensure compliance with local regulations
5. Use only certified components matching the reference design

**Note:** This documentation does not constitute legal advice. Regulatory requirements vary by jurisdiction and application. The ESP32 module certifications referenced here belong to Espressif Systems, not the Veetr project.

## References

- [ESP32-WROOM-32U Datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32d_esp32-wroom-32u_datasheet_en.pdf)
- [FCC Equipment Authorization Search](https://apps.fcc.gov/oetcf/eas/reports/GenericSearch.cfm)
- [ISED Spectrum Management System search](https://ised-isde.canada.ca/site/spectrum-management-system/en/search-sms-data)
- [EU Radio Equipment Directive (RED)](https://single-market-economy.ec.europa.eu/sectors/electrical-and-electronic-engineering-industries-eei/radio-equipment-directive-red_en)
