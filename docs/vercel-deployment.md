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
| Required environment variables | None for the free app |

Login, signup and cloud history are paused at the owner's request. The active application does not import the account SDK, embed its public configuration or make Supabase requests. Existing project variables, dormant account source/migrations and backend data were not deleted. No Supabase setup is needed to run the free app. Never add a secret/service-role key or a public Ollama URL.

`vercel.json` supplies build/output settings and security headers. No catch-all rewrite is needed: application state lives at `/`, and build output includes a Ling `404.html`. Missing model/WASM paths must stay errors. There is no production `/local-ollama` endpoint. `/sw.js` is served with no-cache so browsers check for new builds. CSP restricts connections to the same origin. Photos and saved discoveries stay on the device.

The earlier [account acceptance procedure](offline-accounts-risk-review.md#account-setup-and-acceptance) is retained for future reactivation; successful real-user login and cross-device sync were never verified. Reintroducing accounts would require restoring the UI and relevant CSP configuration as well as completing that acceptance procedure.

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
node scripts/run-browser-check.mjs validate-settings C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
```

`validate-settings` also needs the existing local dev server on port 5173. It runs real detection/OCR and uses recorded model responses to verify that the language selected in Settings reaches the local reasoning request. This is not a language-accuracy test. Account suites are historical and should not run against the free UI. `validate-offline-reasoning` performs an actual model run and is optional when another hardware/model/offline regression check is needed; do not rerun it for copy changes.

Build verifies all 17 detection/OCR assets and pinned browser model/runtime assets before/after copying. It then generates a versioned offline allowlist with SHA-256 hashes and the 404 page. Missing or corrupt assets fail the build. Prepared `public/ai` files are committed; normally no setup download is needed. If missing, use `npm.cmd run setup:ai` and `node scripts/prepare-browser-ai.mjs` while online.

## Publish

For the existing Git-connected Vercel project:

```powershell
git status --short
git add src scripts docs README.md vercel.json
git diff --cached --stat
git commit -m "Simplify free app and move preferences into Settings"
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

1. Confirm the deployment shows the intended Git commit, purple navbar, Saved and Settings, with no account or study-example controls. A browser with an old service worker may need all site tabs closed before the new worker activates.
2. In a fresh browser, select a photo: real detection/OCR should work without an account or model download. Inspect hotspot evidence, change the photo, hide markers and try fullscreen. Camera capture must show review/retake before Analyze.
3. Open Settings. Change answer language and accessibility preferences; close and reopen, then reload. Check that selections persist and that language controls are absent from the analysis card. Save/revisit/delete recognized text without signing in.
4. Choose **Settings → Offline downloads → Prepare for offline**. Wait for ready. Disable browser networking and reload. Upload study notes and another photo, save/revisit text, crop/rotate and rescan. Core pack is about 75 MiB.
5. Separately enable on-device AI while online, complete its approximately 374 MB download, then test cached analysis after an offline reload on a compatible device. Check the answer against the image: the small model can omit/invent details and return unhelpful output.
6. Request a nonexistent page and verify Ling's fallback with HTTP 404. Missing model paths should not return app HTML. Confirm WASM MIME types, model-part downloads and `/sw.js` headers. Do not manually add gzip Content-Encoding to the OCR data file; the cache verifier accepts the two known raw/decoded representations.
7. Confirm no photo upload, cloud inference or Supabase request occurs. Browser analysis uses local assets; Gemma remains available only in the local development app.

## Validation and limits

The 2026-10-10 free-app revision passes build, lint, 53 unit tests and focused Chrome 153 browser checks. Tested: navbar at 1440/390/320px, centered Ling, local save/reopen/delete, persistent accessibility/language settings, keyboard focus restoration, no language selector in the analysis card, and Filipino/English preferences reaching local reasoning request prompts using recorded responses. The complete offline reload/OCR/edit/rescan/404 suite passes with zero Axe violations across home, Settings, Settings with larger text, OCR/recall and photo editor. The production camera/upload/hotspot smoke also passes. No Supabase SDK or public key is present in the application bundle; no account requests occurred. These checks do not establish model language fluency.

Historical baseline: commit `9e4df8e` reached Ready on the production alias and passed its then-active account-form/OCR/offline/404 smoke. Its account form and example button are now removed. The revised public test is reproducible with `node scripts/run-browser-check.mjs validate-hosted <playwright-path>`.

- Build and lint pass; **53 unit tests** pass. Removing the active account SDK reduced the minified main bundle from about 742 KB to 520 KB. A >500 KB chunk warning remains.
- Production smoke: actual four-animal detections, real English OCR, boxes/hotspots at 1280/390/320px; file-backed camera live fullscreen, capture/review/retake and track cleanup; no unexpected external requests, image uploads or page errors.
- Resilience: full offline reload, new-image detection/OCR, uploaded study-note flow, text search/recall/save/revisit, crop/rotate/rescan, HTTP 404 fallback and persisted accessibility preference pass.
- Actual cached SmolVLM image inference and a follow-up completed offline. An overly generic answer was observed and is now rejected by a unit-tested guard. This does not establish consistent answer quality or multilingual accuracy.
- Historical Supabase settings, anonymous denial and invalid-login handling passed before accounts were paused. Any future reactivation still needs real-user email/login/history isolation and cross-device acceptance; previous UI success-path tests used HTTP simulation.
- Speech control/lifecycle tests pass with simulated events; actual generated-audio transcription previously failed. Physical microphone use remains unverified and experimental.
- Local Ollama proxy rejection/security checks pass; no new lengthy Gemma benchmark was run. Browser/offline changes do not replace the existing localhost reasoning service.
- Initial downloads need internet. Storage can be evicted. Login and sync are currently unavailable. PWA installation is not implemented. Phone hardware, mobile Safari, real webcam permissions and full screen-reader usability are not established by desktop viewport/headless checks.

For honest public claims and the remaining risk procedure, use the [current risk review](offline-accounts-risk-review.md) and [browser model quality evidence](browser-ai-validation.md). Previous reports saying offline reload or account integration are absent are historical.
