# Shop Finder — voice-first warehouse locator

An owner-managed warehouse locator with an authenticated staff workspace, persistent catalogue, verified storage locations, voice recognition (Gnani Prisma), and spoken answers (Gnani Timbre). Built with React, FastAPI and SQLite.

**Release scope:** one organisation and a single persistent application instance. The source is deployable, but a public HTTPS deployment and live Gnani/device acceptance are not yet verified. New databases start empty by default; synthetic records must be enabled explicitly or imported for isolated testing.

See [the current workflow](docs/store_workflow.md) for setup, import rules, stock semantics and a demonstration sequence.

## What is in this update

- New app logo, compact workspace layout, subtle glass surfaces, light/dark themes, phone navigation and English/Hindi interface labels.
- One connected store, with four optional product-type filters and 8 sample items per type. No automotive examples.
- Brands, type-specific and owner-defined specifications, aliases, SKUs, unique product barcodes and multiple storage placements.
- Configurable facility/floor/section/aisle/rack/shelf/bin levels; use the fields actually recorded by the team.
- Owner business setup, configurable staff stock permissions, and whole-store search by default.
- Explicit count, receive, remove and move operations with preview, confirmation, revision checks and audit history. Unknown quantities stay unknown. Search and barcode checks do not change stock.
- One request can contain up to 10 items, separated with “and”, “और”, commas or new lines. Ambiguous variants require a choice or a spoken/typed detail.
- Work lists grouped by request, category or location; item then shelf confirmation using a camera, USB scanner or manual code entry. Manual checks are labelled separately.
- Printable QR labels for items and storage locations. Existing product barcodes can be entered or scanned.
- Excel/CSV import: upload, map columns, review changes, explicitly confirm. Automatic header suggestions, mixed product types, brands and quantities. Maximum 1,000 rows / 80 columns / 4 MB. Exports and blank Excel templates are available in the app.
- Stale exported revisions and edits after import preview block saving. Missing spreadsheet items are not deleted.
- Owners add/edit records and preview/confirm location corrections. Staff can search, scan and report issues. Accounts, preferences, records, reports and change history persist in SQLite.
- Gnani integration reuses the existing server-only key. Voice searches speak the database-backed response when enabled; replay remains available. Hinglish is experimental.

Demo fixtures are available only by explicit opt-in or import. Screens and responses read the database; they do not use fixed result cards or fake analytics. Previously seeded records remain intact after upgrading, and their synthetic status remains visible; switching the seed flag off does not erase saved items.

## Run on Windows in VS Code

Open the inner `shop-finder` folder. You should see `backend`, `frontend` and `scripts` alongside this README.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-lock.txt
npm ci --prefix frontend
.\.venv\Scripts\python.exe scripts\start_local.py
```

On first launch, create your owner username and a password of at least 12 characters. Password typing is hidden. Answer `y` to enable Gnani and paste your working key at the hidden prompt. It is not saved. Open the local address printed by Vite (usually `http://127.0.0.1:5173`).

If Gnani is not configured, answer `n`; typed search and catalogue management remain available, and the voice button must not pretend to record. Complete **Business setup** and import a verified catalogue. Open **More → Settings** to manage account details or staff access; voice language is selected separately near Speak. For isolated end-to-end testing, use the separately supplied synthetic appliance-parts import workbook rather than turning on automatic sample-data seeding.

## Upgrade without losing your accounts

1. Stop the app and back up your database and any uploaded media.
2. Update the same GitHub checkout to the approved release/branch; do not recreate the project.
3. Keep your existing `backend/shop_finder.sqlite3`, or continue using the same `SHOP_FINDER_DB` path.
4. Run the dependency installation commands above, then start the app. New tables are created automatically and older location QR codes remain valid when floor is blank.

Never copy a database while the old app is writing to it. The new warehouse tables are added automatically. Existing home-appliance records are preserved in the legacy tables; they are not silently converted into the four new catalogues. The older parts UI is retained in source for reference but is not the main workspace.

## Demonstrate it

Read [the complete store workflow and demo](docs/store_workflow.md). The older [demo script](docs/warehouse_demo.md) describes the previous catalogue-only release and [what still needs real-device validation](docs/warehouse_release.md). Use synthetic data for the challenge demo.

## Testing

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
npm test --prefix frontend
npm run build --prefix frontend
```

Backend tests cover matching, permissions, sessions, stale imports, audit history, multi-location selection, scan mismatches and restart persistence. Mocked speech tests check the integration contract; they are not live Gnani accuracy tests.

## Deploying

A Dockerfile, Compose file and production static-file entry point are included. Read [deployment instructions](docs/deployment.md). This package has not been published to a public URL. Use one application instance with a persistent disk for this SQLite pilot. Multiple organisations, automatic stock feeds and large-scale warehouse operation require a separate scaling/integration phase.

The app needs its own Python backend; uploading only `frontend/dist` to a static host will not provide accounts, data or voice services. Postman is optional for API debugging and is not a database.

**Production gate:** set `SHOP_FINDER_SEED_DEMO=false`, use a private `GNANI_API_KEY` only on the backend, enable `SHOP_FINDER_SECURE_COOKIE=true` behind HTTPS, attach a persistent `/data` volume, provision the first owner securely, verify database backup/restore, and test voice/camera on the actual deployment before sharing it with reviewers. Do not delete or replace an existing database just to clear synthetic entries.

## Current validation

Run the current automated suite before each release. Refer to [release checks](docs/release_checklist.md) for manual deployment, import, voice and browser validation. Passing tests does not establish live Gnani accuracy or production readiness.


## Grocery Warehouse category

Business setup now offers **Grocery Warehouse** alongside Clothing outlet, Footwear stockroom, Appliance warehouse and Home essentials. It is stored as `collection=grocery`, with separate catalogue filtering, search, owner-managed stock operations and import/export. Supported fields include pack size (`size`), packaging (`material`), volume (`capacity_l`) and colour.

For synthetic grocery testing, use `shop_finder_grocery_warehouse_native_import.xlsx` or the matching CSV supplied with the project handoff. All 40 records must have `collection=grocery`. In the app, sign in as the owner, open **Business setup**, select **Grocery Warehouse**, save, and import the spreadsheet under Grocery Warehouse (or All product types with the collection column mapped). Preview before confirming.

**Existing Home essentials data is not automatically migrated.** If a previous grocery test workbook was imported as `home`, those saved records still belong to Home essentials. Review existing records before importing the new grocery workbook to avoid duplicate-looking results in whole-store searches; use the Grocery Warehouse filter for isolated verification. Do not discard real Home essentials records.
