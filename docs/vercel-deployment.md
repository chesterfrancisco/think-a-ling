# Think-a-ling: Vercel deployment

Updated 2026-10-10. Target: https://thinkaling.vercel.app/. The source builds to `dist/`. Local Gemma/Ollama stays available in development; no public Ollama tunnel or cloud inference was added. Current validation and risks are in [offline and risk review](offline-accounts-risk-review.md).

The `thinkaling.vercel.app` domain is assigned to the existing **think-a-ling** Vercel project; the GitHub repository and local folder do not need renaming. The earlier domain remains available for existing browser saves. Saves, settings and downloaded offline/model caches belong to each origin: they do not move automatically to the new address. Prepare downloads again at the new address if needed.

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

The free app opens directly, with no account setup or authentication service required. Saved discoveries are device-only. The active application does not import the account SDK or make Supabase requests. Existing backend data has not been deleted. Never configure a public Ollama URL.

`vercel.json` supplies build/output settings and security headers. No catch-all rewrite is needed: application state lives at `/`, and build output includes a Ling `404.html`. Missing model/WASM paths must stay errors. There is no production `/local-ollama` endpoint. `/sw.js` is served with no-cache so browsers check for new builds. CSP restricts connections to the same origin. Photos and saved discoveries stay on the device.

## Exact local commands

PowerShell:

```powershell
Set-Location C:\xampp\htdocs\thing-a-ling
npm.cmd ci
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run test:production
npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

On this machine a preview may already be running; use that process instead of starting a conflicting one. Browser tests use the locked Playwright Core dependency and an installed Chrome browser; no machine-specific package path is required. `test:production` starts/stops its own local static server and applies Vercel headers; Vite preview alone does not apply those headers.

With production preview running, focused checks:

```powershell
node scripts/run-browser-check.mjs validate-dashboard
node scripts/run-browser-check.mjs validate-resilience
node scripts/run-browser-check.mjs validate-pockets-layout
node scripts/run-browser-check.mjs validate-settings
node scripts/run-browser-check.mjs validate-simple-answers
```

`validate-settings` also needs the existing local dev server on port 5173. It runs real detection/OCR and uses recorded model responses to verify that the language selected in Settings reaches the local reasoning request. This is not a language-accuracy test. `validate-offline-reasoning` performs an actual model run and is optional when another hardware/model/offline regression check is needed; do not rerun it for copy changes.

Build verifies all 17 detection/OCR assets and pinned browser model/runtime assets before/after copying. It then generates a versioned offline allowlist with SHA-256 hashes and the 404 page. Missing or corrupt assets fail the build. Prepared `public/ai` files are committed; normally no setup download is needed. If missing, use `npm.cmd run setup:ai` and `node scripts/prepare-browser-ai.mjs` while online.

## Publish

For the existing Git-connected Vercel project:

```powershell
git status --short
git add src scripts docs README.md vercel.json
git diff --cached --stat
git commit -m "Update Think-a-ling"
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

1. Confirm the deployment shows the intended Git commit, purple navbar, Saved and Settings, with no account controls. **Need inspiration?** offers five sample pictures that open real inputs and prepare a question, without starting optional AI downloads. A browser with an old service worker may need all site tabs closed before the new worker activates.
2. In a fresh browser, select a photo: real detection/OCR should work without an account or model download. Inspect hotspot evidence, change the photo, hide markers and try fullscreen. Camera capture must show review/retake before Analyze.
3. Open Settings. Change answer language and accessibility preferences; close and reopen, then reload. Check that selections persist and that language controls are absent from the analysis card. Save/revisit/delete recognized text on this device.
4. Choose **Settings → Offline downloads → Prepare for offline**. Wait for ready. Disable browser networking and reload. Upload study notes and another photo, save/revisit text, crop/rotate and rescan. Core pack is about 84 MiB, including the five sample pictures.
5. Separately enable on-device AI while online, complete its approximately 374 MB download, then test cached analysis after an offline reload on a compatible device. Check the answer against the image: the small model can omit/invent details and return unhelpful output.
6. Request a nonexistent page and verify Ling's fallback with HTTP 404. Missing model paths should not return app HTML. Confirm WASM MIME types, model-part downloads and `/sw.js` headers. Do not manually add gzip Content-Encoding to the OCR data file; the cache verifier accepts the two known raw/decoded representations.
7. Confirm no photo upload, cloud inference or Supabase request occurs. Browser analysis uses local assets; Gemma remains available only in the local development app.

