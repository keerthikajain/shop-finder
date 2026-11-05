# Milestone 3 — preliminary candidate retrieval

Implemented POST /api/search with {"query":"fan condenser"}. Candidate-only responses always set recommendation_allowed=false. Exact SYN/DEMO identifiers must match exactly; numeric voltage, capacitance and power constraints and AC/DC are hard filters. Names and aliases retrieve candidates. Unknown IDs return no candidates. Substitution/compatibility wording requests staff review.

The initial spelling comparator is Python difflib, not the planned RapidFuzz; it is a provisional baseline and has no measured superiority. Missing dimensions, connectors, model parsing and other attributes are not validated. Therefore every returned candidate still requires clarification and no result is a safe part selection. No confidence score is a probability or compatibility claim.

37 tests passed. New regression checks cover exact ID lookup, wrong voltage, wrong supply, unknown ID, alias ambiguity and substitution abstention. Full planned matching corpus, endpoint-specific tests, UI integration and evaluation are outstanding. Milestone 3 remains in progress.

## Continued implementation
Added frontend query/clear/loading/error states and API structured hard filters for manufacturer, model, part_number, connector_type, dimensions and specifications. Added endpoint tests for connector match/mismatch, unknown model/manufacturer, missing dimensions, conflicting capacitance and malformed fields. Structured filters must be supplied through the API; the UI currently has only a text input. Arbitrary natural-language constraints remain incompletely parsed. Full 50-query evaluation and RapidFuzz integration remain pending.
