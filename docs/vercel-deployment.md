# Think-a-ling: Vercel deployment

Updated 2026-10-10. Target: https://think-a-ling.vercel.app/. The source builds to `dist/`. Local Gemma/Ollama stays available in development; no public Ollama tunnel or cloud inference was added. Current validation and risks are in [offline/account review](offline-accounts-risk-review.md).

## Build settings

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root | Repository root (`./`) |
| Install | `npm ci` |
| Build | `npm run build` |
| Output | `dist` |
| Node | 24.x |
| Production account URL | `VITE_SUPABASE_URL=https://pyduoijdrfhjxsoseqgu.supabase.co` |
| Production account key | `VITE_SUPABASE_PUBLISHABLE_KEY`, the owner's public publishable key |

The app remains usable without account configuration, but shows that accounts are unavailable. A local `.env.local` does **not** configure Vercel. The owner-provided values have now been set for Production through the authenticated CLI. For a new project, add them in Vercel Settings ? Environment Variables, then redeploy. Never add a secret/service-role key or an Ollama URL. The build rejects privileged account keys.

`vercel.json` supplies build/output settings and security headers. No catch-all rewrite is needed: application state lives at `/`, and build output includes a Ling `404.html`. Missing model/WASM paths must stay errors. There is no production `/local-ollama` endpoint. `/sw.js` is served with no-cache so browsers check for new builds. CSP permits same-origin assets and Supabase HTTPS account requests, and blocks external model telemetry. Original photos are not uploaded; synced text/evidence is uploaded only by explicit choice.

