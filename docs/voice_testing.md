# Voice and layout acceptance

This update is ready for local testing, not a claim that every language works accurately. Hindi and Roman aliases are a bounded vocabulary. Mixed Hindi/English mode is experimental: Hindi STT plus a Hinglish voice, not automatic multilingual recognition. Replies use catalogue templates and never invent compatibility.

## Update your installed Windows project
Stop the running servers and back up the current project first. Extract this ZIP separately. Copy its frontend/src, frontend/tests, backend/app, backend/tests, scripts, docs and evaluation folders into the corresponding existing project folders; also copy README.md. Keep your existing .venv, frontend/node_modules and backend/shop_finder.sqlite3. Dependency files have not changed for this update. Do not replace a database containing your own records with the demo database.

Run from the existing shop-finder folder:
```powershell
.\.venv\Scripts\python.exe scripts\start_local.py
```
Choose Y only when ready to use your Gnani account credits. Enter the API key at the hidden local prompt; enter the generated staff token in Staff Editor. Open the Vite URL printed in the terminal. Selecting N still supports typed search, themes and layout testing.

## Comparable language tests
Select English, Hindi or Hindi + English. Enable the optional testing log. Record under 28 seconds, check the transcript (especially ratings and identifiers), then confirm. With automatic speech enabled, the answer should play. If the browser blocks playback, use Play audio. Keep the original transcript in the log and mark transcription mistakes before correcting them.

Use the same speaker, microphone and noise level for each language. First try these equivalents:

| English | Hindi | Mixed | Expected demo candidates |
|---|---|---|---|
| fan capacitor | पंखे का कैपेसिटर | pankhe ka capacitor | DEMO-008, DEMO-009, DEMO-010 |
| SYN-008 | SYN-008 | SYN-008 | DEMO-008 (check spoken identifier transcription) |

For the ambiguous capacitor result, provide capacitance and voltage using the exact-specification filters. The 2.5 µF, 440 V combination should narrow to DEMO-008. Also test Record clarification reply, missing ratings, incorrect identifiers, silence, microphone denial and an unavailable network. Unknown requests should ask for clarification or staff review. Check each displayed location against the catalogue; demo locations are fictional.

## Diagnose failures
- Wrong words or digits in the transcript: transcription/number error.
- Correct transcript but wrong candidate set: search error.
- Follow-up loses an earlier filter: clarification error.
- Correct text but missing/incorrect voice: synthesis, playback, browser permission or voice-language issue.
- API timeout or account error: provider error, not proof a language is inaccurate.

Mark the outcome and expected result for each event, then Export JSON. Logs stay only in the current tab until exported and can include spoken text; avoid sensitive speech. Clear logs between testers. To summarize a downloaded export:
```powershell
.\.venv\Scripts\python.exe scripts\analyze_voice_log.py "C:\path\to\export.json"
```
The report groups events by language and stage, retains unreviewed outcomes and does not claim overall accuracy. Repeat the same script in quiet and noisy conditions; use fresh phrases for final evaluation.

## Still pending
Actual Gnani STT/TTS calls, Hindi/English/mixed pronunciation and recognition quality, real browser/mobile layout and audio checks, real inventory/evidence and field validation. No paid API call was made during development. Automated tests use provider mocks; HTTP smoke tests do not replace browser testing.
