# Engineering decisions

| Decision | Reason and trade-off | Evidence / status |
|---|---|---|
| Keep React/Vite + FastAPI + SQLite | Preserves requested local-first architecture | Implemented and tested |
| Python sqlite3 with structured JSON payload and indexed category | Small catalogue; preserves structured specifications without premature joins | Tested; revisit indexing at larger scale |
| Empty compatibility for every synthetic record | No real catalogue or manufacturer evidence supplied | Tested |
| Synthetic is independent of staff verification | Schema-valid is not equivalent to verified or safe | Tested: synthetic verification is rejected |
| Per-field evidence for verified records | Requires a source for each populated identity, location and technical field | Validation tested; genuine evidence review remains human work |
| Insert-only seeding | Restart must not erase future staff corrections | Idempotence and edit-preservation tests pass |
| Read-only foundation | Do not expose unauthenticated writes while staff access control is pending | POST/PUT tests reject mutations |
| Explicitly disabled mock speech interfaces | Preserve integration boundary without fabricated Gnani output | Tests verify they fail clearly |
| One development launcher | FastAPI and Vite must run together for the UI to fetch data | Added after initial browser connection failure |

No new models, no separate LLM, no cloud database, no inventory/billing expansion.

## Contribution record
User: defined the problem, corrected the domain, selected the architecture/models and set verification constraints.
AI assistant: implemented the foundation, synthetic fixtures, tests and documentation.
User implementation/testing/understanding: not yet assessed. Do not invent ownership or mastery.

## One small personal task
Open SYN-008 and SYN-009 in the catalogue. Identify the differing field. Explain why a shared nickname is insufficient to select a real replacement. Then add one locally used nickname in the JSON fixture and validate it with a knowledgeable shop worker before it can become real catalogue knowledge. Existing database records are intentionally not overwritten by reseeding; use a separate fresh demo database to inspect edited fixtures.


## 29 October 2026 — glassmorphism UI (user authorized)

Proposed change: apply the desktop/mobile glass concept to all four existing screens.
Current approach: functional green/cream screens with dense catalogue cards.
Reason: user explicitly selected glassmorphism and requested the actual application update.
Improvement: frosted surfaces, lavender navigation, plum actions, mint location tiles and consistent form treatments. On mobile, selected details appear before the results. Navigation remains labelled at every breakpoint.
Expected benefit: more legible grouping and easier access to identifiers and location; usability benefit remains a reasoned expectation until shop trials.
Risks: low contrast from transparency, blur performance on older devices, and narrow-screen overflow. Use predominantly opaque surfaces, dark text, CSS fallbacks and bounded responsive grids. Physical-device testing is still needed.
Cost: no extra runtime dependency, external font, generated photo or live API usage. Rendering contracts use Vite's installed esbuild dependency.
Submission effect: an implemented visual direction and reproducible code checks, without claiming real users, browser acceptance or improved voice accuracy.
Recommendation: adopted under explicit user request; test on the target phone before shop use.
Evidence: backend regression suite (54), static React rendering contracts (4), production build. Static rendering does not test interactions, computed styles, scrolling or microphone behavior.
User contribution: selected the glassmorphism direction. AI assistance implemented the source changes and checks; no claim of user-authored code or field testing.
Learning task: run the app, search `fan capacitor`, inspect each candidate and explain why a matching name does not make two ratings interchangeable.


## Theme and evidence forms
User explicitly requested the reference colours and dark mode. Adopted CSS theme overrides without changing the backend or provider models. Preference uses localStorage with failure fallback; API and staff keys are never stored there. Evidence checkbox is preparation only: saved record status remains authoritative, and unsaved technical changes disable verification. Browser accessibility and contrast remain acceptance tasks. User contribution: supplied visual reference and requested theme support.
