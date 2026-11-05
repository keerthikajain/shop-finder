# Connected store workflow

This release is one organisation per installation. It supports a store, outlet,
warehouse or stockroom with clothing, footwear, appliances and home essentials
in the same catalogue. It is a pilot with persistent storage, not a complete WMS.
Billing, order allocation, dispatch, delivery, RFID sensing and ERP synchronisation
are outside this release.

## Owner setup

1. Run `scripts/start_local.py` and create the first owner account at the terminal.
2. Log in. On the first visit, Business setup opens automatically.
3. Enter the business name/type, select every product type present and choose the
   location levels actually used. Supported levels are facility, floor, section/zone,
   aisle, rack, shelf and bin. At least one recorded level is required per placement.
4. Add up to six additional specification fields per product type if needed, using
   names such as `model`, `fit` or `size_us`. The built-in fields remain available.
5. Import the catalogue, then create staff accounts in Account. Staff can find,
   clarify, scan and report. Owners may additionally allow staff to receive, remove
   and move counted stock. Physical counts, imports and catalogue edits stay owner-only.

Changing business type changes preferences, not identity or security boundaries.
A second independent business needs its own installation and database.

## Import once; keep the database current

The importer accepts CSV/XLSX, up to 1,000 data rows, 80 columns and 4 MB. It suggests
mappings for headers such as Product code, Brand name, Warehouse, Section, Row,
Shelf and Qty. Check those suggestions before previewing. A combined code such as
`A-02-B-03` is not split into guessed levels; map it to the recorded bin identifier
or separate the columns yourself.

Use one row per variant/location. Required product fields are SKU, name and
category. With All product types selected, map `collection` too, with values
`clothing`, `footwear`, `appliances` or `home`. For single-type imports, that value
can be supplied by the selected filter. Include brand, barcode, aliases separated
with `|`, exact specifications and optional quantity. Barcodes must identify one
variant across the whole store. SKUs are identified together with product type.

A preview shows before/after placements and quantities. Nothing is saved until
Confirm import. Any error blocks the whole import. Missing rows do not delete
items. Included items replace their list of placements; locations with positive
stock cannot be removed until stock is moved or counted to zero. Preserve the
revision column on exports: an old revision cannot overwrite a more recent edit.
Changes after preview also stop the entire import.

Quantity semantics:

- New row with no quantity: **not counted**, never an invented zero.
- Existing row, quantity column not mapped: preserve the count at the same location.
- Quantity mapped but cell blank: explicitly clear that count to unknown.
- Quantity mapped to a whole number: import that recorded count, with an audit event.
- Repeated SKU rows must agree on product details and have distinct locations.

Four small import files in `data/store_examples` demonstrate the product types.
Their brands, stock and locations are fictional. They use separate `EX-*` SKUs and
will not overwrite the existing seed catalogue. Sample status remains in the data;
the interface uses one unobtrusive workspace disclosure instead of repeating it
in every result and spoken response. Real installations can disable seed records
with `SHOP_FINDER_SEED_DEMO=false` **before first startup**. This setting does not
remove previously stored sample records.

## Find and confirm

Search defaults to all enabled product types. Brand, type and location are optional
filters. One request can contain up to ten items separated by `and`, `aur`, `और`,
commas or new lines. Each result identifies its product type, brand, exact variant
and recorded placement. A number, size or unsupported descriptive word is not
silently ignored. Ambiguity requires choosing a variant/location or adding a detail.

For example: **“Everyday red dress and Northline white trainers size 7.”**
The staff member can group the work list by category or location and scan the item,
then the location label. A manual check remains distinguishable from a scanned
check. Search and confirmation never reduce stock. The shelf illustration displays
only shelves present in saved records and is a schematic, not indoor navigation.

Voice searches reuse the existing Gnani integration, show an editable transcript
and speak the database answer when enabled. The language menu stays separate from
the interface preference. Existing English/Hindi/Hinglish behaviour is preserved;
new language coverage, automatic language detection, complete translation of new
screens and measured multilingual accuracy remain a later phase.

## Update stock deliberately

From Item details → Update stock:

- **Count:** owner enters the observed number. This initializes unknown stock or
  corrects a count. Zero is valid.
- **Receive:** add units at the selected location, after an initial count exists.
- **Remove:** subtract units; insufficient stock blocks the request.
- **Move:** subtract from source and add to destination in one database transaction.
  Total stock is conserved. An existing destination with unknown stock must be counted
  first; a newly recorded destination starts with the explicitly transferred quantity.

Enter a reason, review before/after quantities, then confirm. A pending preview is
bound to its user, expires after 30 minutes and can be applied once. If another
worker changes the item, an old preview is rejected. Permission is rechecked at
confirmation. Every successful operation records actor, time, action, reason and
before/after data. No background sensor detection is claimed.

The stock form accepts a narrow English voice draft such as “receive five units”,
“remove two”, “move four” or “count twelve”. Choose a move destination explicitly.
Ambiguous or unsupported speech is left for correction. A voice-created draft can
read the preview aloud in English; Read change replays it. Audio does not confirm
or save the operation. Live device/provider testing is still required.

**Correct location** fixes a wrongly recorded label/location without changing its
quantity. Use **Move** when units physically move, especially for partial transfers.

## Demo sequence

1. Set up a mixed retail/warehouse business with all four product types.
2. Import the example CSVs and show the mapping and before/after review.
3. Ask for a dress and shoes together. Show the brand, product type and locations.
4. Ask for “blue T-shirt”; resolve the size rather than accepting an invented match.
5. Scan or manually check the selected item/location. Show that stock did not change.
6. Record a count, receive units and move some to a new location. Show the history.
7. Open an old export or preview after an edit to demonstrate conflict protection.
8. Repeat on a phone. Use More for owner tools and switch to dark mode.

For the challenge, record sample data and consenting test speakers. Do not claim
speech accuracy, sensor integration, customer adoption or a public deployment
without the corresponding evidence.
