# Catalogue and future matching contract

Identifiers SYN-001 through SYN-020 are fictional fixture IDs, not purchasable manufacturer part numbers. All initial manufacturer/model fields are null, compatibility lists empty, and staff verification statuses unverified.

Real catalogue ingestion must record evidence for exact part numbers, model compatibility, electrical ratings, supply type, dimensions, connectors and location. Do not populate unknown values by inference. A source reference must be checked by staff; the presence of a nonempty source string is not independent proof.

Future matcher order: normalize safely → retrieve name/alias candidates → enforce all supplied hard attributes → clarify missing identity/compatibility → render only verified facts, or abstain/log. Fuzzy similarity cannot override conflicting values. A higher voltage rating is not automatic substitutability. Model compatibility is checked against evidence, not inferred from appliance category or brand. Clarification replies must not erase earlier constraints.

The current catalogue browser only displays labeled fixtures. It does not identify suitable replacement parts, offer installation instructions, generate recommendations or claim stock availability.
