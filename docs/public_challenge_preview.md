# Public challenge preview

Shop Finder's public preview is an **opt-in, separate installation** for challenge reviewers and visitors. It must not be enabled on a workplace's real server.

## What visitors see

The sign-in page includes **Try Shop Finder** when the preview is enabled. Visitors enter with a private, temporary staff-level session. They can browse synthetic products, search in supported languages, choose the exact variant, view sample shelf locations, run a picking worklist, scan a sample code, try voice recognition and spoken guidance (only if Gnani is configured), and submit a suggestion.

The app explains the challenge and labels the records as fictional. It is a working product preview, not a claim that all real-world speech recognition languages have been validated.

Public users cannot change stock, shelves, products, accounts, invitations, manager roles, workspace settings, import/export data, owner reviews, or other users' worklists. They cannot create owner reports. Suggestions are available to the owner in **Settings → Challenge visitor suggestions**.

## Deployment safety

1. Create a **new deployment with its own persistent SQLite database, server, host, and secrets**. Do not reuse the actual worker deployment or its storage volume.
2. Initialize a dedicated owner account in that environment using the supported owner-setup flow. Do **not** publish this password.
3. Enable synthetic data by setting `SHOP_FINDER_SEED_DEMO=true`. Do not import real products, names, customer data, or photographs.
4. Enable the preview with `SHOP_FINDER_PUBLIC_DEMO=true`. Keep this false on private installations. The app will also refuse visitor entry if it detects any non-synthetic catalogue record.
5. Serve over HTTPS and set `SHOP_FINDER_SECURE_COOKIE=true`. Configure Gnani only with a **separate, limited/quota-controlled API key**, and monitor usage. A disabled provider still permits typed search; no voice accuracy claim should be made until live-tested.
6. Test in a private/incognito browser: open the site without signing in, choose **Try Shop Finder**, search for a sample product, verify a pick, leave feedback, and confirm administrative APIs return 403.
7. Restart the service and verify your database is persistent. Do not publicly share the owner account or visitor session cookies.

Preview accounts and their worklists are temporary and scoped to each visit. Old inactive visitor accounts are cleaned up during new guest entries. Visitor feedback is retained in the preview database so the owner can review it. Do not share personal information in feedback.

## Public entry controls

- `POST /api/demo/enter` creates a restricted guest session; rate-limited.
- `POST /api/demo/feedback` accepts one 10–800-character suggestion, rate-limited.
- `GET /api/demo/feedback` is owner-only.
- The public route allowlist is enforced on the server, not solely by hiding UI buttons.
- The mode is disabled by default. If `SHOP_FINDER_PUBLIC_DEMO` or `SHOP_FINDER_SEED_DEMO` is false, visitors see only ordinary login and invitation flows.

## Challenge demonstration

A reviewer can try **Blue T-shirt size M and black jeans size 32**, click **Find items**, then **Start picking** and test **Repeat location**, **Found it**, and **Stop**. They can test regional-language voice and text queries; some wording may still be unrecognized and must not yield guessed shelves. The code never substitutes a different colour/size merely to return a result. For the strongest evaluation, record real speech success/error rates for every supported language separately.
