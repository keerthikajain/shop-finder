# SHOP FINDER — COMPLETE END-TO-END PROJECT BUILD

## ROLE AND OBJECTIVE

Act as my senior AI engineer, full-stack architect, technical mentor, QA engineer, product designer and project execution lead.

You are working with me on a project for the **Great Indian AI Internship Challenge 2026**, organized by Gnani AI.

Your responsibility is to help me turn our finalized project, Shop Finder, into a fully working, professionally presented, technically defensible application.

**Do not stop at planning. In Work mode, inspect and work with the available project files, create real code and tests, run the application, diagnose failures, and produce deliverables whenever tools and permissions allow.**

I am learning, so while implementing, teach me the important technical decisions in simple language. I should understand the system well enough to explain it during a technical interview.

I have an extremely limited budget. Prioritize free, local and open-source tools. Do not purchase services, activate paid infrastructure, or expose credentials.

The submission deadline is **November 10, 2026, 11:59 PM IST**.

## SECTION 1 — FINALIZED PROJECT

**Project name:** Shop Finder — A Voice Guide for New Home-Appliance Spare-Parts Shop Workers

### Problem

New workers in home-appliance spare-parts shops often struggle to remember product names, local nicknames, specifications, compatibility information and storage locations.

They repeatedly depend on shop owners or experienced workers to identify and locate products.

### Solution

Shop Finder is a multilingual, voice-enabled product knowledge assistant.

Knowledgeable staff maintain and verify product records. New workers can ask questions naturally using a supported Indian language.

The system searches the shop's verified catalogue, asks clarifying questions when necessary and displays and speaks the correct item information.

Unresolved questions are stored for staff review rather than answered through guessing.

### Example interaction

Worker: "Pankhe ka capacitor kidhar hai?"

Application: "Please check the exact part number, capacitance, voltage rating and connector. Which part is listed on your work order?"

Worker: "SYN-008."

Application in synthetic demo mode: "Demo record SYN-008: fan run capacitor. Fictional location: rack B, shelf 2, box 8. This is synthetic, unverified data and is not a real-part recommendation."

In real operation, identity, compatibility, specifications and location must come from staff-verified catalogue evidence. A name or fuzzy similarity cannot establish interchangeability.

## SECTION 2 — LOCKED MVP SCOPE

Build a functional first version with:

- One home-appliance spare-parts shop
- Approximately 20 sample products
- One fully tested language initially
- A second language or code-mixed speech only after validation
- Text search and voice search
- Product aliases and nicknames
- Brand, model, size and other specifications
- Verified storage locations
- Optional product photos
- Search results and clarification questions
- Staff catalogue management
- Staff verification and corrections
- Unresolved-query logging
- Spoken responses
- A mobile-friendly web interface

Explicitly exclude:

- Live inventory tracking
- Billing
- Online payments
- Supplier ordering
- Automatic product recognition from photographs
- Complex multi-shop management
- Unnecessary AI agents
- LLM-powered free-form product recommendations
- Expensive hosting
- Features unrelated to the core workflow

Do not expand the scope without a strong engineering reason.

## SECTION 3 — DATA STRATEGY: USE SAMPLE DATA FIRST

Do not require us to interview shopkeepers or collect real shop data before beginning development.

Build the first working application using **20 realistic synthetic spare-parts records**.

Use fictional storage locations, fictional shop identifiers and clearly labeled demo information.

Home-appliance categories (20 synthetic records):

- Washing machines: 4 (drain pumps, inlet valve, drive belt)
- Refrigerators: 3 (defrost timer, two door gaskets)
- Fans: 4 (three run capacitors, bearing)
- Mixer grinders: 3 (two jar couplers, carbon brush pair)
- Electric irons: 3 (thermostat, two thermal fuses)
- Water purifiers: 3 (two inlet solenoid valves, sediment cartridge)

Each record contains:

1. Unique product ID and fictional shop ID
2. Canonical product name and local aliases
3. Appliance category
4. Manufacturer and model if supported by evidence (null in initial fixtures)
5. Part number with provenance (SYN-prefixed fictional identifiers for fixtures)
6. Structured electrical/technical specifications with explicit unit-bearing keys
7. Dimensions and connector type where relevant
8. Verified compatibility entries with evidence, or an empty list when unknown
9. Rack, shelf and box
10. Optional photograph (null initially)
11. Synthetic flag, provenance, staff verification status, verifier and evidence
12. Created/updated timestamps

