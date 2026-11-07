# Multilingual catalogue matching — English, Hindi, Hinglish

Shop Finder uses **one saved catalogue** for all supported speech modes: English (`en-IN`), Hindi (`hi-IN`) and experimental Hindi–English code-switching (`hi-en`). Gnani Prisma supplies the speech transcript. **The warehouse matcher then finds the product**, which is a separate operation.

## How item names are matched

1. Item names, categories, brands and their **alternate names (aliases)** are indexed using the same conservative text normalizer applied to transcripts.
2. The shared dictionary recognizes common warehouse vocabulary across clothing, footwear, appliances, home essentials and grocery warehouses: spoken product classes, colours, materials, pack units, numbers and request phrases.
3. Product aliases are the extension mechanism for **any additional brand, local nickname, newly imported SKU or regional term**. No blanket claim of accurate automatic translation is made; arbitrary imported product names that are not in the dictionary require synonyms.
4. SKUs/barcodes, sizes, quantities, electrical ratings and variants are checked as constraints. An unsupported or unknown modifier must not silently select an item or invent its storage location. Multiple plausible products must prompt for clarification.
5. A requested language never changes the saved product, rack, shelf or bin. Search result and optional confirmation/reporting rules are identical in all languages.

### Owner guidance for new inventory

When importing an Excel/CSV file, put multiple aliases for each item in the `aliases` column, separated with `|`. Use the actual terms staff speak. Example:

| sku | name | aliases |
| --- | --- | --- |
| GRC-002 | Basmati rice 5 kg bag | basmati 5kg\|बासमती चावल\|basmati chawal |
| SHO-006 | Brown loafers | ब्राउन लोफर्स\|brown lofers\|भूरे लोफर |
| CUSTOM-01 | Ash gourd storage jar | पेठा रखने का मर्तबान\|petha rakhne ka martbaan |

When editing an item, the **Other names** field accepts aliases separated by commas. Owner verification of such labels avoids confusion with similarly named products.

### Verify with real Gnani output

For every SKU in the selected store:

- Confirm the same known item is returned by an English, Hindi and Hinglish query with its exact size/variant.
- Say an ambiguous request without size; check that the app asks for clarification.
- Deliberately use an incorrect rating, size or unavailable variant; check that no shelf is fabricated.
- Test unknown local nicknames; add verified aliases and retest.
- Inspect the **exact transcript** after Gnani recognition. A wrong transcript is an STT issue; a correct transcript returning no result is a search/alias issue.
- Test spoken Timbre replies and errors on a real device. Backend tests check deterministic matching, not live provider accuracy.

## Current automated coverage

Regression tests exercise **all 32 existing sample items** across 4 categories, **40 grocery warehouse examples**, optional staff aliases for an unfamiliar imported product, and negative checks for unknown inventory/variants. This coverage is finite; it does not establish universal translation accuracy for new arbitrary items.

Language preferences in the UI and the spoken-query language are separate settings.
