# Query-time multilingual matching (optional)

## Owner and worker behavior

**Import the catalogue once, in its original language.** No translation, enrichment, language field, or change of stored product name is required. CSV and Excel imports continue unchanged.

When a worker searches by typing or speaking, Shop Finder:
1. Uses Gnani Prisma STT first if the request is spoken.
2. Searches the original transcript/text against the actual saved names, SKUs, aliases and specifications. A direct match has priority.
3. Only if no product matches and the requested language is one of English, Hindi, Hinglish, Telugu or Kannada, optionally translates the **worker's request** into the script actually found in the current catalogue. An English stored catalogue is searched using an English translation.
4. Runs the existing deterministic matcher against the translated text, and checks explicit numeric, SKU/model and colour constraints from the original request. It returns a unique SKU/location only if that product exists and has one recorded shelf. Multiple variants or shelves still require user selection. No match is shown when no verified item exists.
5. Keeps the catalogue and original user request unchanged. Saved products aren't rewritten, translated or re-imported. Product names in the UI stay as recorded.

The optional backend-only `SARVAM_API_KEY` enables Sarvam text translation. Without this key, the product lookup still works for exact saved names and the existing built-in regional vocabulary; it does not promise universal language understanding. Only **failed search queries** are sent to the translation provider, not inventory files, location records or stock.

## Example

Saved CSV row: `APP-991,Stainless steel hose clamp,Hardware,Z`.

A Hindi request such as “स्टेनलेस स्टील होज़ क्लैंप कहाँ है?” is transcribed and, if the direct matcher fails, can be translated to “Where is the stainless steel hose clamp?” and matched to the saved English name `Stainless steel hose clamp`. The result uses APP-991 and rack Z from the original database. The row is not translated or modified.

## Safety, limits and reliability

Translation can be inaccurate with names, technical words, brands, code-mixed speech and domain-specific synonyms. The fallback does not expand clearly English requests already unmatched. The system never assumes provider text is an inventory record or location. It checks SKU/model-like codes, numbers and basic colours, but does not yet prove correctness for every nonnumeric product specification, morphology or dialect. If it cannot resolve safely, it should return unknown/choices rather than a guessed shelf.

The selected language is a hint; when the text contains a regional script, translation can still be attempted even if the user selector was left on English. Real Gnani STT accuracy in Hindi, Hinglish, Telugu and Kannada requires recorded tests.

## Acceptance tests

- Import a new product not present in seed data with only one English product name and a known shelf.
- Search it with Hindi, Hinglish, Telugu and Kannada spoken/typed requests.
- Confirm all matching paths resolve to the same original SKU and shelf; verify that the saved row is unchanged.
- Repeat with wrong size, colour, brand/model and a product that does not exist; no substitution should occur.
- Confirm direct matches do not call paid translation and that unavailable translation gives an ordinary no-match result, not a server error.
- Evaluate real STT transcript, translated query and final retrieved SKU separately, including noisy audio.

## Key management

Set `SARVAM_API_KEY` in backend secrets, not in Git or frontend variables. Separate billing and usage quotas should be applied to public-preview environments. Do not use the API for sensitive worker queries without appropriate disclosure and consent.
