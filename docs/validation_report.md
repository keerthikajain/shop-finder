# Latest validation — 24 October 2026

54 tests passed, one dependency deprecation warning. Current JUnit: evaluation/results/current-tests.xml. Frontend production build passed. Local startup HTTP smoke passed. Typed development corpus: 50/50 candidate sets match expected; exact-keyword baseline 36/50. Query expectations were not changed, but parser fixes were made after examining failures, so this is not held-out validation. No safety/compatibility or speech accuracy claim is supported. Zero live API calls.

The remaining actual acceptance gates are browser/mobile operation, microphone encoding on the user device, genuine Gnani transcription/synthesis and staff-verified shop data. See current_status.md and user_next_steps.md.

---
Historical foundation report follows.

# Validation report — 24 October 2026

## Actual results
- Python foundation suite: **36 passed**, 1 deprecation warning, 2.16 seconds. Saved JUnit: `evaluation/results/foundation-tests.xml`.
- Frontend production build: passed with Vite 7.3.7. Built 23 modules; JS 227.94 kB before gzip, CSS 4.58 kB.
- Local development launcher and HTTP smoke: see `evaluation/results/local-smoke.json` and `local-startup.log`. Both services start; Vite proxies API calls to FastAPI/SQLite and retrieves all 20 products and 4 fan records.
- Managed browser: frontend layout and error state inspected; full browser workflow **unverified** because the managed preview environment does not provide Python. Do not claim successful browser interaction or mobile-device testing.
- Official Gnani documentation: reviewed; live API calls **0**. No speech accuracy or latency measured.

## Tests cover
Every seed record is retrievable and ineligible for recommendation; six categories; synthetic provenance; no manufactured compatibility; exact category validation; unknown and injection-like IDs; rejected mutation routes; idempotent seeding preserving edits; invalid-seed atomicity; duplicate IDs; evidence requirements; synthetic verification rejection; distinct capacitor variants; optional seed disablement; disabled voice mocks; honest capability flags.

## Bugs found and fixed
- Initial seed path used the wrong parent directory: corrected and startup/seed tests rerun.
- Vite preview hostname rejected: explicit development hostname allowance added.
- Separate managed preview could not reach an isolated backend: added a normal local full-stack launcher, then identified missing Python in managed browser runtime. Local same-process-tree HTTP smoke validates the launcher; browser QA remains pending.

## Limits and next task
Milestone 1 has runnable source and passing startup checks; manual browser acceptance remains pending on a Python-capable local machine. Milestone 2 is implemented and tested. Real staff verification, search, clarification, staff mutations, unresolved workflow and Gnani speech are later milestones.

Next implement Milestone 3's deterministic search and hard technical constraints. Compare it against exact-keyword baseline using the 50 planned typed queries. These queries have not been run and have no claimed pass rate. No real shop deployment is represented here.
