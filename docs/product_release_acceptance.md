# Release acceptance — Shop Finder

This document separates **automated verification** from checks that require a hosting account, a live Gnani key or a real device. Do not call the public release complete until every critical manual gate has passed.

## Deployment profile

- One company / organisation per installation. The server is FastAPI + React static assets + persistent SQLite.
- **Fresh databases start empty.** Synthetic records are not inserted unless `SHOP_FINDER_SEED_DEMO=true` is explicitly set. Turning that setting off later does not delete previously saved test items. Do not delete an existing database to remove examples.
- Store `GNANI_API_KEY` in backend host secrets only and set `GNANI_ENABLED=true` when testing live Gnani.
- The public endpoint must use HTTPS, `SHOP_FINDER_SECURE_COOKIE=true`, an attached persistent `/data` disk and one backend instance.
- Create the first owner account through the server command. Do not ship default credentials. Back up any existing database before upgrading.
- Do not deploy the `frontend/dist` directory alone: it does not contain authentication, the catalogue, reports or Gnani endpoints.

## Import test

The supplied test pack is `shop_finder_grocery_warehouse_native_import.xlsx` (or matching CSV). The pack contains 40 **synthetic grocery/household warehouse records**, with unique SKUs, fictitious internal barcodes, Hindi/English aliases, and assigned aisles/racks/shelves/bins. Food items and cleaning supplies are stored in different recorded zones. No live inventory or food-safety claims are made.

1. Log in as the owner and complete Business setup. Enable **Grocery Warehouse** as a product type.
2. Go to **Import items** and choose the file. Choose **Grocery Warehouse** or **All product types**.
3. Confirm mapping for SKU, collection (for All), name, brand, category, barcode, aliases, synthetic, facility, floor, zone, aisle, rack, shelf, bin, quantity, size, material and capacity_l.
4. Preview. On an empty catalogue expect **40 create / 0 update** with **no errors**. Confirm to save.
5. Reload and verify the 40 records and zero-padded location bins. Search for `GRC-002`, `basmati rice 5 kg`, `toor dal 1 kg`, `chai patti` and `dishwashing liquid`; use unambiguous SKUs for exact locations.
6. Repeat with voice after enabling Gnani; transcription must be reviewed before the search.
7. Check the optional **Yes, here** and **Wrong location** result actions. Silence must create no report. Wrong creates an explicit report. Owner verifies a new shelf via the guarded Move editor; only then do future results change.
8. Test an invalid duplicate barcode, a malformed row, an old revision and missing mandatory values in a **separate copy**. The app must reject those changes before committing.
9. Restart the server and ensure saved records and accounts survive.

## UI and role checks

- Desktop: sidebar and header navigate to real pages; no unnecessary Back button on desktop; Settings holds the profile, language and theme.
- Phone at 309px, 375px, 390px and 768px: five-slot nav, working Speak action, readable filters, no content hidden under bottom bar, no horizontal clipping, no overlapping dialogs. Log in and use the app with physical device touch input.
- Staff can search, scan and submit location reports. Staff cannot create accounts, import catalogue data, change the organisation setup or approve owner-only moves.
- Confirm a location at a point in time without asserting it will always be there. A report is created **only** when explicitly submitted.
- The dark/light theme can be toggled inside the workspace; sign-in remains neutral.

## Live Gnani and hardware gate

Use the private server-side API key to test Prisma STT and Timbre TTS with actual microphone input and speakers. Repeat at least 20 English/Hindi queries plus selected Hinglish cases, including multiple items and ambiguities. Record expected SKU, transcript, selected SKU, clarification required, voice reply, observed errors and latency. Test microphone denial, network failure and API exhaustion. Verify camera scan and printed QR labels over HTTPS.

**These results cannot be inferred from successful unit tests.** Avoid claiming a tested live integration until recordings and TTS playback work on the actual deployment.

## Production acceptance

- [ ] GitHub backend tests, frontend tests and production build pass
- [ ] Production Docker image builds and starts against an empty persistent database
- [ ] Private owner account created, owner/staff permissions and logout tested
- [ ] Import pack preview, confirmation, search and restart persistence tested
- [ ] Wrong-location report, owner correction and new search location verified
- [ ] HTTPS, secure cookies and Gnani secrets configured and checked
- [ ] Backup/restore verified on a separate copy
- [ ] Desktop/mobile screenshots checked manually with no clipping
- [ ] Live Gnani STT and TTS tested and failures recorded
- [ ] Actual public review URL works from another device

This is a focused single-organisation pilot, **not** a multi-tenant, scaled inventory SaaS. No automatic live stock synchronisation or hardware stock sensing is claimed.
