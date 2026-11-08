# Shop Finder security hardening review — November 8, 2026

This review covers a single-organisation pilot. Automated results are not a penetration test and do not guarantee an unhackable deployment.

## Protections verified in source code

- Per-account login and revocable hashed session tokens; HTTP-only SameSite Strict cookies.
- Salted PBKDF2-HMAC-SHA256 password hashes with 600,000 iterations; passwords and tokens are not returned in account API responses.
- Server-owned Gnani provider credentials; the frontend never needs the key.
- Owner authorization enforced for user management, imports, catalogue changes, location moves, activity history and resolution. Warehouse stock permissions remain conditional on the owner's settings.
- Unsafe HTTP actions reject cross-origin browser requests and require X-Shop-Request. No permissive cross-origin middleware is enabled.
- Role-based, database-backed rate limits for expensive search, voice, media, imports and reporting operations, including live voice WebSocket connections.
- CSP requiring same-origin scripts, disabled framing, nosniff, explicit debug-off and minimal unauthenticated health responses.
- Database and uploaded photo file permissions are restricted on POSIX; upload limits and image signatures are validated; CSV formula characters are escaped.
- Inventory is always validated with Pydantic, SQL uses parameterized queries in inspected routes, and React renders dynamic labels as escaped text.

## Secrets, environment and dependencies

- The .env file and SQLite files are git-ignored and excluded from Docker builds.
- No credentials were added in this security change. Do not paste API keys into chat, frontend variables, GitHub PRs or logs.
- CI checks fetched Git history for high-confidence credential signatures without printing the matched values. This is a heuristic scan: review GitHub secret-scanning alerts too.
- CI runs npm audit for production dependencies and pip-audit for the pinned Python requirements.
- Dependabot will propose package and build-tool upgrades for review and testing. Do not upgrade major versions blindly.
- For real hosting, configure GNANI_API_KEY and any other credentials in the host's private secret store.
- Use SHOP_FINDER_SECURE_COOKIE=true behind verified HTTPS, SHOP_FINDER_SEED_DEMO=false for real records and persist the SQLite database outside ephemeral containers.

## Incident response for a potentially leaked key

1. Revoke the exposed provider key immediately. Do not rely on deleting the line from Git history.
2. Issue a new credential with the minimum allowed permissions and appropriate limits.
3. Update only the server host secret and redeploy. Do not put the replacement key in GitHub source or a public issue.
4. Review provider usage and application access logs for unusual activity.
5. If GitHub reports a credential in history, address every affected ref and the provider account; cache and clones may retain historical content.

## Not verified by a source-code audit

- Actual hosting configuration, reverse proxy forwarding, TLS, cookies from the live domain, firewall and access controls on cloud storage.
- Whether a secret was copied outside the scanned Git history, used in a screenshot or saved in a different account.
- Real provider limits, camera permission behavior, on-device security, backup/restore and independent vulnerability/penetration testing.
- Availability under abusive traffic, distributed denial-of-service, third-party integrations, and post-release monitoring.

## Production release decision

Use the existing deployment checklist before public exposure. Require an HTTPS host with private secrets, authenticated owner and staff tests, a recoverable database backup, an actual browser/network check of CORS and CSP, a passed GitHub security workflow, and live Gnani regression testing. If any requirement is not met, classify the deployment as a supervised pilot and do not accept sensitive real business data.

Security work must continue after launch: monitor dependencies, rotate credentials, inspect access logs and periodically rerun role and abuse tests.