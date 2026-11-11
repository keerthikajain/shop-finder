# Finder — simple end-to-end voice release test
Do this on the deployed HTTPS preview using **synthetic** catalogue data only. Do not use real customer recordings.

Write PASS or FAIL next to each step. For every FAIL, record the recognized words, selected language, screenshot, and what actually happened.

## One complete walkthrough
- [ ] 1. Open Finder as a new visitor on a phone. Create a test owner account. Confirm that signup, login and the layout work.
- [ ] 2. As owner, set up a test shop. Import at least three **synthetic** parts/items with different shelf locations. Make sure each imported location appears only on the correct item.
- [ ] 3. Open a test staff account. Select English for voice.
- [ ] 4. Press Speak and ask for **two different items in one sentence**. Verify the recognized transcript and exact product variants. If a name is unclear, Finder must ask, not guess a shelf.
- [ ] 5. Confirm the search and begin picking by voice or button. Finder should speak the first saved shelf, then listen **after** the audio finishes. It must not hear its own voice.
- [ ] 6. Say **Help** or **What should I say?** Finder should explain the commands for this step. Say **Repeat** to hear the current guidance again.
- [ ] 7. Say **Found it** and then **Yes**. Only now should this item be marked picked. The next item should be announced without another tap.
- [ ] 8. Say **Undo last confirmation**. Check that the pick becomes unconfirmed, an audit record is kept, and stock quantities do not change. Confirm the item again.
- [ ] 9. For another item, say **Wrong location**. Finder should open the report step and pause picking listening. Start the automatic report voice guide once.
- [ ] 10. Tell Finder what was wrong. Say a suggested rack/shelf, or **Skip** if unknown. Finder must read back the actual note and suggestion; nothing has been submitted yet.
- [ ] 11. Say **Send report**. Check that it is saved only once, is still open for review, and does **not** change the recorded shelf. Finder should speak the saved result, then guide the next eligible item if there is one.
- [ ] 12. Refresh the page and sign in again. Check the report and picking progress are still saved.
- [ ] 13. Sign in as owner. Open **Activity → Reports**. Open the reported item, then start the automatic review voice guide.
- [ ] 14. Finder reads the recorded shelf. Say **Still unconfirmed**, dictate a short review note, and listen to the outcome and note. Say **Save review**. Verify that the report remains open and new searches warn that the shelf is under review.
- [ ] 15. Check the original physical location (in this synthetic test, deliberately decide that the original shelf is correct). Repeat the owner review, say **Original location verified**, dictate the result, hear it back, and say **Save review**. The report should close and future searches should use the original shelf without a warning.
- [ ] 16. File a **new wrong-location report** for a test item and deliberately verify that it has moved to a different rack.
- [ ] 17. As owner, use **Verify and update location**. Start the automatic correction guide; dictate the new rack/shelf and reason.
- [ ] 18. Say **Review location change**. Finder must speak the **old location, new location and reason**. Say **Confirm location change** only after checking. Verify that the catalogue and history update **once**.
- [ ] 19. Search for the item again as staff. The **screen and spoken answer** must both use the new verified rack. A saved old picking task must be marked stale and should not let anyone confirm the old shelf.
- [ ] 20. Reload and sign in again. The corrected shelf and resolved report must still exist.

## Check errors and manual backup within that same session
- [ ] 21. Say **Back** while reviewing a step. The previous step must open without marking a pick, moving a product, or submitting a report.
- [ ] 22. Say **Stop**. Mic/audio must stop and stay stopped until **you** resume. Refresh or change pages; it must never restart by itself.
- [ ] 23. Say an unrelated/unclear command instead of Yes or Save. Finder must ask again or show clear options; it must **not** confirm or submit anything.
- [ ] 24. Stay silent on a listening step. After limited retries, Finder should pause and offer Retry voice or manual input. No endless microphone loop.
- [ ] 25. Deny microphone permission, block audio autoplay, and simulate a Gnani/API/network failure separately. Search, report entry, location review and saved progress must remain usable manually.
- [ ] 26. Interrupt a spoken prompt and navigate Back/close the modal. The old voice audio and microphone must stop; no double recording or repeated greetings.
- [ ] 27. Try to resolve a report or move a shelf as **staff**. The server must reject it; only an authorized owner may approve.
- [ ] 28. Try an unknown part, duplicate import, and a stale import/update. No made-up shelves, silent overwrites, or false picked status.
- [ ] 29. Repeat key voice actions in **Hindi, Hinglish and Telugu**, including the **report and owner-review guide**. Check actual Prisma transcript, TTS playback, mixed speech, stop/help/back, and manual fallback. Command wording can differ by locale.
- [ ] 30. Check the same full flow on desktop and phone over HTTPS: readable pink buttons, no text hiding, accessible microphone buttons, no exposed API keys, valid owner/staff permissions, and no visible server errors.

## Release gate
- [ ] Current GitHub **Application checks** pass (Python tests, frontend tests, frontend build).
- [ ] Current **Security checks** pass.
- [ ] All 30 manual cases above are PASS or documented with a fixed/accepted limitation.
- [ ] Persistent database, backup/restore, HTTPS, Gnani secrets in server environment, logs and startup smoke test are verified in the actual hosting environment.
- [ ] Record a clean demo video of the real voice-first flow. **Do not call the app deployment-ready merely because unit tests pass**.
