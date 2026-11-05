# UI/UX review and implementation

The earlier catalogue made the worker browse before asking. The large heading competed with the task; strict specification inputs were hidden from the search interface. The revision makes Ask the default screen and reduces the heading. Navigation separates worker lookup, catalogue inspection, staff editing and unresolved review.

Ask: prominent text/transcript field; search, recording and reset controls; explicit exact-specification fields; candidate cards and attribute choices; clarification reuses the earlier candidate set. Candidate details prioritize part number, ratings, connector and rack/shelf/box. Empty results explain the next step and are logged.

Catalogue: inspect all records without implying suitability. Staff Editor: basic identity, aliases and location fields; advanced JSON for technical attributes and evidence; edits reset verification. Unresolved: staff-only list and resolution note with optional product link. Staff access is a local shared token held only in browser memory.

Updated 29 October: the green/cream palette has been replaced by the user-approved pastel glassmorphism design. Keep readable dark-plum text, visible demo labels, large tap targets, responsive layout, labeled inputs and inline errors. Voice is visibly disabled until configured. No fake audio, stock data, testimonials or deployment claims.

Remaining usability limitations: advanced evidence editing requires JSON and is not yet friendly for nontechnical staff; exact size fields have partial coverage in the form, with complete structured filtering exposed by the API. Long catalogue lists and phone detail-panel placement need real device testing. Recording uses a browser API requiring permission and a secure/local context. No claim of completed accessibility audit or browser/mobile acceptance testing is made.

## Implemented glass direction

Desktop uses a translucent application shell and sidebar. Ask prioritizes the query box and exposes exact filters on demand; there are no fabricated default search results. Candidate cards use clear identifiers, units and connector labels. Selection alone reveals the mint location tiles. On phone widths, selected details move before the cards and receive focus; users can close the detail view. Catalogue filtering, staff access, editing and unresolved review share the same surfaces and controls. The CSS includes reduced-motion, reduced-transparency and forced-colors fallbacks. These are implementation provisions, not a completed accessibility audit.

No new image assets, font downloads, UI dependencies or provider calls are required. Category icons intentionally avoid depicting an invented physical part as an authentic photo.


## Colour reference and dark mode update
The supplied reference palette and Light / Dark / System modes are implemented across all screens. Labelled technical-value and evidence forms reduce JSON editing. Validation: 54 backend tests, 6 frontend tests and production build pass. Full browser/device, Hindi/Hinglish, genuine speech evaluation and submission remain incomplete. See `theme_completion_review.md` for the current requirements review and safe update instructions.
