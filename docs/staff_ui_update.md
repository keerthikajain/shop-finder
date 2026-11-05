# Staff forms and result layout update

The staff editor no longer exposes product JSON. Add specifications or dimensions using a field selector; choose Other field for a named field with a unit. Remove deletes only the selected field. Existing data and verification evidence are preserved. Source references, reviewer and checked time remain normal evidence form fields. Synthetic records remain unverified.

One search result now renders one complete card with rack/shelf/box highlighted. Expand Specifications and additional details for the full list and aliases. Multiple matches retain selectable cards. Below 760 px, selecting a match hides the results list and provides Back to results. Colours and Light/Dark/System themes are preserved.

Validation: 10 frontend automated tests and production build passed. These include rendering checks for one location panel and normal staff controls. They do not replace actual browser, keyboard, phone and staff acceptance tests. No backend or dependency changes, no live voice calls.

## Update the existing Windows installation
Stop the app with Ctrl+C and back up the project. Extract this ZIP separately. Copy the entire frontend/src folder from its shop-finder folder into your existing shop-finder/frontend/src, replacing matching files and including technical-fields.jsx. You may also copy frontend/tests and docs. Keep your existing database, .venv and frontend/node_modules. No dependency installation is required for this change.

Restart with .\.venv\Scripts\python.exe scripts\start_local.py and refresh the browser. Test SYN-008, then fan capacitor for several candidates. In Staff Editor, add a dimension, enter a value, save and reopen to verify it persists. Try the same on a narrow screen and check Back to results.
