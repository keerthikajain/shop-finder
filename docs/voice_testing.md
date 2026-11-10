## Conversational picking and report acceptance

On the current PR #67 release candidate, verify this end-to-end sequence with **real** Prisma and Timbre, not only mock CI:

- Say the search request. Review the saved product and shelf matches. Say **Confirm and start picking**; search must never start a picking session without this approval.
- In active picking, say **Found it**. The system asks whether the correct item was picked. Say **Yes** to record the item or **No** to cancel; a single misunderstood utterance must not mark a pick complete.
- Say **Not found** or **Wrong location** to open a report. Dictate what needs checking and optionally the shelf, then explicitly say **Send report**. A worker must never be able to change the owner-verified catalogue directly by reporting.
- Once every item is verified, the system must ask **Ready to finish?**. Say **Yes** to finish or **No** to review. The UI must not silently finish after the last pick.
- In **Activity > Team reports** (owner/manager), dictate a resolution note and say **Resolve report**. The note must be at least three characters and only an authorized account may mark it resolved. Changing shelf locations still requires the verified location-correction workflow.
- The microphone should return to listening after a completed utterance, including unknown speech. Test silence, noise, denial, permission loss and backend 401/502/503 failures; the application must show a clear retry state and never claim that speech succeeded when the provider returned an error.
- On a phone, check that T-shirt variant images are small and text, sizes, shelf options and recent requests fit without unnecessary scrolling. The shortcut controls should be collapsed until needed.

The actual model output may not exactly match every command phrase. Record recognized transcripts and observed errors; do not equate voice-grammar unit tests with live recognition accuracy.

## Current voice-first picking acceptance (PR #64)

Use the latest `feature/judge-self-service-workspaces` branch rather than the older `main` branch when verifying these changes.

1. With `GNANI_ENABLED=true`, a valid private key, `GNANI_TTS_MODEL=timbre-v3.0`, and `GNANI_TTS_VOICE=Prakash`, grant the browser microphone permission on localhost or HTTPS. The local `scripts/start_local.py` now reads approved private `.env` settings; it does not print the key.
2. Speak a known product and **pause**. Confirm the search recording stops automatically, the actual Prisma transcript appears under **You said**, the stored catalogue item is selected, and the saved shelf is displayed.
3. When **every** item has a unique saved item and location, picking should start automatically. There must be no need to press **Start picking**. If a variant is ambiguous or a shelf is missing, picking must not start until the worker resolves it.
4. In active picking, with **Hands-free picking commands** enabled, the UI should display **Listening for a picking command** once Timbre finishes reading guidance. Say **repeat location**, pause, and confirm the recognized command is visible and the actual shelf is repeated by Timbre. Repeat with **next item**, **found it**, **wrong location**, and **stop**. The microphone must pause during audio playback and while a scan/report modal is open.
5. Say **found it**: scan the item and shelf, or explicitly choose a manual check. Voice alone must not confirm the item, adjust stock or record a shelf correction.
6. Say **wrong location**: the app must show a report form, but not submit a report or change the recorded shelf without worker confirmation.
7. Test no speech, microphone permission denial, network failure, and **Pause hands-free microphone**. An idle recording should not send audio for transcription, and repeated provider failures should pause the listener rather than retry forever. The manual microphone and text search remain fallbacks.
8. Test English, Hindi, Hinglish, Kannada and Telugu with real microphones (quiet and moderate noise). Measure actual transcription, command accuracy, final location, pronunciation of alphanumeric shelf codes, and recovery from recognition errors. Automated mocked tests **do not** establish these figures.
9. If Prakash does not speak, inspect the backend/network error, verify account access to Timbre v3 and confirm the local launcher loaded the private env. The existing fallback is `GNANI_TTS_MODEL=timbre-v2.5`; this uses the older per-language voice map, **not** Prakash.

This is a release acceptance checklist, not a claim that live Gnani and mobile/browser testing has passed. Browser permission and audio-autoplay restrictions can still require a user action.

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

## Prisma V3 Speech-to-Text integration (validated contract, live acceptance required)