## Validation and limits

The 2026-10-10 free-app revision passes build, lint, 55 unit tests and focused Chrome 153 browser checks. Tested: navbar at 1440/390/320px, centered Ling, local save/reopen/delete, persistent accessibility/language settings, keyboard focus restoration, no language selector in the analysis card, and Filipino/English preferences reaching local reasoning request prompts using recorded responses. The complete offline reload/OCR/edit/rescan/404 suite passes with zero Axe violations across home, Settings, Settings with larger text, OCR/recall and photo editor. The production camera/upload/hotspot smoke also passes. No Supabase SDK or public key is present in the application bundle; no account requests occurred. These checks do not establish model language fluency.

The public test checks the current free-app workflow and is reproducible with `node scripts/run-browser-check.mjs validate-hosted`.

- Dashboard redesign: the supplied reference informs the central camera, Ling illustration, soft purple/lime background, supporting cards and retained study example. Real drag-and-drop uses the existing image validation and inference pipeline. `validate-dashboard` checks five viewport widths, keyboard example activation, failed-download retry, file chooser, multi-file/unsupported drop rejection, actual OCR/detection and reduced motion; tested home screens have zero Axe violations. No profile/login or unsupported HEIC recognition was added.
- Judge setup: an isolated source copy with no local environment file completed a fresh `npm ci`, build, lint and all 55 unit tests. Its dev server opened and ran real study-example OCR; the local proxy guard and installed `gemma3:4b` were checked. The documented `npm run test:production` also passed there using only locked dependencies and the installed Chrome browser. This did not rerun a Gemma generation benchmark. README now includes prerequisites, local Ollama setup, browser-only preview, product workflow, offline reproduction and troubleshooting.
- Latest answer/tag refinement: build and lint pass; **55 unit tests** pass. The production main bundle is about 528 KB; a >500 KB chunk warning remains.
- Hosting/offline copy review: build, lint and all 55 unit tests pass again. About and How to distinguish first downloads, local inference, offline preparation and device saves. Dialogs fit 1440/390/320px; the focused browser check reports no page errors and no Axe violations on About/Help. The study example remains available and offline controls remain in Settings.
- `validate-simple-answers` runs real example OCR and object detection. It verifies label editing, exact-tag removal/Undo, fullscreen, photo reset, cancelled stale answers, next-prompt rejection notes, collapsible AI status/evidence/history, save/feedback/Ask again and responsive layouts. The vision worker is simulated for these UI lifecycle checks, not used as evidence of model quality. The answer screen has zero Axe violations in the tested viewport.
- Production smoke: actual four-animal detections, real English OCR, boxes/hotspots at 1280/390/320px; file-backed camera live fullscreen, capture/review/retake and track cleanup; no unexpected external requests, image uploads or page errors.
- Resilience: full offline reload, new-image detection/OCR, uploaded study-note flow, text search/recall/save/revisit, crop/rotate/rescan, HTTP 404 fallback and persisted accessibility preference pass.
- Actual cached SmolVLM image inference and a follow-up completed offline. An overly generic answer was observed and is now rejected by a unit-tested guard. This does not establish consistent answer quality or multilingual accuracy.
- Speech control/lifecycle tests pass with simulated events; actual generated-audio transcription previously failed. Physical microphone use remains unverified and experimental.
- Local Ollama proxy rejection/security checks pass; no new lengthy Gemma benchmark was run. Browser/offline changes do not replace the existing localhost reasoning service.
- Initial downloads need internet. Storage can be evicted. Saved discoveries stay in the same browser; cross-device history is not offered. PWA installation is not implemented. Phone hardware, mobile Safari, real webcam permissions and full screen-reader usability are not established by desktop viewport/headless checks.

For honest public claims and the remaining risk procedure, use the [current risk review](offline-accounts-risk-review.md) and [browser model quality evidence](browser-ai-validation.md). Earlier milestone reports describe older builds. Account acceptance workflows are no longer part of the current demo or deployment requirements.
