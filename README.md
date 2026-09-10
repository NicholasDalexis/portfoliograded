# Portfolio Graded

Portfolio Graded reviews a portfolio homepage and presents letter grades, category feedback, and desktop and phone evidence. Version **1.2** migrates the reviewed v1.1.9 product to Netlify. The portfolio builder remains outside this release.

## Local, preview, then main

1. Iterate and test locally with Node 24 and npm. Localhost needs no preview password.
2. Publish a reviewed candidate deliberately to the Netlify `preview` alias for phone review.
3. Verify the password gate, Google sign-in, grading, both screenshots, private saved reports and responsive layouts on the actual deployment.
4. Nic reviews the preview before a separate main promotion. Main DNS and historical data transfer are separate migration steps.

The migration checkout uses branch `netlify-preview`. The previous `preview` branch is still associated with Railway, so pushing that branch is not the Netlify deployment procedure. No automatic repository build is configured for this new Netlify site. Keep deployments deliberate to avoid paying for uploads during every local iteration.

The original private local checkout contains additional unfinished candidate work. Do not overwrite or publish its credentials, data, screenshots or unreviewed changes when syncing source. This repository uses a publication allowlist.

## Local development

```sh
npm ci
npm run check
npm run test:security
npm run app
```

`npm run app` builds the integrated application and starts the loopback-only local bootstrap at localhost:3000. Supply credentials privately. Local operation retains its existing file store; it does not write to Netlify preview storage. `npm run dev` starts only the Vite frontend.

## Netlify preview

- Team: Elevate Media (`nicholasdalexis`), shared with StillUnemployed.
- Project: `portfoliograded`, ID `930bbc2d-8685-4f13-ac94-942f2b907f55`.
- Preview: https://preview--portfoliograded.netlify.app
- Dashboard: https://app.netlify.com/projects/portfoliograded

After installing the Netlify CLI and linking this project:

```sh
netlify link --id 930bbc2d-8685-4f13-ac94-942f2b907f55
netlify deploy --alias preview --context branch-deploy --build
```

This is a preview deployment. Do not use `--prod` until main promotion is approved and its data/domain checklist is complete. Netlify's deploy result is not proof that the application works; run the hosted acceptance checks above.

### Runtime and storage

React/Vite assets are protected by an Edge Function. Modern Node 24 Functions serve the Express APIs. Grading starts an HMAC-authorized background function; the browser polls an owner-bound job record. Duplicate worker delivery cannot begin the same job twice. Jobs and quotas are bounded, and the default global scan concurrency is two.

Netlify Database provides PostgreSQL transactions for existing report, history, preference, claim and quota operations. The preview database branch is `preview`; SQL migrations live under `netlify/database/migrations`. The current adapter uses a locked JSONB document with a 32 MB ceiling. This is a bounded preview implementation, not a claim of unlimited production scale. Never hold a database transaction across a crawl or model call.

Screenshots use private Netlify Blobs and a serverless Chromium build. Access checks happen before reading a report's image. The browser capture retains URL/DNS and request-budget guards; the Lambda browser uses the provider-compatible process flags rather than the local Chrome OS sandbox. Production acceptance still needs screenshot retention limits, capacity/load review, legacy data migration, and domain cutover. The filesystem archive has its existing bounded retention; the new Blobs archive does not yet have automatic pruning.

### Private environment

Configure these through Netlify's environment settings, never source files: Firebase service account, existing AI provider key, preview password hash, stable preview-cookie secret, background-job HMAC secret, administrator IDs and exact allowed origins. Additional configuration includes `PG_STORAGE=netlify-db`, `PG_BLOB_NAMESPACE=preview`, `PG_DEPLOYMENT_ENV=preview`, `PG_NETLIFY_CAPTURE=true`, `SCREENSHOTS_ENABLED=true`, `PG_DATA_DIR=/tmp/portfolio-graded`, and `TRUST_PROXY_HOPS=1`.

`BILLING_ENABLED=false` and `PG_USAGE_ENABLED=false` are intentional. The production usage worker is not yet adapted to this serverless release, and Netlify refuses to start it accidentally. Existing Firebase identity is shared; report records in this new preview are isolated from Railway. No historical reports are copied automatically.

Firebase authorized domains and browser-key referrer restrictions must include the exact stable preview origin. Retain the API allowlist; do not remove restrictions to make sign-in work. Dynamic deployment permalinks are for internal worker dispatch and deployment verification, not user OAuth sign-in.

### Firebase runtime compatibility

`jwks-rsa` 4.1.0 synchronously requires ESM-only `jose`, which fails under Netlify's Lambda runtime. A small version/content-checked postinstall patch changes the two imports to asynchronous imports while retaining jose 6 and key verification behavior. It fails closed if upstream files change. See [upstream issue 507](https://github.com/auth0/node-jwks-rsa/issues/507). Remove the patch once the upstream compatible release is verified. The regression test starts Node with synchronous ESM disabled, verifies a real RSA token, and rejects a tampered token. No experimental runtime override is required.

### Existing main hosting

At this migration stage, portfoliograded.com and the old Railway preview remain unchanged. Keep Railway data available until backup, report migration, main acceptance, DNS/TLS and rollback checks are complete. A new Netlify preview alone does not stop Railway charges or migrate the custom domain.