Every seeded record is explicitly synthetic and staff-unverified. Ratings and dimensions are test fixtures, not real safety specifications. Compatibility is empty; no actual manufacturer or model claims are invented. Schema validation never confers staff verification. Real records require per-field source evidence and human verification; matching cannot upgrade them.

Create deliberately similar records to test clarification.

For example:

- Two products with the same name but different sizes
- Same part name with different electrical ratings or connectors
- Similar nicknames for distinct products
- Product names with common transcription mistakes
- One genuinely absent product

Synthetic data must never be represented as verified field observations.

We can replace the sample records with authentic shop data later without redesigning the application.

## SECTION 4 — GNANI AI MODEL INTEGRATION

### Model A: Gnani Prisma v2.5

Purpose: Convert spoken questions into text.

Expected flow:

User records audio → frontend sends audio to backend → backend calls Prisma → transcription is returned → matching engine processes transcript.

Also investigate whether voice entry can help staff add product records, but keep this optional.

### Model B: Gnani Timbre v2.5

Purpose: Convert a verified answer or clarification question into natural speech.

Expected flow:

Search engine produces a structured result → application constructs a safe response → backend requests Timbre synthesis → frontend plays the returned audio.

### LLM decision

The initial project must work without a separate language model.

Use deterministic search, aliases, fuzzy matching and structured attribute filters.

Evon v3.3 is not required in the MVP. Do not introduce it unless we discover a specific, measurable limitation that genuinely requires reasoning and can be solved within our time and hardware constraints.

### API instructions

Before writing integration code:

- Read the current official Gnani AI API documentation.
- Verify exact endpoints.
- Verify authentication requirements.
- Confirm accepted audio formats.
- Confirm language codes.
- Confirm whether streaming or non-streaming requests are supported.
- Confirm Timbre voice and playback formats.
- Confirm errors and rate limits.
- Check credit usage.

Do not invent request schemas or authentication headers.

Keep all API credentials on the backend.

Use environment variables and a .env.example file.

Never expose keys in GitHub or frontend code.

If live API credentials are unavailable, build a clearly identified mock adapter for development and preserve the interface for actual Gnani integration.

Never claim a mock integration is real Gnani usage.

## SECTION 5 — TECHNICAL ARCHITECTURE

Preferred stack:

Frontend:
- React
- Vite
- Responsive CSS

Backend:
- Python
- FastAPI
- Pydantic

Database:
- SQLite
- SQLAlchemy if appropriate

Matching:
- Python standard-library normalization
- RapidFuzz for fuzzy matching
- Rule-based specification and alias matching

Testing:
- Pytest
- FastAPI testing utilities
- Frontend tests where useful
- Manual browser testing
- Audio test dataset

Development:
- Git
- GitHub
- VS Code
- Local development first

These are preferences, not mandatory choices. Deviate only when it clearly reduces implementation risk.

Proposed structure:

shop-finder/
- backend/
  - app/
    - main.py
    - api/
    - models/
    - schemas/
    - services/
      - catalogue.py
      - matching.py
      - clarification.py
      - gnani_stt.py
      - gnani_tts.py
    - database.py
    - config.py
  - tests/
  - requirements.txt
- frontend/
  - src/
    - components/
    - pages/
    - services/
- data/
  - sample_catalogue.json
- evaluation/
  - queries.json
  - results/
- docs/
- .env.example
- .gitignore
- README.md

Use clean, maintainable code without unnecessary abstractions.

## SECTION 6 — CORE MATCHING ENGINE

This should be the project's most technically interesting component.

Implement:

### Stage A: Query normalization

Normalize:

- Case
- Whitespace
- Common punctuation
- Spoken size formats
- Common unit variants
- Spelling/transcription variations

Preserve meaningful distinctions.

Example:

"two point five microfarad fan capacitor"

may normalize to:

"2.5 µF fan capacitor"

But do not confuse 2.5 µF and 3.15 µF, or 440 V and 450 V. Never round or substitute technical ratings.

### Stage B: Candidate retrieval

Search:

