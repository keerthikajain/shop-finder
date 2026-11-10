# Gnani AI challenge — reviewer access

## Public reviewer experience

The challenge deployment uses the **normal Shop Finder app**, not a mock prototype. Every new reviewer can:

- Choose **Create a free workspace** from the sign-in screen, with username and password; or
- Choose the unobtrusive **Explore instantly, without signing up** link.

Either option initializes a real private workspace with working example catalogue records, Owner permissions, and the full product UI. Reviewers can search by text or Gnani voice (when configured), choose variants, follow shelf locations, perform guided picking, scan a saved label, edit products, import CSV/XLSX, configure their business, manage staff accounts and test the permissions workflow. The example search beneath Find items comes from actual saved catalogue products and returns their real **saved sample shelf**, never a fabricated response.

Records are preloaded **examples**, not claims of genuine stock. A reviewer can replace them with their own entries and test true database persistence. Owners and staff use the same product flows. Signed-up reviewer credentials can be used to sign in again; the instant exploration account is temporary and does not come with a recoverable password.

## Deployment

Use a **dedicated challenge host, persistent volume and database**, separate from every real shop or staff environment. Do not run against any real customer, staff or inventory data. Set backend environment variables:

```env
SHOP_FINDER_CHALLENGE_SIGNUP=true
SHOP_FINDER_CHALLENGE_DATA_DIR=/persistent/challenge/workspaces
SHOP_FINDER_DB=/persistent/challenge/registry.sqlite3
SHOP_FINDER_SEED_DEMO=false
SHOP_FINDER_PUBLIC_DEMO=false
SHOP_FINDER_SECURE_COOKIE=true
```

For a dedicated Docker Compose installation, the checked-in `compose.yaml` now passes `SHOP_FINDER_CHALLENGE_SIGNUP` and uses the existing named `shopfinder_data` volume for both the registry and private reviewer databases. Configure the deployment secrets/environment with:

```env
SHOP_FINDER_CHALLENGE_SIGNUP=true
SHOP_FINDER_DB=/data/shop_finder.sqlite3
SHOP_FINDER_CHALLENGE_DATA_DIR=/data/reviewer_workspaces
SHOP_FINDER_SECURE_COOKIE=true
SHOP_FINDER_SEED_DEMO=false
SHOP_FINDER_PUBLIC_DEMO=false
GNANI_ENABLED=true
GNANI_API_KEY=<set privately in your hosting platform>
```

Do **not** commit a populated `.env` file. The credential placeholder above is not an actual key. Provide the key only through the host's secret manager. Keep exactly one app instance with persistent storage; this SQLite build is not for multiple independent replicas. When configured behind a public HTTPS reverse proxy, `SHOP_FINDER_SECURE_COOKIE=true` is required. Do not open the Compose loopback-only port directly to the internet; publish through your host's HTTPS routing.

No initial shared owner account is required for judge signup. Reviewers create private owner workspaces using the sign-in screen. The site must remain online with the persistent volume attached; container recreation must not destroy the `shopfinder_data` volume. If you are using a host-managed container instead of Compose, mount a persistent directory at `/data` and supply the same environment values.

**Before sharing the public URL:** confirm both sign-up and instant exploration work, verify two browsers cannot see each other's edits, restart the service to check persistence, and test real Gnani STT and TTS in the browser. Budget for speech API usage and monitor public sign-up capacity. Do not describe automated CI checks as live microphone or production-load validation.

Build and deploy the standard frontend and backend together over HTTPS. Set Gnani keys in backend secrets, never in frontend `VITE_` variables. Configure API usage and rate limits; each visitor can invoke speech APIs, so public voice usage incurs cost. The preview limits workspace creations per IP and caps the total number of registered reviewer workspaces. It does **not** currently provide production multi-tenancy (central billing, password recovery, tenant self-deletion or advanced quotas); do not market it as that.

Public signup is disabled unless `SHOP_FINDER_CHALLENGE_SIGNUP=true`. Normal Shop Finder installations retain invitation/approval-based staff joining.

## Acceptance test

1. Open the site privately; use **Create a free workspace**, choose a password and enter.
2. Find a preloaded sample product using **Try asking**. Verify SKU and recorded shelf shown match the catalogue.
3. Edit an item or import a spreadsheet; refresh to verify the edits persist.
4. Open another incognito browser, create a second workspace, and confirm the first workspace's edits and staff accounts are invisible.
5. Create a staff account from the first Owner Settings, log out, and sign in as that staff user. Verify normal staff access is restricted.
6. Test voice recognition, results and voice-guided picking with real Gnani API configuration; inspect failures and timeouts, including Hindi, Hinglish, Telugu and Kannada.
7. Restart the server and check both reviewer accounts and their stored catalogue records remain available.

## How to describe the security design during judging

> We retained the actual application workflows for reviewers, but isolated every judge in a separate workspace to prevent changes from interfering with each other. The example records are clearly sample data, and the search always uses the saved SKU and shelf. In a production business rollout, organisation provisioning, staff approvals, access roles, audit events and persistent storage remain controlled; we would add operational controls such as email verification, account recovery and capacity monitoring before multi-customer adoption.

**Do not claim live Gnani multilingual accuracy or production-grade multitenant safety without independent testing.**
