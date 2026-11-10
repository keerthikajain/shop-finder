# Deployment and data ownership

This release includes deployable source and container configuration. It has **not** been publicly deployed or load-tested. The local Python/React workflow remains the easiest first verification.

## Docker on your own machine

From the `shop-finder` folder:

```sh
docker compose up --build -d
docker compose exec app python scripts/create_owner.py
```

The second command securely prompts for the initial owner's username and password. Open `http://127.0.0.1:8080`. No default account is included. The named volume `shopfinder_data` keeps the SQLite database when the container is recreated. Do not run `docker compose down -v` if you want to retain it.

To use voice, provide `GNANI_ENABLED=true` and `GNANI_API_KEY` through your hosting provider’s secret/environment settings, or a private untracked `.env` file for local Compose. Never put the key in a `VITE_` variable, frontend code, screenshots or GitHub. This is the same key the local start script asks for; you do not need another AI provider for this release.

## A public pilot

Choose a host that runs a persistent Python/Docker service and provides HTTPS, a persistent disk and an interactive shell/one-off command. A static frontend deployment alone is insufficient.

- Build using the supplied Dockerfile.
- Attach a persistent disk mounted at `/data`.
- Set `SHOP_FINDER_DB=/data/shop_finder.sqlite3`.
- Set `SHOP_FINDER_SECURE_COOKIE=true` behind the host's HTTPS endpoint.
- Set `SHOP_FINDER_SEED_DEMO=true` for the synthetic challenge demo. Use a fresh database and `false` for an empty real installation. Switching this flag off does not delete existing demo records.
- Set the two Gnani settings above only in the host's secrets panel.
- Use one instance and one worker for this pilot. The entry point listens on the host-provided `PORT` or 8080.
- Run `python scripts/create_owner.py` in the host shell. Create staff through Account after logging in.
- Check login/logout, import, a restart, owner/staff separation, voice capture/playback and camera scanning over HTTPS.
- Back up the database using SQLite's backup API or while the service is stopped. Restore a copy once to verify recovery.

## What you need to provide

A hosting account/provider, access to deploy the project, and your API key entered privately into that provider. You can choose a custom domain later. A phone and a printed label are needed to validate the real scan workflow.

## Scale boundary

One installation currently represents one organisation; its authorised owner and staff share its catalogue. This is not a multi-tenant SaaS. Product types are catalogue filters, not separate customer security boundaries. Business setup is shared by all accounts in this installation. Do not onboard unrelated companies into one installation.

For larger rollout, add organisation-scoped database access, migrations, PostgreSQL, background imports, pagination/search indexes, backup monitoring, structured logging and measured load tests. This version does not provide ERP synchronisation, automatic stock sensing, warehouse floor-plan routing, SSO, offline voice or arbitrary language support. It records locations, confirmations and explicit stock changes with before/after audit history. Counts update only from confirmed operations or reviewed imports; they are not automatically synchronised with sales or physical movement.

## Public login greeting and live voice deployment

The login page has a brief spoken greeting and a **Hear welcome** replay control. The greeting uses the visitor's **browser speech synthesis** so no Gnani API key or metered public TTS endpoint is exposed to anonymous visitors. Browsers may block automatic audio on first arrival; the replay control is user-initiated and the login form still works without audio. The login greeting is therefore not the **Prakash** voice. Authenticated search and picking continue to use Gnani Prisma STT and Timbre TTS when configured.

For a dedicated HTTPS challenge instance set these values in your **hosting provider's private backend environment**, not in tracked code:

```dotenv
GNANI_ENABLED=true
GNANI_STT_MODEL=prisma-v3.0
GNANI_TTS_MODEL=timbre-v3.0
GNANI_TTS_VOICE=Prakash
SHOP_FINDER_CHALLENGE_SIGNUP=true
SHOP_FINDER_SEED_DEMO=false
SHOP_FINDER_PUBLIC_DEMO=false
SHOP_FINDER_SECURE_COOKIE=true
SHOP_FINDER_DB=/data/shop_finder.sqlite3
SHOP_FINDER_CHALLENGE_DATA_DIR=/data/reviewer_workspaces
```

Supply `GNANI_API_KEY` using the host's **secret** setting. The `/data` paths require a persistent mounted volume. For non-HTTPS local testing, use `SHOP_FINDER_SECURE_COOKIE=false`; production must use HTTPS (also required for microphone/camera permissions). Docker Compose currently binds `127.0.0.1:8080`, so configure a public HTTPS reverse proxy with access to the service or make the binding appropriate for your chosen hosting platform; a private localhost binding alone is **not** a publicly deployed website.

Before sharing a judge URL: confirm browser login and signup, data isolation, Prisma transcription, Timbre voice entitlement/playback, microphone permissions, picking confirmation, report transcription and owner review, HTTPS cookies, persistent volume after restart, and no public access to `.env` or backend secrets. GitHub CI uses mock provider responses; passing checks cannot guarantee a live Gnani account or browser playback.

