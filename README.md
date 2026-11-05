# Shop Finder — voice workspace for stockrooms

A working local pilot for finding items in clothing outlets, footwear stockrooms, appliance warehouses and home-essentials stores. React + FastAPI + SQLite, with Gnani transcription and spoken replies.

## What is in this update

- New app logo, compact workspace layout, subtle glass surfaces, light/dark themes, phone navigation and English/Hindi interface labels.
- Four business workspaces with 8 synthetic demo items each. No automotive examples.
- Category-specific specifications, aliases, SKUs, product barcodes and multiple storage placements.
- Facility → zone → aisle → rack → shelf → bin locations.
- One request can contain up to 10 items, separated with “and”, “और”, commas or new lines. Ambiguous variants require a choice or a spoken/typed detail.
- Work lists grouped by request, category or location; item then shelf confirmation using a camera, USB scanner or manual code entry. Manual checks are labelled separately.
- Printable QR labels for items and storage locations. Existing product barcodes can be entered or scanned.
- Excel/CSV import: upload, map columns, review changes, explicitly confirm. Maximum 1,000 rows / 4 MB. Exports and blank Excel templates are available in the app.
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

For a text-only demonstration, answer `n`; search/import/editing still work. Start with Clothing outlet and click the example request. Click Account to create staff accounts or change the app language. Choose voice language independently near Speak.

## Upgrade without losing your accounts

1. Stop the old app and keep its folder as a backup.
2. Extract this package into a new folder.
3. To retain accounts and records, copy your old `backend/shop_finder.sqlite3` into the new `backend` folder before starting. If you use `SHOP_FINDER_DB`, keep pointing to that database instead. Also retain old uploaded media if you used it.
4. Install the updated dependencies using the commands above. Run the new start script.

Never copy a database while the old app is writing to it. The new warehouse tables are added automatically. Existing home-appliance records are preserved in the legacy tables; they are not silently converted into the four new catalogues. The older parts UI is retained in source for reference but is not the main workspace.

## Demonstrate it

See [the short demo script](docs/warehouse_demo.md) and [what still needs real-device validation](docs/warehouse_release.md). Use synthetic data for the challenge demo.

## Testing

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
npm test --prefix frontend
npm run build --prefix frontend
```

Backend tests cover matching, permissions, sessions, stale imports, audit history, multi-location selection, scan mismatches and restart persistence. Mocked speech tests check the integration contract; they are not live Gnani accuracy tests.

## Deploying

A Dockerfile, Compose file and production static-file entry point are included. Read [deployment instructions](docs/deployment.md). This package has not been published to a public URL. Use one application instance with a persistent disk for this SQLite pilot. Large multi-organisation deployment and live inventory require a separate scaling phase.

The app needs its own Python backend; uploading only `frontend/dist` to a static host will not provide accounts, data or voice services. Postman is optional for API debugging and is not a database.