The owner has applied [the Supabase migration](../supabase/migrations/202610090001_discoveries.sql). Live checks confirm the history table and deletion RPC reject anonymous access. Set Supabase Site URL and allowed production redirect to `https://think-a-ling.vercel.app/`, plus local test redirects `http://localhost:5173/` and `http://127.0.0.1:4173/`. Public email confirmation/recovery also needs a suitable configured email provider. Follow the [real-account acceptance procedure](offline-accounts-risk-review.md#account-setup-and-acceptance); email delivery and successful cross-device sign-in were not verified by the agent.

## Exact local commands

PowerShell:

```powershell
Set-Location C:\xampp\htdocs\thing-a-ling
npm.cmd ci
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run test:production -- C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

On this machine a preview may already be running; use that process instead of starting a conflicting one. On another machine substitute its installed Playwright path. `test:production` starts/stops its own local static server and applies Vercel headers; Vite preview alone does not apply those headers.

With production preview running, focused checks:

```powershell
node scripts/run-browser-check.mjs validate-resilience C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
node scripts/run-browser-check.mjs validate-pockets-layout C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
node scripts/run-browser-check.mjs validate-account-live C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
```

The live account check reads ignored `.env.local`; it checks public settings, denied anonymous access and one deliberately invalid login. It creates no users and sends no emails. `node scripts/serve-account-test.mjs` starts an isolated test-only Vite instance on 5174. `validate-account-ui` uses that instance with fake public config and intercepted HTTP responses; its success is not real authentication evidence. `validate-offline-reasoning` performs an actual model run and is optional when another hardware/model/offline regression check is needed; do not rerun it for copy changes.

Build verifies all 17 detection/OCR assets and pinned browser model/runtime assets before/after copying. It then generates a versioned offline allowlist with SHA-256 hashes and the 404 page. Missing or corrupt assets fail the build. Prepared `public/ai` files are committed; normally no setup download is needed. If missing, use `npm.cmd run setup:ai` and `node scripts/prepare-browser-ai.mjs` while online.

## Publish

For the existing Git-connected Vercel project:

```powershell
git status --short
git add src scripts public/demo docs supabase README.md test-images/README.md package.json package-lock.json index.html vite.config.ts vercel.json .vercelignore .env.example
git diff --cached --stat
git commit -m "Add offline study flow and Supabase account history"
git push origin main
```

Review staged changes; do not stage `.env.local`, private photos, recordings or test reports. Vercel should build the pushed commit if automatic deployments are configured. A Git push alone does not prove that Vercel deployed it successfully.

Alternative, using your authenticated Vercel CLI:

```powershell
npx.cmd --yes vercel@latest login
npx.cmd --yes vercel@latest --prod
```

Use the existing Think-a-ling project and `./` directory. The command publishes. `.vercelignore` allows source, static assets and required build scripts; it excludes tests, local credentials and recordings. See [Vercel Vite settings](https://vercel.com/docs/frameworks/frontend/vite) and [deployment command](https://vercel.com/docs/cli/deploy).

## Hosted acceptance checks

1. Confirm the deployment shows the intended Git commit and Account, Edit photo, offline preparation and the study example. A browser with an old service worker may need all site tabs closed before the new worker activates.
2. In a fresh browser, select a photo: real detection/OCR should work without an account or model download. Inspect hotspot evidence, change the photo, hide markers and try fullscreen. Camera capture must show review/retake before Analyze.
3. Open Account, create a real account with an email you control and confirm it. Sign in, save and explicitly sync a text discovery. Verify a second device and isolation from a separate account. Check password recovery and deletion using a disposable account.
4. Choose **Use Think-a-ling offline ? Prepare for offline**. Wait for ready. Disable browser networking and reload. Run the study example and another photo, save/revisit text, crop/rotate and rescan. Core pack is about 75 MiB; accounts still require internet.
5. Separately enable on-device AI while online, complete its approximately 374 MB download, then test cached analysis after an offline reload on a compatible device. Check the answer against the image: the small model can omit/invent details and return unhelpful output.
6. Request a nonexistent page and verify Ling's fallback with HTTP 404. Missing model paths should not return app HTML. Confirm WASM MIME types, model-part downloads and `/sw.js` headers. Do not manually add gzip Content-Encoding to the OCR data file; the cache verifier accepts the two known raw/decoded representations.
7. Confirm no photo inference POST/cloud model request occurs. Supabase requests are expected only for account/session actions and explicit text sync. Sign-in tokens may refresh while a session is active; these requests are not cached by the service worker.

## Validation and limits

Commit `9e4df8e` reached Ready on the production Vercel alias. The live HTTPS smoke passed: configured account form and CSP, real study-example OCR, complete hash-verified offline pack, full offline reload with four new-image detections/OCR, and a real HTTP 404 with Ling. No page errors were reported. The public test is reproducible with `node scripts/run-browser-check.mjs validate-hosted <playwright-path>`.

- Build and lint pass; **53 unit tests** pass. Configured account SDK adds a >500 KB main-chunk warning; this is a remaining startup-performance opportunity.
- Production smoke: actual four-animal detections, real English OCR, boxes/hotspots at 1280/390/320px; file-backed camera live fullscreen, capture/review/retake and track cleanup; no unexpected external requests, image uploads or page errors.
- Resilience: full offline reload, new-image detection/OCR, cached example study flow, text search/recall/save/revisit, crop/rotate/rescan, HTTP 404 fallback and persisted accessibility preference pass. Axe reports zero violations across four tested screens.
- Actual cached SmolVLM image inference and a follow-up completed offline. An overly generic answer was observed and is now rejected by a unit-tested guard. This does not establish consistent answer quality or multilingual accuracy.
- Live Supabase settings, anonymous denial and real invalid-login handling pass. Successful real-user email/login/history isolation and cross-device sync remain acceptance checks; UI success-path tests used HTTP simulation.
- Speech control/lifecycle tests pass with simulated events; actual generated-audio transcription previously failed. Physical microphone use remains unverified and experimental.
- Local Ollama proxy rejection/security checks pass; no new lengthy Gemma benchmark was run. Browser/offline changes do not replace the existing localhost reasoning service.
- Initial downloads, login and sync need internet. Storage can be evicted. PWA installation is not implemented. Phone hardware, mobile Safari, real webcam permissions and full screen-reader usability are not established by desktop viewport/headless checks.

For honest public claims and the remaining risk procedure, use the [current risk review](offline-accounts-risk-review.md) and [browser model quality evidence](browser-ai-validation.md). Previous reports saying offline reload or account integration are absent are historical.
