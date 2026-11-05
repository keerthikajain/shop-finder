# Official Gnani integration research
Checked 30 October 2026. Documentation verified; no paid API calls made, no live response observed. REST adapters are implemented and mock-tested; live validation is pending.

- [Introduction](https://docs.gnani.ai/api/introduction/introduction): base URL `https://api.vachana.ai`; authentication header `X-API-Key-ID`; Prisma v2.5 and Timbre v2.5; REST and streaming options. Keep credentials backend-only.
- [STT REST](https://docs.gnani.ai/api/STT/speech-to-text): `POST /stt/v3`, multipart `audio_file` and `language_code`; response includes `success`, `request_id`, `timestamp`, `transcript`. WAV/MP3/OGG/FLAC/AAC/M4A accepted, maximum 30 seconds (client capture is capped at 28 seconds). Documented errors include 400, 403, 429, 500, 503. Exact account quotas/credit consumption not confirmed. Do not treat browser WebM audio as automatically accepted.
- [Quick start](https://docs.gnani.ai/api/introduction/quick-start): STT sample rate 8–44.1 kHz; Hindi example uses `hi-IN`. REST is sufficient for the initial short-recording flow; streaming is available but not required.
- [TTS REST](https://docs.gnani.ai/api/TTS/tts-inference): `POST /api/v1/tts/inference`, JSON containing text, voice, model, language and audio_config. Implemented model `timbre-v2.5`. Choose WAV/linear_pcm, 48 kHz, mono, 16-bit for initial playback. Response is binary audio. Handle 400/429/500/503 without inventing a spoken result.
- [Voice catalogue](https://docs.gnani.ai/api/TTS/available-voices): Hindi voice `Nalini`, language `hi-IN`; English `en-IN` has its own listed voices; Hinglish uses `hi-en` with `Poorvi`. Preserve model/voice compatibility. A language existing in documentation does not establish tested support in Shop Finder.

## Before implementation / first live call
Confirm account credit balance, exact consumption rules and numeric rate/concurrency limits in the account console or with Gnani. Confirm response handling with a non-sensitive short fixture, then validate browser recording format and language. Keep STT/TTS errors distinct from catalogue failures. Never paste keys into chat. No budget is authorized for purchases.

Prisma v2.5 uses a single selected input language. Mixed mode sends hi-IN to STT and is experimental. TTS maps en-IN to Kaveri, hi-IN to Nalini and hi-en to Poorvi with timbre-v2.5. No live response has been validated.
