# Store workflow validation

Recorded for the connected-store implementation, November 2026.

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Backend suite | 109 passed, 0 failed | `evaluation/results/store-workflow-tests.xml`; Python 3.12 in the development environment |
| Frontend suite | 19 passed, 0 failed | Node test runner; WAV conversion, rendering, escaping, theme, stock speech grammar |
| Production frontend | Build passed | Vite 7.3.7; 317 transformed modules |
| Desktop UI | Reviewed | Whole-store search, mixed results, item details, count form, shelf diagram, theme toggle |
| Mobile UI | Reviewed at 390 × 844 | Responsive frame, main navigation, More menu and business setup |
| Live speech and scanner | Pending | Requires the owner's configured Gnani account, microphone and physical device |
| Public deployment | Pending | Requires a Python/Docker host, persistent disk, HTTPS and owner setup |
| Multi-user warehouse load | Not measured | One organisation, one process, SQLite pilot |

Backend regression coverage includes owner/staff permissions, persisted settings,
whole-store brand matching, duplicate SKUs across product types, barcode identity,
optional location levels, mixed CSV/XLSX round trips, missing locations, stale
exports, unknown quantities, physical counts, receipt/removal, partial transfers,
replayed previews, permission revocation and simultaneous confirmations. A search
or scan cannot decrement stock. The four example import files are also tested.
Speech readback tests mock the provider and verify the exact stored preview is
spoken without applying the change; they do not measure pronunciation or latency.

Browser review used actual built frontend assets and API-generated sample response
fixtures. The managed browser preview runtime could not start Python (`spawn python
ENOENT`), so this was a visual/navigation check, not a live full-stack browser test.
No fixture interceptor, dummy preview account or bypass is included in application
source. Server workflows were exercised independently with FastAPI TestClient and
temporary SQLite databases. One upstream Starlette/httpx deprecation warning was
reported by the tests; no test failed because of it.

## Acceptance check on the owner's machine

Back up the existing database first, update to this branch and run the README
commands. Complete Business setup, import a sample file, restart the app and confirm
that data remains. Search across two product types, resolve a size ambiguity, scan
an item/location, and check that quantities are unchanged. Record a count, receive
stock, move a partial quantity and inspect Review & history. Repeat as staff to
check allowed and denied actions. Then test live English voice input/readback,
phone microphone permission, camera/USB scanning and HTTPS playback. Record actual
failures before expanding multilingual support.

A deployment is not complete until the hosted database survives a restart, backup
and restore work, secure cookies are enabled under HTTPS, and the live checks above
pass. Build success alone does not establish production readiness.
