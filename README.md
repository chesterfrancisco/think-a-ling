# Think-a-ling! — Everyday Action Intelligence

**Point at anything. Know what to do.**

Your world. Full of possibilities. Think-a-ling! helps people discover what they can understand, use, fix and improve using what's already around them. Show Ling a space, an object or some information, then work toward a practical next step. Recognition is limited to supported categories and AI can make mistakes.

Built for the AppBuildersPH Local AI Hackathon 2026. MediaPipe detection and English OCR stay in the browser. Public visitors can optionally enable **experimental SmolVLM browser reasoning**: download about 374 MB of model/runtime files, then analyze on a compatible WebGPU device. Gemma 3 4B still runs through Ollama using the loopback-only development proxy. No cloud inference API is used. Structured recommendations and Ling Steps require the local Gemma app.

**Public Analyze:** choose a photo → **Enable AI to analyze** → **Enable on-device AI** → wait for download and initialization → **Analyze photo**. Follow-ups reuse the saved scene without another image inference. See [actual browser-model results, compatibility and accuracy limits](docs/browser-ai-validation.md). The small model is experimental and can invent details; it is not equivalent to Gemma.

**Ling Actions + Ling Steps:** contextual choices reflect the selected object, recognized text and its saved goal. Supported recommendations can become optional checklists with their original evidence and caveats. Ticks mean user-marked completion, never AI-verified physical changes. Checklists stay in memory for the current photo/session. Relevant modes appear first; the remaining modes stay available under Other ways to explore.

**Ling Pockets:** choose **Save this** on recognized text, a scene summary or an answer; open **Saved** to revisit or delete it. Saves include original evidence and uncertainty, not the original photo. Device storage is limited to this browser and website origin. Optional Supabase accounts support explicit text/evidence sync across devices; nothing is uploaded automatically. Clearing site data deletes device copies. Localhost and the public website have separate device libraries.

**Offline study flow:** open First time? Try a study task, load the included example, read actual OCR, find a keyword, practice verbatim recall and save it. Photo editing provides crop, rotate, flip and tonal controls before rescanning. These tools work with the offline pack; recall practice is not a generated explanation.

**Experimental local voice:** after a scene analysis, use the toolbar microphone icon and opt in to a browser-managed English speech pack, then dictate an editable question. The app requires on-device recognition and never falls back to remote speech. Control/lifecycle checks passed, but the real generated-audio transcription test failed (no-speech/timeout); physical-microphone transcription and Filipino support are not verified. Do not depend on voice for the live demonstration yet. Typing remains available.

See the [current offline/account validation, focused student demo, language limits, risk register and criteria review](docs/offline-accounts-risk-review.md). Real account integration and its database are implemented; live anonymous-denial and invalid-login checks pass. Email delivery, successful real-user sign-in and two-user cross-device history remain acceptance checks. Vercel needs the public Supabase environment variables configured before redeploying.

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

**Vercel:** see the [deployment commands, production smoke results and public-feature limitations](docs/vercel-deployment.md). The public build supports camera/photo detection, OCR and opt-in SmolVLM answers. Gemma remains local-development only. `npm run build` verifies model/runtime assets before and after copying them to `dist/`. A successful local smoke test does not verify the hosted deployment.

**Milestone 3:** the Figma Make interface is now integrated, with locally hosted typography, responsive viewfinder/sheets, tappable real detection labels and all four modes connected to the shared scene. See the [integration plan](docs/milestone-3-integration-plan.md) and [actual validation results and remaining gaps](docs/milestone-3-validation.md). The AI services and local-only safeguards are preserved.

**Camera:** Use camera → **Capture photo** → review the frozen image → **Retake photo** or **Analyze photo**. The preview stays visible while the frame is saved. Live MediaPipe detection is throttled; the shared-scene pipeline starts only after explicit Analyze confirmation. See the [latest camera review and splash validation](docs/camera-review-splash-validation.md) and [original camera/performance validation](docs/milestone-3.1-validation.md). `npm run test` runs all unit tests.

**Milestone 3.2:** Real detector hotspots now open the Figma-style object card. Learn, Checks and Better use actions build/reuse the shared scene; Ask opens an editable object-specific goal. See the [interaction map, actual browser/model validation and intentional omissions](docs/figma-interaction-map.md).