- Canonical product names
- Local aliases
- Brands
- Product categories
- Models
- Specifications

Use exact and fuzzy matching appropriately.

### Stage C: Attribute validation

Prevent an approximate text match from overriding a hard specification mismatch.

Important rule:

**A product with the wrong exact part number, appliance model, electrical rating, size or connector must not be confidently returned solely because its name is similar. Compatibility and safety specifications must have catalogue evidence. Fuzzy matching may retrieve candidates; it must never authorize electrical substitutions.**

### Stage D: Clarification

When multiple compatible products remain, identify which missing attribute best distinguishes them.

Example:

User: "Need fan capacitor."

Catalogue:
- Fan run capacitor, 2.5 µF, 440 V AC, 2 wire leads (synthetic)
- Fan run capacitor, 3.15 µF, 440 V AC, 2 wire leads (synthetic)

System:

"What exact part number and capacitance are specified? Also confirm the voltage rating and connector from the verified catalogue."

Remember the original query and apply the reply to the existing candidate set.

### Stage E: Safe answer

Return the selected item's actual verified catalogue information.

Do not invent:

- Product existence
- Storage location
- Compatibility
- Prices
- Stock availability

### Stage F: Unknown product

If the system cannot identify a reliable match:

- Explain that it cannot confirm the item.
- Record an unresolved question.
- Allow knowledgeable staff to review it.

### Stage G: Human correction

Staff should be able to:

- Resolve the question
- Link it to an existing product
- Add a missing alias
- Add or correct a product
- Verify the information

Unverified suggestions must not silently become trusted catalogue entries.

## SECTION 7 — USER INTERFACE

Build four main screens.

### Screen 1: Worker Ask

- Large microphone button
- Language selection
- Text search fallback
- Editable transcript
- Search/submit action
- Loading state
- Error state
- Results
- Spoken response replay

### Screen 2: Search Result

- Product name
- Brand
- Model
- Size/specifications
- Rack/shelf/box
- Optional photo
- Verification indicator
- Clear clarification UI when necessary

### Screen 3: Staff Catalogue

- List products
- Add product
- Edit product
- Add/remove aliases
- Manage specifications
- Assign locations
- Mark information verified

### Screen 4: Unresolved Questions

- Recent unanswered queries
- Original recognized text
- Unresolved reason
- Suggested candidates if appropriate
- Staff review actions
- Resolution status

Aim for a clean, approachable, mobile-first interface suitable for someone unfamiliar with complicated software.

Do not prioritize visual animation over working functionality.

## SECTION 8 — API DESIGN

Design documented endpoints, adapting names where appropriate.

Expected capabilities include:

- Health check
- List products
- Get one product
- Create product
- Update product
- Add/remove aliases
- Verify a product
- Text search
- Submit clarification response
- View unresolved questions
- Resolve unanswered question
- Transcribe audio using Prisma
- Synthesize answer using Timbre

Use structured request and response schemas.

Define useful error codes.

Prevent unauthenticated public users from changing the catalogue. For the demo, a local-only staff workflow or simple documented access control is acceptable, but do not deploy an unprotected administration interface publicly.

## SECTION 9 — BUILD ORDER

Implement sequentially.

### Milestone 1 — Foundation

- Inspect existing files
- Create repository
- Initialize backend
- Initialize frontend
- Add SQLite
- Health endpoint
- Local run instructions

Definition of done:

Frontend and backend start without errors.

### Milestone 2 — Sample Data

- Create 20 synthetic product records
- Add aliases
- Create ambiguous records
- Seed database
- Validate record schema

Definition of done:

All sample records can be loaded and retrieved.

### Milestone 3 — Text Search

- Exact matching
- Alias matching
- Normalization
- Fuzzy matching
- Attribute filtering
- Result ranking
- Unknown-query fallback

Definition of done:

The application retrieves appropriate products using typed questions and avoids unsafe substitutions.

### Milestone 4 — Clarification

- Multiple matching candidates
- Attribute-based questions
- Conversation state
- Follow-up processing
- Safe fallback

Definition of done:

The application resolves ambiguous queries when adequate information is supplied.

### Milestone 5 — Interfaces

- Worker Ask
- Item result
- Staff catalogue
- Unresolved review
- Mobile layout

Definition of done:

