# Portfolio Graded

Portfolio Graded reviews a portfolio homepage and presents understandable letter grades, category feedback, and desktop and phone evidence where available. This publication snapshot is version **1.1.9**. The portfolio builder remains outside the public product.

The app uses React, Vite, Tailwind, and Express on Node 24. Firebase provides account identity; report records currently use server-owned persistent storage. Billing and other launch features require separate configuration and verification.

## Local work, preview review, then production

The maintained local `folio_grade` project is the source of this publication clone. Private operating notes, keys, user reports, saved screenshots, and runtime data are not part of the repository. Update this clone from reviewed source through its allowlist, then inspect the full Git diff and scan for secrets before publishing.

1. Make quick iterations and run QA locally without uploading a deployment.
2. When an update is ready for phone review, explicitly commit and push the reviewed candidate to `preview`.
3. Verify the resulting separate HTTPS preview, including its password gate, version, account boundaries, and mobile behavior.
4. After acceptance, merge the reviewed preview commit into `main`, explicitly deploy that exact commit to the production service, and verify it. The current production service is not connected to this repository for automatic Git deployment, so a merge alone does not publish it. A preview push does not itself approve a production merge.

Provider linking, branch selection, secrets, preview address, and persistent storage must be configured separately. This repository does not create or point a domain merely by naming a branch `preview`.

## Run locally

Use Node 24 and npm:

```sh
npm ci
npm run check
npm run test:security
npm run test:builder
npm run app
```

`npm run app` builds the integrated application and starts the loopback-only local bootstrap on port 3000. Supply required local credentials privately. Authentication and provider-dependent features report their unavailable states if their credentials are absent. Do not commit `.env` files or credential files. `npm run dev` is the frontend development server; `npm run build:client` is a separate static-client build and does not supply the API.

## Hosted preview

The current deployment path is the existing Railway backend stack, packaged by `Dockerfile`. This is not a completed migration to Netlify. A static host alone does not provide the Express API, persistent report records, or browser capture runtime.

The separate [phone-review preview](https://portfolio-graded-preview-preview.up.railway.app) is being configured and is not yet verified live by this publication snapshot. It is password protected. Cloud screenshots remain disabled until secure browser capture is fixed and verified; a healthy page is not evidence that screenshots work.

The Docker image builds the app, includes Chromium, and starts `node dist/index.js`. Configure hosted environment variables through the provider's private variable store, including the intended `APP_URL`, password hash, account credentials, and storage settings. Use a separate preview service and data volume. Keep one writer for the current report store, and keep unapproved billing, publishing, and notification features disabled. Do not copy production customer data into the preview.

`railway.json` selects the Dockerfile, one replica for the current single-writer report store, and `/healthz`. It clears the obsolete scaffold's start-command override so the image command applies. `/healthz` verifies the app process and version; it does not prove Chromium, sign-in, grading providers, or storage persistence are working. Verify those capabilities separately before claiming them.

Configuration fields follow [Railway's current reference](https://docs.railway.com/config-as-code/reference). Railway currently labels this configuration format deprecated for legacy services after December 1, 2026 and recommends Infrastructure as Code. Check the target service's support before adopting a new deployment path.
