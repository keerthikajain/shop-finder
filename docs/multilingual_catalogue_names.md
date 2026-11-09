# Multilingual product names — English, Hindi, Hinglish, Telugu, Kannada

## What actually works

Every saved product now supports five owner-reviewed search names alongside its primary name, SKU, specifications and ordinary nicknames.

- `name_en`: English
- `name_hi`: Hindi (Devanagari)
- `name_hi_latn`: Hinglish / Roman Hindi
- `name_te`: Telugu
- `name_kn`: Kannada

These optional fields appear in CSV/XLSX templates, spreadsheet import mapping and export, and the owner item editor. A name can be used in a typed or Gnani-transcribed search regardless of which language is selected. Colour, size, model and numerical constraints remain strict. A new product imported from any category is searchable by the names **recorded for that item**; no hard-coded product dictionary is required.

## Optional generated suggestions

A configured Sarvam Mayura text translation service can generate suggestions when the owner clicks **Suggest translations** in the product editor, or **Suggest next 10 translated product names** in the import preview. Suggestions are generated for English, Hindi, Hindi written in Roman letters, Telugu, and Kannada.

Configure `SARVAM_API_KEY` **only on the backend**, using the secret manager of the separate deployment. No key means this feature returns a clear unavailable message; manual names and standard search still work. Requests are explicit and send only product names, not SKUs, price, stock, supplier names or locations. External translation may incur costs and must comply with the business's data-sharing agreement.

Translation suggestions are **not trusted stock metadata**. For imports they are staged in a preview; the owner must expand the changed products, check each name and tick the review confirmation before saving. If any suggestion is incorrect, correct the sheet and re-import or edit the product rather than approving it. Uploads of more than ten changed products can be processed with repeated explicit requests. Names supplied in the spreadsheet are preserved rather than overwritten by model output.

## Limitations and recommended acceptance test

This is catalogue-driven multilingual lookup, **not** unlimited natural-language understanding. Words must correspond to stored translated names/aliases or the controlled synonyms; free-form grammar, regional dialects, inflections and mistranscribed speech can still cause misses. Automatic translation may mistranslate models, trademarks, niche industrial hardware and sizes, so verify them. Existing Gnani STT/TTS integration is separate and needs device testing.

1. Create or import an entirely new SKU (not in seed data), with an English name and a verified location.
2. Fill or suggest and review names in all five languages, then save.
3. Search using exact product names in English, Hindi, Hinglish, Telugu and Kannada. Confirm each resolves to the **same SKU and same saved shelf**.
4. Test variants with different size, electrical rating or model; the wrong variant must not be selected.
5. Test a product absent from the catalogue and a misspelling. It must not be assigned a made-up shelf.
6. Test spoken Gnani requests in quiet and noisy conditions and record STT text, product retrieval and spoken answer separately.
7. Test importing, editing, exporting, reimporting and restarting the database to verify saved names persist.

The API key is optional and **does not replace Gnani** for speech recognition or synthesis.