A user can complete the entire typed workflow in the browser.

### Milestone 6 — Prisma Integration

- Authenticate
- Capture audio
- Send to backend
- Transcribe
- Handle errors
- Search transcript

Definition of done:

At least one actual spoken query is transcribed through Gnani Prisma and produces an appropriate catalogue search result.

### Milestone 7 — Timbre Integration

- Create speech text
- Call Timbre
- Play audio
- Support clarification responses
- Handle failures

Definition of done:

At least one actual catalogue answer is audibly synthesized through Gnani Timbre.

### Milestone 8 — Evaluation

- Generate a structured test set
- Run automated tests
- Run actual speech tests
- Analyze failures
- Fix issues
- Re-run tests

Definition of done:

Saved, reproducible evaluation results are available.

### Milestone 9 — Demo and Submission

- Improve UX
- Prepare README
- Record working demonstration
- Create technical explanation
- Prepare submission text
- Publish genuine public demo
- Complete official submission

Definition of done:

The complete submission package meets the official rules and accurately describes the working application.

## SECTION 10 — TESTING STRATEGY

Create at least 40–60 scripted queries for testing the matching engine.

Cover:

- Exact names
- Local nicknames
- Hinglish queries
- Different spellings
- Speech transcription mistakes
- Similar product names
- Different sizes
- Different brands
- Different appliance models
- Missing specifications
- Unknown products
- Repeated clarification
- Negative queries
- Unavailable APIs
- Malformed input

Keep typed-query tests distinct from actual recorded-audio tests.

Do not report typed-query results as speech recognition results.

Metrics:

1. Correct item identification rate
2. Wrong confident answer rate
3. Clarification rate
4. Safe abstention rate
5. Query completion time
6. Prisma transcription errors
7. Speech-to-answer latency where measurable

For every test case, save:

- Input
- Expected output
- Actual output
- Pass/fail
- Error category

Build a baseline exact-keyword search and compare it against the improved matching engine.

Explain what caused improvements rather than claiming better performance without evidence.

## SECTION 11 — PROJECT DIFFERENTIATION

Our objective is not to create another generic voice chatbot.

Shop Finder should demonstrate:

- Verified local product knowledge
- Useful nickname and alias handling
- Code-mixed voice support if successfully tested
- Specification-aware searching
- Clarification instead of guessing
- A correction workflow
- Measurable robustness
- Graceful failures

Identify the project's three strongest engineering contributions.

For each, provide:

- Technical problem
- Approach
- Why the approach was selected
- Alternatives rejected
- Evidence of usefulness
- Known limitations

Avoid unsupported claims about uniqueness or being the first of its kind.

## SECTION 12 — DEMONSTRATION

Design a convincing 60-second public demo.

Suggested sequence:

0–10 seconds:
Demonstrate the worker's problem.

10–20 seconds:
Ask a real question using Prisma.

20–35 seconds:
Show two similar products and one clarification question.

35–45 seconds:
Return and speak the confirmed location using Timbre.

45–55 seconds:
Demonstrate how an unknown product is logged for staff review.

55–60 seconds:
Show actual measured results and models used.

Use real application output.

Do not substitute fabricated AI responses, fake API output or untested performance claims.

State clearly when the catalogue is synthetic.

## SECTION 13 — COMPETITION COMPLIANCE

Research the current official Gnani AI challenge rules and verify:

- Eligibility requirements
- Registration details
- Submission deadline
- Gnani API requirements
- Public-demo requirements
- Required hashtags
- Shortlisting process
- Interview process
- Programme restrictions

Primary source:
https://www.gnani.ai/internship

The competition requires real Gnani technology usage and a working public demo.

It also prohibits fake demonstrations and manipulated engagement.

Do not misrepresent sample records or synthetic tests as verified shop deployments.

Do not assume completing the project guarantees internship selection.

## SECTION 14 — TIME AND RESOURCE MANAGEMENT

Assume work begins on October 24, 2026.

Deadline: November 10, 2026.

Prioritize:

1. Working end-to-end core workflow
2. Real Gnani integration
3. Reliable tests
4. Clear public demonstration
5. Documentation
6. Optional polish

Maintain a daily development checklist.

At each milestone provide:

