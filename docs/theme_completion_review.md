# Colour reference and dark mode — 29 October 2026

Implemented: the supplied glass concept's plum text/actions, lavender selection, peach specification highlights and mint location panels. The reference is a raster with gradients, so CSS recreates that palette rather than claiming a pixel-identical rendering on every display. Dark mode covers navigation, forms, candidate cards, details, alerts, staff editing and unresolved review. The Appearance selector offers Light, Dark and System; the choice persists locally, system changes are observed, and a small pre-render script avoids a light flash on reload. No credentials are stored in localStorage.

Staff improvements: existing specification/dimension values and verification evidence now have labelled form controls. Synthetic evidence remains blocked. Server verification uses the existing endpoint and cannot be submitted through the button while product content has unsaved changes. The badge shows the saved record's status, not the unsubmitted evidence checkbox. New technical field keys and compatibility records still require the advanced editor; this is a remaining usability limitation, not claimed complete.

Validation: 54 backend tests, 6 frontend rendering/theme tests and production build pass. Tests include stored preference errors and system theme resolution. Full browser/device appearance, contrast, interactions and live microphone/provider acceptance have not been verified. The previously established managed-browser limitation remains: the preview runtime cannot launch Python.

## Requirements review status

| Requirement | State |
|---|---|
| Home-appliance scope, 20 synthetic records | Implemented; preserved |
| Exact identifiers, constraints, clarification and staff review | Implemented; regression suite passes |
| Four screens, reference palette and complete dark surface styling | Implemented; browser acceptance pending |
| Staff protected edits / verification / unresolved resolution | Implemented; backend tests pass |
| More usable evidence forms | Implemented; new field-key and compatibility editors remain advanced |
| Prisma/Timbre code | Implemented; genuine API/audio checks pending |
| Hindi / Hinglish | Not complete; English voice remains the only exposed option |
| Independent spoken evaluation and shop trial | Pending user recordings and participation |
| Public deployment and submission | Not performed; existing shared-token local prototype must not be exposed publicly |

This is an updated local prototype, not a claim that every original milestone is complete. Synthetic records remain appropriate for demo work; do not use invented ratings for real installations.

## Run your updated copy safely

Stop the current server with Ctrl+C. Extract this archive into a NEW folder so your own database and configuration stay intact in the previous folder. Follow README setup there, then start `scripts/start_local.py`. Choose N for the first appearance check. Use Appearance in the top bar to change themes. Do not copy the supplied demo database over shop records you have edited. Check the two themes, then run the acceptance list in user_next_steps.md. Live API keys belong only in your local hidden prompt.
