# Shop Finder — pre-delivery product audit (8 November 2026)

This review inspects the current repository and source-level UI copy. It is **not** a substitute for real browser, device, voice-provider, security, and deployment acceptance.

## Polished in this change

- Business setup's additional specifications and staff permissions now sit in a clearly labelled, keyboard-operable, mobile-friendly collapsible card, consistent with the rest of the setup screen.
- Business setup copy is less technical and more direct, and the changed owner-facing labels are translated through the existing English/Hindi system.
- Account initialization copy no longer exposes local script commands on a sign-in page. The actual first-owner provisioning flow still requires an installer/admin.
- Settings voice status now says whether voice search is enabled or unavailable, without promising successful live transcription or revealing developer release tasks.
- Fresh-catalogue and recent-activity wording is clearer.
- Synthetic/sample data remains **explicitly labelled**. It must never be silently presented as verified stock.
- Import mapping help directs users to template-defined product type codes. The guided mapping improvement is available in the preceding PR.

## Areas reviewed and outcomes

| Surface | What exists | Still needs real acceptance |
| --- | --- | --- |
| Owner/staff accounts | Role-controlled pages, password/profile flows, server-side sessions | Fresh install, failed login, session revocation, owner/staff access on deployed host |
| First-time business setup | Business type, product types, hierarchy labels, extra specifications, staff stock permission | Save and reload on an empty database; phone screen layout |
| Find items | Typed query, conditional Gnani microphone, several-item requests, variants and shelf guide | Genuine English/Hindi/Hinglish recordings with noise/ambiguous numbers |
| Catalogue | Item details, location records, custom fields, owner editing, image fallback | Real item identifiers, edge-case long labels and keyboard/mobile layout |
| Import/export | CSV/XLSX mapping, validation, owner confirmation, revision checks | Actual user workbook and malformed/duplicate/incomplete columns |
| Locations & scanning | Barcode/QR scanning, manual code, recorded shelf labels | HTTPS camera permissions, physical printed labels, scanner types |
| Review & activity | Location problems, explicit reports, owner correction and history | Staff/owner end-to-end handoff |
| Recorded stock | Guarded receive/remove/move/count operations with audit trail | Known-count vs unknown-count transitions, concurrent changes |
| Mobile and appearance | Bottom navigation, mobile forms, light/dark modes | Browser-device checks at 309, 375, 390, 768 px and desktop widths |
| Deployment | Python/Docker source and SQLite persistence | Public HTTPS URL, secure cookies, persistent volume and secrets, backups |

## Delivery blockers — do not claim public production readiness without these

1. **Public hosting:** Serve the real FastAPI backend and frontend together over HTTPS. Test from another device. A static frontend-only upload is insufficient.
2. **Owner provisioning/security:** Create owner credentials privately, set secure cookie and secrets, test an inactive staff account, and verify restricted routes are denied.
3. **Persistence:** Start with a fresh persistent database, import a workbook, restart, and check records and account login again. Take and restore a backup copy.
4. **Voice:** With a private configured Gnani key, run at least 20 English/Hindi spoken requests plus selected Hinglish cases. Save transcript, expected result, result correctness, latency and error classes. Test microphone denial, silence, noise and provider failures.
5. **Phone/desktop acceptance:** Visually verify onboarding, Find, catalogue, import mapping, location card, scan and Settings with touch and keyboard. Check horizontal clipping, dialogs, focus and contrast.
6. **Inventory truthfulness:** Only confirmed operations should update counts; locating or scanning an item does not automatically decrement stock. Retain explicit synthetic labels for fictional data.
7. **Supply-chain review:** Inspect pinned dependencies, any GitHub security alerts and server logs. Automated suite success alone is not a penetration test.

## High-impact ways to stand out in the internship evaluation

Prioritize **proof of reliability** over adding untested features:

- **One unambiguous demonstration:** Ask for two items by voice, resolve an exact variant, show both rack/shelf/bin locations, then verify a printed label.
- **A simple evaluation scorecard:** Present how many of the fixed spoken test questions had correct transcripts, correct catalogue matches, and correct locations, separately for English, Hindi and mixed queries.
- **Failure-handling demonstration:** Deliberately ask for an unknown or ambiguous item and show that the app asks for clarification or requests owner review instead of inventing a location.
- **Owner/staff story:** Show a staff report of the wrong shelf, owner verification/correction, and the updated next search with recorded history.
- **Real deployment evidence:** Record a short uninterrupted phone walkthrough of sign-in, voice, search and shelf confirmation, with synthetic catalogue disclaimers when using sample data.

## Release positioning

Present this as a **single-organisation pilot / working internship challenge app**, not an unverified multi-tenant inventory SaaS. It does not offer automatic live stock synchronization, arbitrary-language support, or guaranteed product compatibility. Document those as future roadmap items, not current capabilities.
