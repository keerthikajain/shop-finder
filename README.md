# Shop Finder — voice workspace for stockrooms

A working local pilot for finding items in clothing outlets, footwear stockrooms, appliance warehouses and home-essentials stores. React + FastAPI + SQLite, with Gnani transcription and spoken replies.

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

Demo records are explicit synthetic fixtures, inserted once. Screens and responses read the database; they do not use fixed result cards or fake analytics. Product names and location identifiers are preserved as entered rather than translated automatically.

## Run on Windows in VS Code

Open the inner `shop-finder` folder. You should see `backend`, `frontend` and `scripts` alongside this README.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-lock.txt
npm ci --prefix frontend
.\.venv\Scripts\python.exe scripts\start_local.py
```

On first launch, create your owner username and a password of at least 12 characters. Password typing is hidden. Answer `y` to enable Gnani and paste your working key at the hidden prompt. It is not saved. Open the local address printed by Vite (usually `http://127.0.0.1:5173`).

For a text-only demonstration, answer `n`; search/import/editing still work. Complete Business setup, then keep All product types selected and click the mixed-item example request. Click Account to create staff accounts or change the app language. Choose voice language independently near Speak.

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

## Current validation

The connected-store release passes 109 backend tests and 19 frontend tests, and the
production frontend builds. See [validation and remaining checks](docs/store_validation.md).
These results do not establish live Gnani accuracy or public deployment.