Shop Finder's recording control uses **Prisma V3.0** by default on the authenticated server endpoint `POST /api/voice/transcribe`. It records up to 28 seconds as 16 kHz PCM WAV and submits to Gnani's REST `POST /stt/v3` endpoint. This is **record-then-transcribe** (not a real-time WebSocket or live captions). The API key stays in backend environment variables and never goes to the browser.

Supported settings in the Find interface:

| Option | Gnani REST form field | What it does |
| --- | --- | --- |
| English | `language_code=en-IN` | English-only expectation |
| Hindi | `language_code=hi-IN` | Hindi-only expectation |
| Hinglish | `language_code=indic-auto` | Auto-detect spoken Hindi/English; preserve Hinglish reply mode |
| Auto-detect | `language_code=indic-auto` | Detect Hindi or English, use detected language for the search/reply |
| English/Hindi detection hints | `multi_lang_codes=hi-IN,en-IN` | Preferred languages for a short recording (a hint, not a limit) |
| Readable numbers | `format=transcribe` | Prefer normalized quantities like 5 kg |
| Code-mixed | `format=codemix` | Keep English terms in Latin script |
| As spoken | `format=verbatim` | Preserve spoken wording |
| Latin letters | `format=transliterate` | Use Latin transcription |
| Catalogue accuracy hints | `keywords` JSON array | Up to 80 actual product names, brands and aliases from the user's selected warehouse catalogue |
| General context | `topic` | Short general warehouse topic, without customer/location data |

Output formats and candidate-language hint semantics follow Gnani's public `gnani-vachana` SDK form builder. The transcript remains editable and never changes the selected SKU or shelf without the app's own matching/confirmation. On Auto mode, the response's supported `detected_language_code` is mapped into the search language; the two-step check remains.

**Rollback:** set `GNANI_STT_MODEL=prisma-v2.5` on the server to use the documented old profile. This disables V3-only controls; restart the backend after changing it. No automatic retry on a different STT model occurs after a failed request.

**Limits:** the screenshot's real-time playback/partial live transcription is a *separate* `/stt/v3/stream` WebSocket feature. Shop Finder does not yet implement that stream; test it separately before describing it as built. Enhanced language detection and product hints improve the input context but **do not guarantee** that Hindi, Hinglish, names or sizes are recognized perfectly.

Manual acceptance: speak the same product in English, Hindi and Hinglish; inspect the raw transcript and detected language, compare exact SKU/variant/location, record timings and provider errors. Run with a genuine server-side key and real microphone. No provider audio test is performed in CI.



## Optional live Prisma V3 speech segments — secure WebSocket

The Find panel offers a **Live speech segments** toggle for signed-in Prisma V3
users. It is **off by default**; record-then-transcribe REST remains available.
Live audio is sent during recording and completed VAD *speech segments* can
appear before recording ends; Gnani does not promise word-by-word interim
hypotheses. The worker still reviews/edit the transcript before searching.
Nothing automatically changes stock or a saved location.

The browser sends 16 kHz mono, 16-bit raw PCM in 1,024-byte frames to Shop
Finder's authenticated, same-origin /api/voice/live WebSocket. The server
checks the account session, Origin, length and audio frame sizes. It connects
to Gnani's V3 streaming endpoint with a backend-only key; the browser never
receives the provider credential. Up to 80 catalogue product names/aliases
are passed as provider keyword hints. No shelf locations or account details.

The local Vite /api proxy supports WebSocket upgrades. On public HTTPS,
configure the reverse proxy to preserve Host and Origin and forward Upgrade
and Connection headers, and keep idle WebSocket timeout above 45 seconds.
Use secure cookies and a persistent server. This pilot is not load-tested.

Live acceptance still required:
1. Test English, Hindi and Hinglish on real hardware with a valid V3 key.
2. Confirm segments appear before Stop (when provider VAD finalizes them)
   and that a full editable transcript is returned after Stop.
3. Switch Live off and re-test the existing recorded REST voice mode.
4. Test microphone denial, session expiration, disconnected network and
   unknown product. Show actionable failures without fabricated results.
5. Repeat on the public HTTPS URL, and record timing and accuracy separately.

When live streaming is unavailable, **turn off Live speech segments** and
continue using the tested record-then-transcribe path. Passing mocked API
tests is not proof that your account's live streaming is enabled.
