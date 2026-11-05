> Historical accounts/parts release notes. For the current warehouse release, read [warehouse_release.md](warehouse_release.md), [warehouse_demo.md](warehouse_demo.md), and the root README.

# What you need to do

1. Download/extract the bundle. In the shop-finder folder, install Python 3.12+ and Node 22.12+ if absent. Run the setup commands in README.
2. Start with `.venv\Scripts\python.exe scripts\start_local.py` on Windows (Linux/macOS: `.venv/bin/python scripts/start_local.py`). It prints a new local staff token. Copy it into Staff Editor. Choose N for live Gnani initially. The token is not the Gnani API key.
3. Test the typed flow: search `fan condenser`, choose SYN-008 under exact part number, apply to current candidates, inspect the demo location. Search `SYN-008 450 V` and confirm no candidate. Check Unresolved and record a resolution. Change an alias in Staff Editor and confirm verification is reset.
4. Run the tests and evaluation. Read the failed query cases. Explain why a shared nickname is insufficient to establish compatibility. Your understanding and personal work have not been assessed yet.
5. When ready, restart the launcher, choose Y and enter your Gnani key into the hidden local prompt. Check your programme credits first; do not paste the key into chat, source files or the browser. Actual calls may consume credits. Keys are not saved by the launcher.
6. Allow microphone access on localhost. Record a short English query first. Verify the editable transcript, especially numeric ratings. Search it, then use Speak current response. Record actual STT/TTS results and latency; do not represent offline mocks as live usage. Hindi/native-script and mixed-language matching need further validation before claiming support.
7. With your dad or experienced staff, collect real home-appliance part names, aliases, manufacturer/model, exact part numbers, ratings, dimensions, connectors and locations. Record source evidence. Keep compatibility unknown until verified. Synthetic fixtures cannot simply be toggled into verified parts.
8. Test on your phone and with a new worker. Report permission, recording, layout or interpretation failures. Browser/mobile and actual speech testing remain open acceptance gates.
9. Only after a genuine successful Gnani demonstration, record the public demo, review official competition terms/eligibility, post it yourself and submit before 10 November 2026, 11:59 PM IST. No public post, registration or final submission was performed here.

Do not expose this local prototype publicly as-is: staff uses one shared local token, requests are not deployment-rate-limited, sessions are in memory, and HTTPS/public hosting hardening is pending. A public demo video of a locally running app is distinct from exposing the API.


## Glass UI acceptance — 29 October update

After extracting the updated bundle and starting the existing local launcher:
1. Search `fan capacitor`. Check that ratings remain distinct and synthetic labels are visible.
2. Select a candidate. Read its exact part number, connector and Rack / Shelf / Box tiles. Close the details and select another candidate.
3. Use exact specifications or a clarification choice, then apply it. Earlier constraints must remain in force.
4. In Catalogue, change the appliance filter. Check that the details from the previous category clear.
5. At 390px and 768px widths (or your phone/tablet), check navigation, text, touch targets and horizontal overflow. Selecting a part on phone widths should bring its details into view.
6. Test keyboard-only navigation and browser zoom. Record any unreadable text or obscured controls.
7. Enter the local staff token, edit a synthetic record in a disposable demo copy, and verify that saving requires review again. Synthetic verification must remain disabled. Review and resolve a deliberately unmatched request.
8. Voice recording remains disabled until credentials and staff access are configured. No Hindi/Hinglish support is claimed by this visual update.

These are acceptance tasks, not results already observed. See `docs/glassmorphism_update.md` for the tests completed here.
