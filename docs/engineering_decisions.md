# Engineering decisions

| Decision | Reason and trade-off | Evidence / status |
|---|---|---|
| Keep React/Vite + FastAPI + SQLite | Preserves requested local-first architecture | Implemented and tested |
| Python sqlite3 with structured JSON payload and indexed category | Small catalogue; preserves structured specifications without premature joins | Tested; revisit indexing at larger scale |
| Empty compatibility for every synthetic record | No real catalogue or manufacturer evidence supplied | Tested |
| Synthetic is independent of staff verification | Schema-valid is not equivalent to verified or safe | Tested: synthetic verification is rejected |
| Per-field evidence for verified records | Requires a source for each populated identity, location and technical field | Validation tested; genuine evidence review remains human work |
| Insert-only seeding | Restart must not erase future staff corrections | Idempotence and edit-preservation tests pass |
| Read-only foundation | Do not expose unauthenticated writes while staff access control is pending | POST/PUT tests reject mutations |
| Explicitly disabled mock speech interfaces | Preserve integration boundary without fabricated Gnani output | Tests verify they fail clearly |
| One development launcher | FastAPI and Vite must run together for the UI to fetch data | Added after initial browser connection failure |

No new models, no separate LLM, no cloud database, no inventory/billing expansion.

## Contribution record
User: defined the problem, corrected the domain, selected the architecture/models and set verification constraints.
AI assistant: implemented the foundation, synthetic fixtures, tests and documentation.
User implementation/testing/understanding: not yet assessed. Do not invent ownership or mastery.

## One small personal task
Open SYN-008 and SYN-009 in the catalogue. Identify the differing field. Explain why a shared nickname is insufficient to select a real replacement. Then add one locally used nickname in the JSON fixture and validate it with a knowledgeable shop worker before it can become real catalogue knowledge. Existing database records are intentionally not overwritten by reseeding; use a separate fresh demo database to inspect edited fixtures.


## 29 October 2026 — glassmorphism UI (user authorized)

Proposed change: apply the desktop/mobile glass concept to all four existing screens.
Current approach: functional green/cream screens with dense catalogue cards.
Reason: user explicitly selected glassmorphism and requested the actual application update.
Improvement: frosted surfaces, lavender navigation, plum actions, mint location tiles and consistent form treatments. On mobile, selected details appear before the results. Navigation remains labelled at every breakpoint.
Expected benefit: more legible grouping and easier access to identifiers and location; usability benefit remains a reasoned expectation until shop trials.
Risks: low contrast from transparency, blur performance on older devices, and narrow-screen overflow. Use predominantly opaque surfaces, dark text, CSS fallbacks and bounded responsive grids. Physical-device testing is still needed.
Cost: no extra runtime dependency, external font, generated photo or live API usage. Rendering contracts use Vite's installed esbuild dependency.
Submission effect: an implemented visual direction and reproducible code checks, without claiming real users, browser acceptance or improved voice accuracy.
Recommendation: adopted under explicit user request; test on the target phone before shop use.
Evidence: backend regression suite (54), static React rendering contracts (4), production build. Static rendering does not test interactions, computed styles, scrolling or microphone behavior.
User contribution: selected the glassmorphism direction. AI assistance implemented the source changes and checks; no claim of user-authored code or field testing.
Learning task: run the app, search `fan capacitor`, inspect each candidate and explain why a matching name does not make two ratings interchangeable.


## Theme and evidence forms
User explicitly requested the reference colours and dark mode. Adopted CSS theme overrides without changing the backend or provider models. Preference uses localStorage with failure fallback; API and staff keys are never stored there. Evidence checkbox is preparation only: saved record status remains authoritative, and unsaved technical changes disable verification. Browser accessibility and contrast remain acceptance tasks. User contribution: supplied visual reference and requested theme support.


## Connected store workflow — 2026-11-05

The owner approved moving from isolated catalogue workspaces to one mixed-product
store, with setup, brand search, flexible locations and confirmed stock updates.
Expanded multilingual work was explicitly deferred. The existing React/FastAPI/
SQLite/Gnani architecture is retained; no new hosted database or model dependency.

- Store settings are persisted once per installation. Enabling a product type is
  a search/setup preference, not a separate organisation or authorisation boundary.
- Identity is `(collection, sku)`. Selection and QR lookup carry both identifiers;
  barcode uniqueness is checked across collections. Matching continues to reject
  unexplained query words and contradictory variant specifications.
- Optional location levels include floor. Blank floor preserves the previous six-
  level QR hash so existing printed labels remain usable.
- Stock belongs to a variant/location. `null` means not counted. All changes use
  revision checks, user-bound expiring previews, SQLite `BEGIN IMMEDIATE` and an
  append-only application audit event. A partial move preserves the total.
- Metadata editing cannot change established quantities. Imports may supply a
  recorded count explicitly; missing quantity mapping preserves matching counts.
- The narrow stock speech grammar generates drafts. Database-generated readback
  and explicit confirmation remain separate from transcription. No automatic
  physical stock detection or arbitrary-language understanding is claimed.
- Category graphics are lightweight SVG illustrations. The shelf drawing is made
  from stored shelf identifiers, not an invented building plan. Mobile uses four
  primary destinations plus More so owner controls remain reachable.

The automated tests cover cross-type identity, imports, count semantics, replay,
permission changes, restart persistence and simultaneous confirmations. A failed
mixed import/search test exposed an old substring replacement joining “shirt
Shirts”; normalization now requires whole-word T-shirt boundaries. Browser review
uses API-generated fixtures because the managed preview runtime lacks Python.
It verifies rendering, navigation, forms and theme; it is not a live voice or
full-stack browser test. Final measured results are in `docs/store_validation.md`.

Owner contribution: supplied the mixed-store workflow, requested brands and bulk
imports, chose to defer multilingual expansion, and approved implementation. No
field trial or independent implementation by the owner is asserted. Next hands-on
task: import a sample sheet, move four units, and explain why searching/scanning
must leave the quantities unchanged.