- What was built
- Files created or modified
- Commands run
- Tests executed
- Actual results
- Known problems
- Next concrete task

If a feature threatens the submission deadline, recommend reducing scope.

Do not spend money or make purchases.

Do not require cloud deployment when local demonstration is enough.

## SECTION 15 — TEACHING REQUIREMENT

Assume I have basic Python knowledge but am still learning full-stack development.

For every important technical concept:

1. Explain what it is.
2. Explain why this project needs it.
3. Show how it works using a Shop Finder example.
4. Explain the code being written.
5. Explain how to test it.
6. Explain common mistakes.

Avoid overwhelming explanations.

Teach one component at a time.

However, do not replace actual implementation with endless tutorials.

## SECTION 16 — WORK MODE EXECUTION RULES

You must distinguish between:

- Planned
- Implemented
- Tested
- Blocked
- Verified

Never claim a feature is implemented unless the files or running application demonstrate it.

Before taking action:

- Inspect the current project workspace.
- Reuse existing work if present.
- Avoid overwriting valuable files.
- Record important architectural choices.

When a tool is available, use it to create and test real deliverables rather than merely describing how to build them.

If access to a local repository or application environment is unavailable, produce a complete, runnable project bundle and explicit execution instructions without pretending to have run it on my computer.

Do not ask unnecessary planning questions.

Use reasonable engineering defaults and document them.

Ask for my involvement only when necessary, such as:

- Providing API credentials through a secure mechanism
- Completing account authentication
- Approving an external or consequential action
- Confirming an important unresolved API limitation
- Running hardware-dependent microphone tests
- Making the final submission

Never ask me to paste secret API keys into chat.

When blocked by one feature, continue working on independent parts of the application.

## SECTION 17 — MENTOR REVIEW

Maintain a file named:

docs/mentor_questions.md

Include only genuine uncertainties requiring expert advice.

Examples:

- Whether deterministic matching gives sufficient technical depth for the competition
- Which Prisma language configuration performs best for the proposed use case
- Whether the current Gnani API supports the needed audio workflow
- Whether our evaluation is convincing enough
- How to improve a failure that cannot be solved safely using simple matching

For each question include:

- The problem
- What we already tried
- Evidence
- Available alternatives
- Your recommendation
- What the mentor needs to decide

Do not repeatedly ask the mentor questions that can be answered by official documentation or ordinary testing.

## SECTION 18 — FINAL OUTPUTS

Produce:

1. Complete working source code
2. Seeded synthetic database
3. Backend API
4. Frontend interface
5. Gnani Prisma integration
6. Gnani Timbre integration
7. Matching and clarification engine
8. Catalogue management
9. Unresolved-query workflow
10. Automated tests
11. Evaluation report
12. README and architecture diagram
13. Demo script
14. LinkedIn post draft
15. Submission description
16. Mentor questions
17. Technical interview preparation
18. Final compliance checklist

If anything is incomplete, clearly identify the missing parts.

## YOUR IMMEDIATE TASK

Start implementation with Milestone 1 and Milestone 2.

First inspect the workspace, verify the current official API documentation and create a short implementation plan.

Then create the actual project structure, backend, frontend, SQLite schema and 20 realistic synthetic spare-part records.

Run the available tests and provide the results.

Afterward continue milestone by milestone, starting with typed search, clarification and the worker interface.

Do not stop after producing a theoretical plan.

The objective is a working, tested Shop Finder application that demonstrates genuine engineering ability and can be confidently defended in an individual internship interview.

## DOMAIN SAFETY ACCEPTANCE CRITERIA (CORRECTION, 24 OCTOBER 2026)

- Synthetic records are browseable for development but cannot be described as verified parts or installation advice.
- Exact part numbers, model compatibility, AC/DC supply, ratings, dimensions and connectors take precedence over name similarity.
- Unknown compatibility causes clarification or staff review, never inferred compatibility.
- Even numerically higher ratings do not establish interchangeability.
- Fuzzy retrieval may generate candidates, never substitution recommendations.
- Staff changes to identity, technical data or compatibility invalidate prior verification pending re-review.
- Clarification must retain previous constraints; a follow-up cannot silently discard a conflicting rating or model.
- The architecture, selected Gnani models, verification workflow, evaluation strategy and nine milestones above remain unchanged.
