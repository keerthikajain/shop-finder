# A clear 3-minute demonstration

The message: **“A new worker can find several items, confirm the right shelf and report a mistake using one workspace.”**

Use the synthetic catalogues already included. Do not describe their locations as a real warehouse, or claim measured time savings before doing the user test.

| Workspace | Familiar example | Detail that matters |
|---|---|---|
| Clothing outlet | Blue T-shirt and black jeans | M/L and waist size 32/34 |
| Footwear stockroom | White trainers and black sandals | UK shoe size 7/8 and 6/7 |
| Appliance warehouse | Mixer and kettle | 500/750 W and 1.5/1.8 L |
| Home essentials | Storage box and cotton towel | 20/40 L and material |

1. **Start with the problem (15 seconds).** “In a large stockroom, new workers know the item name but not its exact location. Asking an experienced worker interrupts both people.”
2. **Choose Clothing (35 seconds).** Say “Blue T-shirt and black jeans size 32”. Check the transcript. Search. The jeans location is shown; the T-shirt needs a size. Use its detail field to say “size M”, then Apply detail. Show the spoken response and the two-item work list. The voice language is separate from the app language.
3. **Confirm a shelf (25 seconds).** Open the item’s labels, print them beforehand, then scan the item and shelf QR labels using a phone. Show a wrong label once: it must not count as confirmed. A manually checked item is visibly labelled as manual.
4. **Show the other use cases (25 seconds).** Select Footwear, Appliances and Home essentials. Use each built-in example question. Point out that specifications change with the business type.
5. **Update from Excel (40 seconds).** Export the current clothing catalogue. Change one rack field and keep its revision column. Import it, map columns, expand the before/after change and confirm. Search that SKU again. Show the new location and the recorded actor/time in Change history. No separate Postman step is needed.
6. **Close the correction loop (20 seconds).** Staff report “the box is empty” without changing the catalogue. The owner reviews it, checks the physical shelf, then previews and confirms a correction. Do not call an empty-box report a live stock count.
7. **End with evidence (20 seconds).** Show your real test results: correct item+location, clarifications, wrong/no answers, response time and failures. Explain any unsupported request honestly.

## Small pilot test

Ask three people unfamiliar with your synthetic shelf layout to find 5 items each. Compare the same tasks using the spreadsheet and the app; alternate which method they use first. Record time, wrong variants, wrong shelves, clarification requests and whether a spoken response was intelligible. These are planned measurements, not outcomes already achieved.

For voice, run at least 10 English, 10 Hindi and 10 Hinglish requests with names, sizes, codes, multiple items and one deliberately missing item. Repeat a few with realistic background noise. Keep the transcript, expected SKU, returned SKU/location and failure reason. Do not record other people without their permission.

Use an external camera to film the actual working app, or record its screen and audio. Show the working Gnani integration you verified with your key; do not replace it with browser speech while claiming Gnani results.

## From the example projects you shared

The useful patterns are a specific user problem, a short complete workflow, clear feedback, and honest validation. For Shop Finder, the strongest combination is spreadsheet onboarding + spoken multi-item retrieval + variant clarification + physical scan confirmation + audited correction. A polished dashboard supports that sequence. A public URL and a real-device demonstration remain part of the final presentation work.

Defer phone-call access, voice cloning, a 3D map, billing and predictive stock suggestions until the core workflow is measured. Indoor routing needs an actual floor plan and walkable paths; the current stop list groups recorded locations only.
