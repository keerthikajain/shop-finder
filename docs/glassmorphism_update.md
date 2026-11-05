# Applied glassmorphism design — 29 October 2026

## Delivered

The application now follows the earlier desktop-and-mobile glass concept. This is an implementation in React/CSS, not a generated screenshot. The bento-grid concept was an alternative preview; the selected glass style governs this update.

- Frosted ivory panels, lavender navigation, plum controls and mint location tiles.
- Desktop sidebar, compact labelled tablet navigation and a four-item phone navigation row.
- A search form with editable transcript, explicit English recording state and configuration guidance.
- Exact-specification disclosure and explicit Apply clarification action. Query and API contracts are preserved.
- Part cards showing exact identifiers, all recorded specifications with units, connectors and synthetic status.
- Selected details with separate Rack / Shelf / Box tiles. No location is invented before selecting a record. Mobile selection moves the panel above results and focuses it.
- Catalogue appliance filter; all six existing appliance categories remain available.
- Matching design for staff access, record editing, evidence disclosure and unresolved-question review.
- Visible errors, status updates, locked voice controls, empty states and loading states.
- Keyboard focus styles, skip link, labelled icon navigation, reduced-motion/transparency and forced-colors CSS fallbacks.

Category icons are illustrations of appliance categories. The catalogue has no authentic photographs; this update does not create fake product photos. All 20 seed records remain synthetic and unverified. Search returns candidates, never compatibility or substitution recommendations.

## Files

- `frontend/src/main.jsx`: application layout and existing workflows.
- `frontend/src/components.jsx`: shared icons, part cards, unit formatting and selected details.
- `frontend/src/style.css`: design tokens, glass surfaces and responsive rules.
- `frontend/tests/render.test.mjs`: static rendering contracts, using installed build tooling.

The backend, database schema, Gnani models and seed data are unchanged.

## Validation

- 54 backend regression tests passed; one existing Starlette/httpx deprecation warning.
- 4 static React rendering tests passed: all 20 fixtures retain identifiers/provenance/connectors; electrical and dimensional units retain precision; unselected details invent no location; catalogue strings are escaped.
- Vite production build passed.
- Local HTTP smoke checks passed: launcher starts, frontend serves, proxy reaches FastAPI, SQLite returns 20 records and the fan category returns 4 records. This is not browser automation.
- Browser preview attempted but could not start the Python backend in the managed preview runtime (`spawn python ENOENT`). No browser, touch, computed-style, screenshot, contrast audit or real microphone validation is claimed.
- No live Gnani requests, public deployment, posts or submissions were performed.

The tests do not establish complete accessibility, safe real-world compatibility or device performance. Use the updated user acceptance checklist on your laptop and phone.

## Run

Use the README setup and existing `scripts/start_local.py` launcher. For the first UI review, keep live Gnani disabled. No additional runtime dependency or API key is needed for the visual update.

Frontend checks from the project root:

```bash
npm test --prefix frontend
npm run build --prefix frontend
```

Backend checks use the project Python environment, as documented in README.
