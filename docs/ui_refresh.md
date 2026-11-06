# Shopfinder interface refresh

The login and warehouse screens now share the shelf-and-location-pin mark, warm neutral surfaces, purple actions and sage location highlights. The sign-in page uses an illustrated stockroom alongside the existing account form. The workspace keeps its navigation and operational controls, with a charcoal desktop sidebar, compact search area and larger result cards.

The favicon and installable-app icon use the same mark. Login includes password visibility, saved theme selection and translated English/Hindi labels. Required fields, credential autocomplete, loading, unconfigured, busy and error states are retained.

## Scope

No API, authentication, database, stock, import, search parsing or voice-provider behavior was changed. Result cards continue to use category illustrations because inventory records do not currently supply product photographs. The stockroom illustration follows the selected visual direction; it is not the original reference artwork. The interface is not yet verified as a pixel-exact reproduction.

## Validation

- 109 backend tests passed against the existing test databases.
- 23 frontend tests passed, including new login-state and credential-control rendering checks.
- Production Vite build passed.
- Git whitespace validation passed.

Interactive browser and mobile visual checks remain pending for this refresh. The managed preview could not start the Python backend (`spawn python ENOENT`), and browser controls were unavailable in this session. Rendering tests do not replace an interactive login, keyboard, responsive-layout or real microphone/camera check.

## Review locally

Use the existing setup and start instructions in README.md. Check the login page at desktop and phone widths, toggle its theme and password visibility, and sign in with an existing owner or staff account. Verify mixed-item search, variant clarification, shelf confirmation, imports, stock previews, activity and mobile More navigation. No inventory should change until the existing explicit confirmation step is completed.
