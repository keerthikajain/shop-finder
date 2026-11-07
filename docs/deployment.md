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
