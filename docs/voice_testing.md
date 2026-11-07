# Shop Finder — voice-first preflight and acceptance

This is the **manual testing plan**, not a report of real Gnani accuracy. Automated tests use mocks and run without paid API calls. Do not use real customer recordings or private store records for the synthetic challenge demo.

## Update the app safely

From the existing Windows VS Code project folder (the folder containing `frontend`, `backend`, and `scripts`):

```powershell
git switch main
git pull origin main
.\.venv\Scripts\python.exe scripts\start_local.py
```

Do **not** delete `.venv`, `frontend/node_modules`, accounts, or the existing SQLite database. Back up the database before updating and stop previous backend/frontend processes. For the first UI-only inspection choose **N** at the “Enable live Gnani calls” prompt. When ready for live API tests, restart and explicitly choose **Y**; the API key is entered in a hidden server-side prompt and is not stored in the repository or frontend.

## Phase 1 — inspect UI and deterministic workflows (no live API credit)

1. Owner signs in. Verify the Find page has the main introductory heading; Catalogue, Locations and More use concise section titles. Main navigation tabs have no Back button. Import, Business setup, Activity and Settings (inside More) have Back to More.
2. Under **More → Settings**, verify app language, appearance, account profile and role-appropriate team settings. Changing app language must not modify the voice language selector; those are separate preferences.
3. At mobile widths **309, 375 and 390 px**, check the bottom navigation, shelf cards, filter dropdowns, scrolling and dialogs. No clipped content, duplicate headings, overlapping Speak caption or horizontal scroll. Also check desktop.
4. With Gnani disabled, the central action should open text search (not pretend to record). Text search still works and never invents a location.
5. Search for a unique catalogue item. Verify it displays only saved location fields. `Yes, here` is **optional**; tapping it stores a time-specific check but does not change stock or create an issue.
6. Search but give **no** location response. There must be no location confirmation and **no automatic report**. Search for an unknown item: show no match, with an explicit optional `Report missing item` action.
7. Tap **Wrong location** for a matched item. Enter an optional suggested new shelf, submit a report, and verify Activity shows an open wrong-location issue. Do not auto-update the catalogue from the worker's suggestion. Duplicate open reports for the same item/shelf are coalesced.
8. As owner, open `Activity → Verify and update location`, inspect the exact item and source shelf, enter the verified new location, preview and confirm. The old shelf's matching reports should resolve and the next search should return the saved location. Other unrelated reports should remain open.
9. Confirm the app rejects a stale location check or move after the product revision changes. No search, report, or positive location check should adjust the recorded quantity.

## Phase 2 — live Gnani STT and TTS

Only after Phase 1 passes, restart and choose Y to enable the Gnani key. Use synthetic catalogue items.

| Case | Action | Expected result |
|---|---|---|
| English voice | Tap the large Speak action from Find, say a known item, stop | Transcript appears, can be checked/edited, and searches the verified catalogue |
| Other tab | Tap Speak from Catalogue or More | Starts recording on the **first tap**, then takes you to Find when the transcript is ready |
| Hindi voice | Select Hindi and speak a synthetic item name | Transcription returned; identifiers, quantities and shelf letters are checked before searching |
| Hinglish | Choose experimental Hinglish | Accept only verified matches; mixed recognition is not assumed accurate |
| Multiple items | Speak two or three item names | Each item gets its own result or clarification, not invented placements |
| Ambiguous variant | Ask for a product without its required size/rating | Prompt to choose or clarify the exact model before showing a location |
| Spoken reply | Enable Speak answers and complete a voice search | Gnani Timbre response plays, or an actionable playback error appears |
| Refusal/permission | Deny microphone permission | Clear error; manual search remains available |
| API disabled/network error | Disable Gnani or break test connection | Graceful error and text fallback, never fake a transcript |
| Location moved | Search an item before and after an owner-verified correction | Subsequent voice/text response uses the updated saved shelf |

Use the same speaker and microphone for comparison. Repeat in quiet and moderately noisy conditions; check transcription of **part numbers, model names, ratings, sizes, rack/shelf/bin numbers**, and spoken Hindi and English separately. Record **expected match, transcript, actual match, whether correction was needed, location accuracy and end-to-end response time**; don't report a reliability percentage without observed data.

## Known limitations and release gate

- Live provider calls, smartphone microphones, camera/barcode scan and responsive rendering still require manual testing. Automated backend and frontend checks do **not** prove live Gnani behaviour.
- Hindi-English mixed speech uses the experimental provider configuration; avoid claims of complete multilingual understanding.
- Search answers use stored catalogue records only. Correct location feedback means *checked on one visit*, not a permanent guarantee. Silence means *no feedback*, never a verified confirmation.
- New location reports are reviewed; only an authorised, explicitly confirmed location move updates the actual placement. A location change is distinct from stock movement.
- Public release requires persistent storage, HTTPS, controlled credentials, backups, and a separate security review. Follow `docs/release_checklist.md`.
