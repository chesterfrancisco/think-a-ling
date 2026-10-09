# Think-a-ling! — Everyday Action Intelligence

**Point at anything. Know what to do.**

Your world. Full of possibilities. Think-a-ling! helps people discover what they can understand, use, fix and improve using what's already around them. Show Ling a space, an object or some information, then work toward a practical next step. Recognition is limited to supported categories and AI can make mistakes.

Built for the AppBuildersPH Local AI Hackathon 2026. MediaPipe detection and English OCR stay in the browser. Gemma 3 4B reasons through Ollama on the same computer using a loopback-only development proxy. No cloud inference API is used. Public hosting provides detection/OCR; deeper reasoning and Ling Steps require the local app.

**Ling Actions + Ling Steps:** contextual choices reflect the selected object, recognized text and its saved goal. Supported recommendations can become optional checklists with their original evidence and caveats. Ticks mean user-marked completion, never AI-verified physical changes. Checklists stay in memory for the current photo/session. No login or cloud storage. Ling Pockets is not implemented.

See the [product refinement validation](docs/product-experience-validation.md) for actual checks and limitations. GitHub: [chesterfrancisco/think-a-ling](https://github.com/chesterfrancisco/think-a-ling).

## Clone and keep pushing

```powershell
git clone https://github.com/chesterfrancisco/think-a-ling.git
Set-Location think-a-ling
npm.cmd ci
npm.cmd run dev
```

The original Windows workspace can stay at `C:\xampp\htdocs\thing-a-ling`. Its GitHub repository and product name are Think-a-ling!. For later changes, review `git status`, then:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test
git add .
git commit -m "Describe your change"
git push
```

Dependencies, test results, camera recordings, `.env` files and local Vercel settings are ignored. AI assets are intentionally included so a clone can build without downloading model files again.

**Milestone 4 — ready for Vercel:** see the [deployment commands, production smoke results and public-feature limitations](docs/vercel-deployment.md). The public build supports camera/photo detection and OCR, with deeper Gemma actions disabled. `npm run build` verifies all local AI assets before and after copying them to `dist/`. Deployment itself has not been performed.

**Milestone 3:** the Figma Make interface is now integrated, with locally hosted typography, responsive viewfinder/sheets, tappable real detection labels and all four modes connected to the shared scene. See the [integration plan](docs/milestone-3-integration-plan.md) and [actual validation results and remaining gaps](docs/milestone-3-validation.md). The AI services and local-only safeguards are preserved.

**Camera:** Use camera → **Capture photo** → review the frozen image → **Retake photo** or **Analyze photo**. The preview stays visible while the frame is saved. Live MediaPipe detection is throttled; the shared-scene pipeline starts only after explicit Analyze confirmation. See the [latest camera review and splash validation](docs/camera-review-splash-validation.md) and [original camera/performance validation](docs/milestone-3.1-validation.md). `npm run test` runs all unit tests.

**Milestone 3.2:** Real detector hotspots now open the Figma-style object card. Learn, Checks and Better use actions build/reuse the shared scene; Ask opens an editable object-specific goal. See the [interaction map, actual browser/model validation and intentional omissions](docs/figma-interaction-map.md).

**Everyday experience:** camera-first redesign, automatic browser detection/OCR, earlier scene display and a shorter reasoning prompt. See [measured latency, validation, accuracy and deployment limits](docs/everyday-experience-validation.md). No new dependencies.

**Simple discovery + Ling:** the latest interface removes the technical dashboard/JSON, introduces a consistent mascot, leads with the scene description, and provides floating chat plus Back/Change-photo controls. See [current UI validation](docs/simple-discovery-validation.md).

**Ling story and corrections:** the first visit now has a skippable introduction. The description sits inside the photo card with mode choices below it. Detected names can be corrected locally without changing their measured boxes or retraining the model. See [validation, actual model category limits and the live correction test](docs/ling-story-corrections-validation.md).

**Animated Ling + guided modes:** the opening logo animates and the green bar fills automatically, then **Tap anywhere to continue** appears. The splash waits for your tap; the bar is a brand animation, not model-loading progress. Ling first introduces the app, then demonstrates workspace, label, study and concern scenarios. Each mode button scrolls to chat, highlights the selected experience, and offers editable questions from the saved scene. Replay through **Meet Ling again** on the home screen.

**Object conversations + photo controls:** answers and history stay with the exact selected object; switching cancels the old object's pending question while keeping the shared scene. Same-category labels use Person 1/Person 2, etc. Ask opens an empty question field with a placeholder. Fullscreen preserves green markers unless hidden and supports opening the selected card. Progress is a moving, explicitly **estimated** percentage, held below 100 until a validated completion. Confidence is not accuracy. See the [fresh usability, performance, accuracy and security audit](docs/usability-performance-accuracy-audit.md) for measured latency, actual model errors, passing regressions, account advice and deployment limits. The prior static step percentages and marker-free fullscreen have been superseded.

For **EXPLORE, FIND, FIX and IMPROVE**, see [the shared-scene and intent engine](docs/milestone-2.md). Start Ollama with `gemma3:4b`, run `npm run dev`, and choose a photo. Detection and OCR run automatically. Tap a hotspot for Ling Actions, or **Analyze photo**. Once ready, choose **Explore**, **Find**, **Fix** or **Improve**. Floating **Ask This Space** opens chat; **Ask Ling** submits questions and reuses the saved scene. **Turn into steps** makes an optional checklist from supported recommendations already in an answer. Public production builds provide browser detection/OCR only; deeper reasoning and checklists require the local app.

## Run

```powershell
npm ci
npm run setup:ai
npm run build
npm run dev
```

Open http://localhost:5173/. Dependencies and initial asset downloads require internet on a new checkout. The current workspace already contains the prepared assets. `npm run setup:ai` copies matching installed WASM/worker files and downloads the model/language only when missing. Do not run dependency installation during an offline demo.

Upload an image; detection and OCR run automatically. **Scan again** retries detection. **Read text** opens the extracted text, with **Read again** for retry. Engines initialize on first use and are reused. Uploading a new image clears previous results; Back returns to source selection. Leaving the app disposes its resources. The developer-facing resource-release button has been removed.

## Local assets and implementation

| Files | Responsibility |
| --- | --- |
| `src/services/objectDetection.ts` | MediaPipe Tasks Vision, EfficientDet-Lite0 float32 v1, CPU/WASM inference; original-image boxes and confidence scores; lazy initialization/disposal |
| `src/services/ocr.ts`, `ocr.worker.ts` | Tesseract.js LSTM English OCR; progress/errors, two-minute timeout, reusable worker, termination including failed initialization |
| `src/services/image.ts`, `assets.ts` | Local image decoding, validation, object URLs, deployment-base-aware local asset paths |
| `src/components/ImagePreview.tsx` | SVG bounding boxes mapped to native image coordinates with responsive labels |
| `src/App.tsx`, `App.css`, `Everyday.css`, `index.css` | Responsive camera/photo discovery UI, independent progressive results/errors, loading and empty states |
| `public/ai/` | Detection model, MediaPipe WASM, OCR worker/core WASM, compressed English traineddata, asset manifest with SHA-256 hashes |
| `scripts/prepare-ai-assets.mjs`, `check-ai-assets.mjs` | Reproducible asset preparation and build-time integrity/version checks |
| `index.html` | Same-origin connection policy that blocks MediaPipe's external usage-metrics endpoint |
| `scripts/validate-milestone1.js` | Actual browser integration checks, exported as a function accepting a Playwright Page |
| `test-images/` | Original desk image and detection/OCR/blank fixtures |

No runtime dependencies were added. MediaPipe 1.1.0 and Tesseract.js 7.0.0 were already installed. The asset set is about 72.8 MiB on disk (includes browser compatibility variants); each browser loads only the variant it selects. The detection model itself is 13,836,895 bytes. Vite copies `public/ai` into `dist/ai`.

`npm run build` first verifies all 17 files against `public/ai/manifest.json` and checks that installed package versions match the copied runtimes. After changing an AI package, rerun `npm run setup:ai`. A corrupt model/language file should be removed and downloaded again; the script does not silently replace existing model files.

## Test without internet

### Internet disconnected, local server available

1. While online, finish dependency/asset setup and `npm run build`.
2. Start `npm run preview -- --host 127.0.0.1 --port 4173`.
3. Disconnect Wi-Fi/Ethernet while keeping this process running.
4. Open http://127.0.0.1:4173/ in a fresh browser context. Upload `test-images/cats-and-dogs.jpg` and run detection, then upload `test-images/ocr-test.png` and run OCR.
5. Inspect Network in DevTools: inference assets come from 127.0.0.1. No image POST, external inference API, CDN fetch, or external font is required.

**Verified equivalent:** a fresh Chromium context with every external URL blocked before navigating to the production preview completed first-time initialization and both inference tasks. Physical Wi-Fi disconnection was not performed by the agent.

### All browser networking disabled after initialization

1. Open the production preview and run both features once.
2. In DevTools Network, select **Offline**. Keep the page open.
3. Select new images and run both features again.

**Verified:** Playwright `context.setOffline(true)` after both engines initialized; new file selections and both inference tasks passed with **zero additional network requests**.

This does **not** claim offline page reload/PWA installation. No service worker or persistent app-shell cache was added. Reloading with all networking disabled will fail; releasing engines also requires the local server to be reachable for reinitialization. Disconnecting internet alone still permits localhost asset loading.

MediaPipe 1.1.0 attempted POST requests to `https://odml.pa.googleapis.com/v1/log` during the initial audit. The application now blocks external connections through CSP before requests leave the page. A browser console message about blocked metrics is expected; it does not prevent local inference. Keep this policy when integrating future UI or hosting.

## Validation and limits

See [Milestone 1 validation](docs/milestone-1-validation.md) for actual predictions, tests and remaining limits, and [fixture provenance](test-images/README.md).

- Detection: COCO-trained everyday-object categories, minimum confidence 35%, at most 20 results. It will miss objects and can misclassify them. It is not open-vocabulary recognition.
- OCR: English printed text only. Blur, handwriting, small text, rotation and complex layouts reduce accuracy. No text correction or invented completion is applied.
- MediaPipe's single-image detection runs synchronously on the main thread; a short UI pause is possible. OCR runs in a worker. CPU/WASM is selected; Intel Arc/NPU acceleration is not claimed.
- Accepted inputs: JPEG/PNG/WebP/BMP, up to 20 MiB and 25 megapixels. PDFs, animated images and HEIC are outside this milestone.
- Verified on Chromium 153.0.8010.55 through Playwright, not across every browser or as a hardware benchmark.

Milestone 2 implements Explore, Find, Fix and Improve through one shared scene, with goal-based follow-ups using local Ollama. Milestone 3 connects these features to the supplied Figma Make UI. Original inference services and regression checks are preserved; box selectors in the M1 browser suite are scoped to the image overlay to exclude new SVG icons. See [Milestone 2 validation](docs/milestone-2-validation.md) for measured inference latency and model limitations.

## Upstream references

- [MediaPipe object detection web guide](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector/web_js)
- [Tesseract.js local installation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md)
- [MediaPipe source and Apache-2.0 license](https://github.com/google-ai-edge/mediapipe)
- [English language data package](https://github.com/naptha/tessdata)
- Exact downloaded URLs and hashes: `public/ai/manifest.json`. Tesseract runtime license copies are included under `public/ai/tesseract/`.
