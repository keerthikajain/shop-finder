# Shop Finder — home-appliance parts guide

Start with **docs/accounts_and_tour.md** for the latest setup and safe upgrade instructions. This update replaces shared staff tokens with individual owner/staff accounts. It is local software; not yet publicly deployed.

## Start on Windows
Open the inner `shop-finder` folder containing backend, frontend and scripts.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-lock.txt
npm ci --prefix frontend
.\.venv\Scripts\python.exe scripts\start_local.py
```

Existing installations only need the source updates described in the guide; keep their database and installed dependencies. The launcher prompts to create an owner on first run. No default login credentials exist. Owners add staff through Account. Choose your interface language independently of your voice language. Choose N at the voice prompt for typed testing.

## Implemented
- Individual owner/staff login, logout, password changes, staff disabling/reset and saved language preferences.
- English/Hindi menus and instructions; English/Hindi and experimental mixed voice input/replies.
- First-use interactive guide with skip, back, next and restart.
- Database catalogue, exact-filter candidate search, clarification, protected editing and evidence review.
- Single-result location card, part photos and staff problem reports to the owner's review queue.
- Pastel glassmorphism, light/dark/system themes and responsive layouts.

20 synthetic demo records are included and remain unverified. Search never confirms substitution or compatibility without evidence. No stock counts or live performance figures are invented. Live voice and browser/device acceptance are pending.

## Validation
Run `npm test --prefix frontend`, `npm run build --prefix frontend`, and from backend run `..\.venv\Scripts\python.exe -m pytest -q`. From the project root use `.\.venv\Scripts\python.exe scripts\smoke.py` for isolated HTTP login/proxy/search/logout checks. No external voice calls are needed.

The current architecture remains React/Vite, FastAPI, SQLite and the Gnani REST voice adapters. Previous milestone documents describe historical versions; accounts_and_tour.md takes precedence for login, setup and permissions.