**Everyday experience:** camera-first redesign, automatic browser detection/OCR, earlier scene display and a shorter reasoning prompt. See [measured latency, validation, accuracy and deployment limits](docs/everyday-experience-validation.md). No new dependencies.

**Simple discovery + Ling:** the latest interface removes the technical dashboard/JSON, introduces a consistent mascot, leads with the scene description, and provides floating chat plus Back/Change-photo controls. See [current UI validation](docs/simple-discovery-validation.md).

**Ling story and corrections:** the first visit now has a skippable introduction. The description sits inside the photo card with mode choices below it. Detected names can be corrected locally without changing their measured boxes or retraining the model. See [validation, actual model category limits and the live correction test](docs/ling-story-corrections-validation.md).

**Animated Ling + guided modes:** the opening logo animates and the green bar fills automatically, then **Tap anywhere to continue** appears. The splash waits for your tap; the bar is a brand animation, not model-loading progress. Ling first introduces the app, then demonstrates workspace, label, study and concern scenarios. Each mode button scrolls to chat, highlights the selected experience, and offers editable questions from the saved scene. Replay through **Meet Ling again** on the home screen.

**Object conversations + photo controls:** answers and history stay with the exact selected object; switching cancels the old object's pending question while keeping the shared scene. Same-category labels use Person 1/Person 2, etc. Ask opens an empty question field with a placeholder. Fullscreen preserves green markers unless hidden and supports opening the selected card. Progress is a moving, explicitly **estimated** percentage, held below 100 until a validated completion. Confidence is not accuracy. See the [fresh usability, performance, accuracy and security audit](docs/usability-performance-accuracy-audit.md) for measured latency, actual model errors, passing regressions, account advice and deployment limits. The prior static step percentages and marker-free fullscreen have been superseded.

For **EXPLORE, FIND, FIX and IMPROVE**, see [the shared-scene and intent engine](docs/milestone-2.md). Start Ollama with `gemma3:4b`, run `npm run dev`, and choose a photo. Detection and OCR run automatically. Tap a hotspot for Ling Actions, or **Analyze photo**. Once ready, choose **Explore**, **Find**, **Fix** or **Improve**. Floating **Ask This Space** opens chat; **Ask Ling** submits questions and reuses the saved scene. **Turn into steps** makes an optional checklist from supported recommendations already in a local Gemma answer. Public browser mode offers short experimental answers in the same modes, without validated structured recommendations or checklists.

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
| `index.html` | Connection policy allowing local assets and configured Supabase accounts while blocking MediaPipe's external metrics endpoint |
| `scripts/validate-milestone1.js` | Actual browser integration checks, exported as a function accepting a Playwright Page |
| `test-images/` | Original desk image and detection/OCR/blank fixtures |

MediaPipe 1.1.0 and Tesseract.js 7.0.0 remain unchanged. Their asset set is about 72.8 MiB on disk (includes compatibility variants); each browser loads only the variant it selects. The detection model itself is 13,836,895 bytes. Browser reasoning adds Transformers.js 4.3.1 and about 374 MB of pinned SmolVLM/runtime assets, downloaded only after consent. Vite copies `public/ai` into `dist/ai`.

`npm run build` verifies the 17 detection/OCR assets and the separate `public/ai/browser-reasoning.json` manifest against file sizes, SHA-256 hashes and installed runtime versions. After changing a detection/OCR package, rerun `npm run setup:ai`. Browser model assets are prepared separately with `node scripts/prepare-browser-ai.mjs` (internet required); committed assets normally need no preparation. Large weights are split into parts below GitHub's per-file limit and assembled in the browser's dedicated model cache.

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

**Offline reload is now implemented and tested.** In the production build choose **Use Think-a-ling offline ? Prepare for offline** while connected. Once the approximately 75 MiB app/detection/OCR pack is ready, a full page reload and new-image inference work with browser networking disabled. The optional SmolVLM model needs its separate approximately 374 MB download; real browser reasoning also ran after offline reload. Initial downloads and account actions need internet, and browser storage can be evicted. PWA installation is not implemented. Local development Gemma still requires the local Vite/Ollama processes, but does not require cloud inference.

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
