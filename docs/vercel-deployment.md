# Milestone 4: Vercel deployment

Updated and tested on 2026-10-09, including opt-in browser reasoning. The production artifact is `dist/`, now including approximately 374 MB of optional SmolVLM/runtime assets. These are static downloads, not a server-side AI service. See [real model results and limitations](browser-ai-validation.md). This pass does not verify a live Vercel URL.

## Public feature boundary

| Feature | Public Vercel website | Local development app |
| --- | --- | --- |
| Photo selection, live camera, capture review/retake | Available; camera needs permission and a secure context | Available |
| MediaPipe detection, measured boxes, hotspots, object cards, label corrections | In the visitor's browser | In the browser |
| Tesseract English OCR and reading extracted text | In the visitor's browser | In the browser |
| Short interpretations and follow-up answers | Optional experimental SmolVLM: explicit enable/download, compatible WebGPU device required | Existing Gemma workflow remains the default |
| Gemma scene descriptions, object questions, Explore/Find/Fix/Improve reasoning, text explanation and study prompts | Unavailable; related actions disabled with a local-app explanation | Local Ollama `gemma3:4b` via the guarded Vite proxy |
| Continued detection/OCR without networking | Verified after both engines initialize, while the page remains open | Same browser behavior |
| Offline page reload or installed PWA | Not supported | Not supported |

The public site cannot access the developer's localhost Ollama. Installing Ollama alone does not enable reasoning on this website: the visitor would also need to run the local development application. No tunnel, cloud inference, serverless AI function, account system or alternative backend has been introduced.

## Included configuration

`vercel.json` specifies:

- Framework preset: **Vite**.
- Install command: **`npm ci`**.
- Build command: **`npm run build`**.
- Output directory: **`dist`**.
- Root directory: **this project folder**.
- Node.js: **24.x**, specified in `package.json` and lockfile metadata.
- Environment variables: **none required**. Do not add an Ollama URL, cloud API key or Vercel AI integration.

The app uses React state within `/`, with no URL-based application routes. No catch-all rewrite is needed. Missing model/WASM paths must remain errors rather than returning the HTML application. There is no `/local-ollama` production route.

Configured response headers restrict connections to the same origin, disable form submissions and framing, prevent MIME sniffing, and restrict camera permission to the same origin while disabling microphone/geolocation. The existing HTML connection policy is retained. No cross-origin isolation requirement was added.

These settings follow Vercel's [Vite deployment guide](https://vercel.com/docs/frameworks/frontend/vite), [configuration reference](https://vercel.com/docs/project-configuration/vercel-json) and [supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Verify locally before uploading

PowerShell, from the existing prepared workspace:

```powershell
Set-Location C:\xampp\htdocs\thing-a-ling
npm.cmd run build
npm.cmd run lint
npm.cmd run test
npm.cmd run test:production -- C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
```

The last path points to the Playwright installation used for this validation; on another machine pass its installed `playwright/index.mjs` path. Playwright and Chrome are test tools, not app dependencies. The smoke runner starts and stops its own loopback static server, applies the Vercel headers, and uses the built `dist/` files. It does not need Ollama or call Gemma.

For manual production preview:

```powershell
npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open `http://127.0.0.1:4173/`. If this preview is already running, use the existing process. Vite preview does not apply `vercel.json` headers; the smoke runner above explicitly tests them.

On a fresh checkout, run `npm.cmd ci` first. Keep `public/ai/`, `public/fonts/` and `package-lock.json` included in the source. `npm run build` verifies all 17 source assets before compiling and verifies every copied asset in `dist/ai/` afterward, including package versions, byte counts and SHA-256 hashes. A missing asset fails the build instead of falling back to a CDN. The current assets are already prepared; `npm.cmd run setup:ai` is only needed when setting up missing assets or refreshing them after an AI package change, and may need internet.

## Publish from this workspace

Run these commands yourself when ready to publish. They need internet and your Vercel account:

```powershell
Set-Location C:\xampp\htdocs\thing-a-ling
npx.cmd --yes vercel@latest login
npx.cmd --yes vercel@latest --prod
```

