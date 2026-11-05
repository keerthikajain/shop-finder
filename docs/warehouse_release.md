# Warehouse release — 3 November 2026

## Implemented

The new default workspace includes 32 synthetic items across four business catalogues; a branded responsive light/dark interface; English/Hindi controls; separate English/Hindi/experimental Hinglish speech selection; multi-item requests; explicit variant and location choice; spoken clarification input; grouped stops; product and shelf scan confirmation; QR labels; spreadsheet mapping/preview/confirmation; manual record editing; multi-location records; owner-confirmed location moves; staff reports; audit history; accounts and preferences.

Existing part-catalogue data and legacy endpoints are preserved. New warehouse records are separate and initialise without overwriting your old accounts. Runtime counts and responses come from SQLite, not fixed UI results.

## Verification and limits

Final automated checks: **93 backend tests and 17 frontend tests passed**, and the production build succeeded. See `evaluation/results/warehouse-tests.xml` and the included test source. Frontend tests cover audio encoding, escaping, location/identifier rendering, translations and previous UI contracts. The production static-serving smoke check returned HTML 200, auth-status 200, and 401 for unauthenticated warehouse access. Tests ran on Linux/Python 3.12; Windows/Python 3.13 still needs a local run. The dependency emitted a non-failing Starlette/httpx deprecation warning.

Desktop and a 390px-wide phone-frame layout were inspected in the browser using an isolated visual fixture generated from actual backend TestClient responses. This checks layout and client rendering, not a live network connection to Python. The managed browser preview host reported `spawn python ENOENT`; the actual backend was exercised separately with TestClient. The visual fixture lives outside the production app and does not intercept production requests.

The real microphone, Gnani credits/latency/recognition, spoken pronunciation, phone camera and USB scanner require testing on your devices. The existing key was reported working by you; no private key was supplied to this build environment. Mocked TTS tests verify that the server passes stored locations and the chosen language, not speech quality.

Docker/Compose files and a production entry point are included. A container build and public deployment have not been verified here. No public URL or production readiness is claimed.

## Exact matching behaviour

Search uses catalogue names, aliases and explicit specifications. It recognises a bounded English/Hindi vocabulary and simple numeric/size phrases. It is not an open-ended language model. Separate items with “and”, “और”, commas or new lines. Unsupported details remain unresolved. A part code with contradictory size/specification must not silently match.

Only unambiguous item+location pairs are selected automatically. Otherwise a user supplies a detail or chooses a variant and placement. Scan confirmation rechecks the record revision; a changed catalogue requires a fresh search. Confirming an item never changes inventory quantity.

Exported spreadsheets include a revision column. Keeping it detects stale exports. Third-party spreadsheets without a revision can only be compared against the current database in preview, so the owner must inspect differences. Changes after preview always block the entire commit. Up to 1,000 rows and 4 MB are accepted. Duplicate/conflicting rows and formulas are rejected. Repeated SKUs can represent several placements when their product details agree.

## Remaining before a public demonstration

1. Run this release locally with your existing working key.
2. Run the demo script in all four workspaces and test 10 requests per voice mode.
3. Test a printed QR pair and a wrong item/shelf label on your phone. Test the USB scanner if you have one.
4. Import a revised Excel file, restart, and check persistence. Test with a staff account as well as the owner.
5. Choose the hosting provider and deploy with a persistent disk and HTTPS; then repeat the same checks on its public URL.
6. Record a short real walkthrough and report the measured successes and failures.

## Simple explanation for your mentor

“We have expanded Shop Finder into a voice-based warehouse locator. It supports clothing, footwear, appliances and home essentials with different product details. Staff can ask for several items, clarify the correct sizes, see the exact storage locations and confirm them by scanning labels. Owners can import Excel files, correct locations and see a history of changes. The new interface has a logo, light/dark themes and phone layouts. We are now validating real voice and scanning on devices and preparing the public deployment.”
