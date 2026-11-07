# Compact workspace update

The Find screen now places a single-line search above filters and the worklist. Recent requests remain available in a collapsible section. The desktop sidebar, card spacing, location chips and shelf panel follow the selected reference. Below 700 px, cards stack, navigation remains at the bottom, and search controls wrap to fit the viewport. The existing search submission, language selector, spoken-answer preference, category/location grouping and confirmation flow remain available.

Owners can upload a PNG/JPEG photo from the item editor. Photos use the existing authenticated media endpoint and persist next to the SQLite database in its photos directory. Include that directory in deployment storage and backups. Removing a photo from an item detaches it; it does not delete the shared media file. Spreadsheet reimports preserve existing photo associations. Items without a photo, or with a failed image load, retain their category illustration. The product pictures in the reference are not automatically attached to real products.

The reference uses sample names, locations and pictures. The application continues to display actual stored data. A multi-item request shows a shelf schematic for the first selected item plus all grouped stops; it does not infer an indoor route.

Automated validation: production build and 23 frontend tests passed; the existing 113 backend tests passed and the warehouse suite was rerun with the new photo test. Browser/device visual comparison is still required; no pixel-exact or real-device verification is claimed. Review at 390, 768, 1280 and 1920 px, with long item names, missing photos, ambiguous variants and Hindi text.