Select your intended Vercel account/team, link the existing project or create `think-a-ling`, and use `./` as the project directory. Keep the settings above. Run from the source folder, not from `dist`; Vercel will install from the lockfile, run the verified build and serve only the output. The `--prod` command publishes the site. CLI behavior is documented in [Vercel deploy](https://vercel.com/docs/cli/deploy).

`.vercelignore` allows only app source, public assets, TypeScript/build configuration, package files and the build-time asset checker. Test images, camera recordings, reports, local credentials and documentation are excluded from the CLI upload. `.vercel/` is gitignored. See [Vercel's exclusion-file documentation](https://vercel.com/docs/deployments/vercel-ignore).

Alternatively, import a Git repository in Vercel and use the same settings. This workspace contains uncommitted changes and new AI assets: a Git deployment will only include files actually committed and pushed. `.vercelignore` is not a substitute for reviewing what is in a Git repository.

## Check the resulting HTTPS URL

1. Open the published URL in a fresh browser. Let the splash complete, then continue. Confirm that browser reasoning is presented as optional and experimental.
2. Select a clear photo with supported objects. Wait for recognition, tap a green hotspot, and inspect the object card. Reasoning actions are disabled until on-device AI is enabled. Hide/show markers and try a narrow mobile viewport.
3. Select a printed-text photo, choose **Read text**, and inspect the actual text. **Explain this text** is disabled until on-device AI is ready. Structured study cards still require the local Gemma app.
4. Open the camera, allow access, capture, review, retake, then confirm **Analyze photo**. Detection and OCR should complete without a Gemma loading state. Back should release camera tracks.
5. Inspect Network: worker, language and model requests should be same-origin and successful; `.wasm` responses should have `application/wasm`. There should be no photo/API POST or call to localhost/Ollama. Do not configure `Content-Encoding: gzip` manually for the compressed OCR language file.
6. After detection and OCR initialize, disable networking without reloading and select another photo. Inference should continue. Re-enable networking before refreshing the page.
7. Choose **Enable AI to analyze**, then **Enable on-device AI**. Model files should start downloading only after this explicit consent. Wait for **On-device AI ready**, choose **Analyze photo**, then ask a follow-up. Check actual generated answers against the photo; the small model can invent details. Test cancel/retry and **Remove downloaded model**. On unsupported WebGPU devices, detection and OCR must remain usable.

For a public submission, check the project's deployment protection settings so intended reviewers can access the final production URL. This has not been changed or verified by this preparation task.

## Actual validation results

| Check | Result |
| --- | --- |
| Production build | Passed; source/output integrity checks for detection/OCR and optional browser model/runtime assets |
| Lint | Passed |
| Unit tests | 44 passed, 0 failed |
| Production smoke with configured response headers | Passed on Chrome 153.0.8010.55 |
| Detection | Actual four detections: Dog 1, Cat 1, Dog 2, Cat 2; real boxes/hotspots at 1280/390/320px |
| OCR | Actual recognition included `Read this text without internet.` and `Invoice 12345 Total 250.00` |
| Camera | Real browser getUserMedia API with a file-backed camera; live detection, capture/review, retake, confirmation and track cleanup passed |
| Public reasoning | Opt-in real SmolVLM image answer and text-only follow-up passed; unsupported-device, download failure, retry/cancel and cache removal checks passed |
| Network/privacy | Zero external requests, image/API POSTs or page errors during smoke interactions |
| Offline inference | New images processed after initialization with all browser networking disabled |
| Existing Milestone 1 production regressions | Passed, including missing-asset failures/retry, blank/corrupt uploads, disposal/reinitialization and offline inference |
| Local development proxy guard | Passed all eight rejection checks; preview endpoint returned 404; no generation requested |

The latest smoke's cold detection-plus-OCR measurement was 574 ms on this laptop over loopback, after local asset checks. This is not an internet download or mobile-device benchmark. Detection/OCR assets total 72.8 MiB, including compatibility variants. Optional browser reasoning adds approximately 374 MB, fetched after explicit consent; first image analysis took 38.84 seconds in the production browser test. See the separate validation report for quality failures and scope limits.

Machine-readable evidence and screenshots are in `test-results/production-smoke.json`, `production-object-mobile.png`, `production-ocr.png`, `validate-milestone1.json` and `security-audit.json`. They are local artifacts, excluded from deployment.

## Remaining limits

- No public Vercel URL, Vercel-hosted build, CDN headers or deployment protection was tested; complete the HTTPS checks after publishing.
- This pass did not retest a physical webcam, mobile Safari or every browser. File-backed camera tests do not establish hardware permission behavior.
- Compatible public visitors can opt into experimental SmolVLM summaries and conversations. Gemma and evidence-validated structured recommendations, Ling Steps and study cards remain in the local development app. No equivalent-quality claim is made.
- Detection can miss or mislabel objects; OCR can misread text. Confidence is not an accuracy rate, and correcting a label does not retrain the model.
- There is no offline reload/PWA cache. First-time page/model loading needs internet. Photos remain on the device; Vercel still receives normal website/asset requests and associated hosting metadata.
- Existing local Gemma performance and limitations are unchanged; no new long benchmark was run.
