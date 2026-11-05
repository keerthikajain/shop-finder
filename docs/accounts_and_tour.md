# Accounts, languages and guided use

This is an implemented local application update, not a hosted production release. It adds real SQLite accounts and sessions, English/Hindi interface resources, a first-use walkthrough, owner-managed staff, photos and problem reports. No paid voice calls were made during development.

## Upgrade your existing Windows installation
1. Stop the servers with Ctrl+C. Back up the complete existing shop-finder folder.
2. Extract this ZIP separately. Copy its `backend/app`, `frontend/src`, `scripts`, `docs` folders into the matching existing folders, replacing files. Copy tests and README if desired.
3. Keep your existing `.venv`, `frontend/node_modules`, `backend/shop_finder.sqlite3` and `backend/photos`. Do not overwrite a database containing your changes with the ZIP's sample database. Dependencies are unchanged.
4. From the existing shop-finder folder run:

```powershell
.\.venv\Scripts\python.exe scripts\start_local.py
```

On first launch, the terminal asks you to create the owner username and password. Choose your own password with at least 12 characters. Password input is hidden. There are no default credentials. Later launches reuse the account. Choose N for voice until ready to use your Gnani account credits. The old staff token is no longer used in the app.

Open the Vite URL and log in. Account → Create staff account adds an individual worker. Owners can disable a worker or reset their password, closing their sessions. Everyone can change their own password; this logs them out everywhere. Log out before another person uses the same browser.

## Roles
- Owner: catalogue editing, photo upload, evidence verification, unresolved reviews, staff management, search and voice.
- Staff: catalogue viewing, search, voice, problem reports and their own preferences. Staff cannot edit inventory records or manage users through direct API requests.

The app language selector changes menus and instructions between English and Hindi and saves the choice per account. Product names, user-entered notes, identifiers, units and manufacturer information remain as recorded, so language changes cannot alter catalogue identity. Diagnostic test exports and unexpected provider/network errors may retain their original technical English.

Voice language is separate: English, Hindi, or experimental mixed Hindi/English. There is no promise of arbitrary-language speech recognition or automatic language detection. Live accuracy, accents and noise still need evaluation.

## Guided first use
The walkthrough highlights voice language, input, confirmation, results and playback. It offers Back, Next and Skip, waits for a nonempty query and a matching result, and explains typed search when voice is unavailable. Completion or skipping is saved per account. Restart tour is always available. The static three-card guide has been removed.

## Photos and reports
Owners can upload PNG/JPEG photos under 3 MB in the editor, then save the record. Photos are stored alongside the database in `photos/` and require login to view. Back up the folder with the database. Product photos are references, not proof of compatibility. Removed/replaced images are retained on disk; there is no automatic media cleanup.

For a single result, the support panel offers a part photo when available and reports for empty box, wrong location or different-looking part. Reports are saved to Unresolved and do not mutate stock or locations. Duplicate open reports with the same part and reason/note reuse the existing report.

## Data and deployment boundaries
All catalogue/account/preferences/reports come from SQLite. Passwords use salted PBKDF2-SHA256 hashes; session tokens are random, stored hashed and revoked on logout/reset/disable. Cookies are HttpOnly and SameSite Strict, with 12-hour expiry. Login attempts are limited. Mutation requests require the same-origin application's custom header. No passwords or API keys are placed in browser storage or shipped in the ZIP.

The bundled catalogue is still 20 clearly labelled synthetic examples. To start an empty fresh database, set `SHOP_FINDER_SEED_DEMO=false` before the first launch. This does not delete existing sample records. Branding, UI labels, translation dictionaries and supported language options are intentionally application code, not live shop data.

Local launch binds to 127.0.0.1. Public deployment still needs HTTPS, `SHOP_FINDER_SECURE_COOKIE=true`, an agreed hosting/storage/backup plan and browser/security acceptance. Do not expose the development server as a production service. No public deployment was performed.

Validation: 76 backend tests and 12 frontend tests pass, along with the production build and local HTTP smoke check. See `evaluation/results/accounts-tests.xml`, `account-ui-tests.txt` and `account-smoke.json`. Automated API, rendering and HTTP checks do not establish actual phone layouts, microphone permissions or live voice quality. Test both roles, both UI languages, first-use and restarted tours, logout/back navigation, photo upload and reports on your actual devices.
