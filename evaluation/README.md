# Evaluation

`results/foundation-tests.xml` is actual pytest evidence. `queries.json` is a planned 50-query matching corpus; all actual results are null because the matching engine is a later milestone. Candidate lists describe synthetic retrieval only, never real compatibility. Clarification action names are design expectations to finalize with Milestones 3–4.

Next add multi-turn cases retaining earlier constraints, explicit wrong-brand/model cases with verified test evidence, malformed input and API failures. Run identical input sets against exact-keyword baseline and improved matching. Store input, expected, actual, pass/fail, error category and latency per case.

Report correct item identification, wrong confident answer, clarification and abstention rates, plus completion time. Keep actual audio corpus and Prisma transcription errors/speech-to-answer latency separate. Typed-only tests cannot demonstrate voice accuracy. Synthetic data alone cannot validate real part compatibility.
