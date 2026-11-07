# Release and acceptance checks

## Implemented in this update

- Saved issue confirmations include a report number. Owners resolve reports with a note; staff can see their own status and resolution in Review & history. Resolution records its author and time; repeated resolution cannot overwrite the first decision. Reporting never modifies inventory.
- Staff and owners can save their own name, optional phone and optional staff reference in Account. Owners can view staff details. Staff cannot change roles or read other accounts. Staff references are descriptive, not proof of identity or authorisation.
- Catalogue-supported multi-item requests can omit conjunctions. A unique complete segmentation is required, each segment must contain a product-name term, and explicit brands/specifications remain constraints. Unsupported or ambiguous requests remain unresolved. This is a conservative matcher, not unrestricted language understanding.
- Browser security response headers and a consistent SQLite backup utility supplement the existing password hashing, session revocation, request-header protection, role checks and stock revision checks.

## Data and imports

Records persist in the SQLite file selected by SHOP_FINDER_DB. Docker uses /data/shop_finder.sqlite3 and the Compose named volume persists /data. CSV and XLSX import requires mapping, validation and confirmation before saving. PDF extraction and automatic Google Sheets sync are not implemented. Unknown quantities remain unknown. Neither search nor reporting decrements stock.

## Before public deployment

1. Choose a Python/container host with a persistent disk. Do not put SQLite on ephemeral storage or run independent replicas with separate copies.
2. Configure HTTPS and SHOP_FINDER_SECURE_COOKIE=true, keep accounts enabled, and set SHOP_FINDER_SEED_DEMO=false for an actual store. For a challenge demo, use clearly identified synthetic inventory.
3. Configure Gnani credentials on the server only. Never commit keys or put them into frontend environment variables. Create the owner using the existing setup command.
4. Back up before upgrading: `python scripts/backup_database.py /data/shop_finder.sqlite3 /data/backups/pre-upgrade.sqlite3`. Choose a new destination each time. Keep a protected off-host copy. To restore, stop the application, retain the current database, restore a verified backup at the configured path and preserve its file permissions; restart and check accounts and stock. Backups include personal information and require restricted access.
5. Review dependency alerts, HTTPS configuration and access permissions. Automated tests are not a penetration test or a guarantee of production security.

## Manual acceptance checklist

- Owner and staff sign-in; incorrect password; logout; disabled staff session; English/Hindi menus; phone-sized layout; keyboard focus and dark mode.
- Save a staff profile, reload, and confirm persistence. A second staff account must not see it. Verify staff cannot import, edit catalogue, manage accounts or resolve reports. Stock controls follow the owner's permission setting.
- Submit an issue, see its report number, find it under My reports, resolve as owner, and inspect the resolution as staff. Confirm the catalogue did not change simply by reporting or resolving.
- Import CSV and XLSX with leading-zero location labels, duplicate barcodes, invalid rows and updated records. Review before confirming; reload and search the saved records.
- Ask for multiple items with and without 'and'; include singular/plural names, wrong brands, missing sizes and unknown products. Check candidates rather than accepting guessed locations.
- Test English, Hindi and Hinglish recordings through the actual Gnani provider. Record transcript correctness, product correctness and latency. Test silence, background noise, permission denial, network loss and TTS failure.
- On a phone, scan both item and shelf labels. Test wrong shelf and camera denial. Check manual confirmation. Search and confirmation must not change stock.
- Preview and confirm receive/remove/move/count operations. Test simultaneous updates and review history; stale previews must be rejected.
- Test a backup restore on a separate installation, then restart the deployed app and confirm data persists.

## Still outstanding

Live provider/device/browser verification, production hosting, and real staff testing require the chosen environment and user checks. Product photographs in warehouse result cards and broader multilingual understanding remain separate implementation work; current cards use category artwork. The selected visual direction is implemented but not pixel-exactly verified. PDF import, automatic stock sensing and external inventory synchronisation are not included.
