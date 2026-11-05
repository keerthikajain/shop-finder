# Demo plan — run with actual output

0–10s: explain a new worker confusing similar home-appliance parts.
10–20s: record a query through actual Prisma; show the editable transcript.
20–35s: show multiple fan capacitor candidates; confirm exact identifier and rating.
35–45s: show the clearly fictional location and play actual Timbre output.
45–55s: search an absent part; show staff review and a saved resolution.
55–60s: show measured typed results separately from actual speech results. Disclose synthetic data.

Do not record a fake successful voice flow while APIs are disabled.

## Draft project description
Shop Finder is a local prototype for workers in a home-appliance spare-parts shop. It searches a structured catalogue by names, nicknames and exact attributes, preserves constraints during clarification, and records unresolved questions for staff review. The development catalogue contains 20 clearly synthetic records. Gnani Prisma v2.5 and Timbre REST adapters are implemented; live speech validation is pending. AI assistance was used for implementation and tests. Personal contribution and real-world results must be updated honestly before submission.

## Interview practice
- Why separate candidate retrieval from compatibility? Similar names are not evidence that electrical parts are interchangeable.
- Why SQLite? One small shop and a local prototype benefit from simple persistence without a hosted database.
- Why exact filters after fuzzy retrieval? Spelling similarity can find a name; it must not override a rating or connector conflict.
- What did the evaluation measure? Candidate-set agreement on synthetic typed development queries, not real-world correctness or speech quality.
- What happens after staff edits? Previous verification is invalidated and evidence must be reviewed again.
- What remains weak? Advanced JSON editing, limited free-text interpretation, no completed browser/audio field validation and local-only security.

## Draft progress post
I’m building Shop Finder for a home-appliance spare-parts shop. The idea is to help a new worker find a part without guessing between similar components. The prototype now supports catalogue search, clarification and staff review using synthetic records. My next validation step is the actual voice flow with Gnani Prisma and Timbre, followed by testing with shop staff. I’ll share measured results once those tests are complete.
