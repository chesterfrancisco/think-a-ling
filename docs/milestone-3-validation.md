# Milestone 3 — implementation and validation

Date: 2026-10-09. Target: `C:\xampp\htdocs\thing-a-ling`. Source export: `C:\xampp\htdocs\thing-a-ling-figma` (read only).

## Delivered

The working application now uses the Figma Make brand mark, ink/lime/lilac tokens, local DM Sans/Manrope typography, viewfinder, glass toolbar, lime shutter, four-mode navigation, desktop result sheet and phone bottom sheet. It reuses the supplied CSS and branding with integration overrides rather than replacing the AI engine. No runtime dependency or router was added.

Uploads retain the original image and native dimensions. Real MediaPipe boxes/confidence stay aligned with it; their labels are now keyboard-accessible buttons that prefill an object question. Gemma-only objects still have no precise coordinates. Independent detection, OCR, exact recognized text, errors, retries and resource release remain available in supporting cards below the viewfinder.

Explore, Find, Fix and Improve control the same existing scene. The goal field supports Enter submission, suggested goal prefills and follow-ups. Closing/reopening the sheet retains the scene and conversation. Uploading another image cancels the old request and resets its results. Changing modes cancels an in-flight intent and retains the scene. Loading messages, elapsed time, cancellation, retry, zero issues, partial results, uncertainty, provenance, OCR-checked cards and raw JSON remain available.

Help uses a native modal dialog with keyboard dismissal/focus restoration. Fullscreen enters/exits through the image toolbar. All fonts are local, with their OFL licenses. No remote room image, Google Fonts runtime import, browser speech API, new telemetry or cloud inference is used.

## Files

| File(s) | Integration |
| --- | --- |
| `src/App.tsx` | Figma shell, upload/viewfinder, external mode navigation, sheet visibility, object questions, help/fullscreen, original browser-engine controls |
| `src/components/Brand.tsx` | Brand SVG/wordmark reused from the export |
| `src/components/ReasoningPanel.tsx` | Existing scene lifecycle adapted to the new sheet, externally selected mode, question prefill, form submission and goal chips; validated results retained |
| `src/components/ImagePreview.tsx` | Original image/box mapping retained; labels made tappable for questions |
| `src/styles/figma.css` | Exported design stylesheet, with remote imports removed |
| `src/styles/fonts.css`, `public/fonts/` | Locally hosted font faces/files and licenses |
| `src/App.css`, `src/index.css` | Desktop/mobile integration overrides, evidence cards, forms and accessibility |
| `index.html` | Updated title/theme color; existing connection CSP retained |
| `scripts/validate-milestone3.js`, `scripts/fixtures/milestone2-ui-replay.json` | Fast UI regression using recorded M2 data at the HTTP boundary, never imported by app code |
| `scripts/validate-milestone1.js` | Two selector changes scope `svg rect` to `.image-preview svg rect`; all original inference/offline/assertion checks retained |

SHA-256 comparison found **zero changes across all 12 existing service/type files**. The build verified all 17 original AI assets against their existing manifest. The Ollama transport, prompts, schema/evidence validation, MediaPipe/Tesseract implementations and Vite proxy were not rewritten or modified in this milestone. Existing uncommitted changes from prior milestones were retained.

## Actual validation

Passed on the final build:

- `npm run build`: asset integrity, TypeScript and Vite. Bundle approximately 423 kB JS / 44 kB CSS before gzip.
- `npm run lint`: no warnings or errors.
- `npm run test:reasoning`: 17/17 existing schema, fusion, provenance, same-scene history and grounding tests.
- `validate-milestone1`: real EfficientDet detections and Tesseract OCR; four animal boxes; 1280px/390px box coordinate alignment; unsupported/corrupt/blank uploads; missing model/language errors and recovery; engine disposal/reinitialization.
- Milestone 1 cold initialization with all external URLs blocked and warm full-browser-offline inference on new uploads. **Zero warm-offline requests**, zero external requests and zero page errors. Physical Wi-Fi disconnection was not performed.
- `validate-reasoning-failures`: model 404, unavailable engine 503, invalid JSON/schema, incomplete generation, cancellation, retry and 180-second timeout with an advanced test clock.
- `validate-milestone3`: desktop and 390px/320px phone layouts, no horizontal overflow, help/Escape/focus restoration, actual fullscreen enter/exit, uploads, actual four-object detection, tappable box labels, all four modes, form submission, retained history, scene identity, evidence, zero issues, cancellation/retry, mode-switch cancellation and new-image stale-result prevention.
- The UI suite observed **one image request followed by four text-only mode requests** before its failure/cancellation cases. It checked actual JPEG bytes in the request and the existing same-scene follow-up prompt. Zero external requests and zero page errors were observed.

Browser: installed Chrome 153.0.8010.55 via an existing Playwright installation. No Playwright dependency was added to the app.

**Gemma test boundary:** Milestone 3 deliberately did not run another multi-minute live Gemma benchmark. The new browser UI suite replays captured Milestone 2 intent responses and a scene projection reconstructed from the actual recorded desk scene, at the HTTP boundary. It verifies UI behavior and payload wiring, not fresh inference correctness or latency. Detection/OCR ran for real. No replay answers are present in the runtime application. Real Gemma inference/latency and known model mistakes remain documented in [Milestone 2 validation](milestone-2-validation.md).

Reports and inspected screenshots are in ignored `test-results/`: `validate-milestone1.json`, `validate-reasoning-failures.json`, `validate-milestone3.json`, `milestone3-desktop-empty.png`, `milestone3-desktop-result.png`, `milestone3-mobile-390-sheet.png`, `milestone3-mobile-320-sheet.png` and `milestone3-mobile-boxes.png`. Fast replay timings visible in these screenshots are not inference benchmarks.

## Deliberate adaptations and remaining gaps

- The source is a downloaded interactive prototype, not a supplied Figma file/node URL. Visual implementation was based on its actual React/CSS source. No live Figma file was fetched or modified.
- The empty state uses the supplied branding rather than a remote stock room that could be mistaken for the user's scene. Uploaded images are contained, not cropped/panned, to preserve real box alignment.
- Mobile retains the viewfinder/sheet/navigation, but allows page scrolling to the independent detection/OCR controls; it does not lock the entire page to one viewport.
- Prototype timer-based scanning, fixed hotspots, made-up counts/defects/severity, medical/safety-like claims, fake spatial arrows and canned recommendations were removed from the application workflow. Every returned AI result comes through the working services.
- Camera, voice, persistent saved ideas, arbitrary spatial placement guides, a PWA and installable desktop distribution remain deferred. There are no inactive controls advertising them. The shutter opens the scene workspace for explicit analysis; it does not take a camera photo.
- Real inference is still subject to M2 latency and accuracy limits. Valid JSON and valid evidence IDs do not guarantee truth. OCR phrase matching does not establish educational correctness. FIX does not certify safety.
- Browser detection/OCR support verified warm offline inference; offline reload is not implemented. Local Ollama requires reachable loopback networking and an installed model. DevTools Offline blocks localhost calls too.

## Demo and deployment

For the complete demo, keep Ollama with `gemma3:4b` running on `127.0.0.1:11434`, run `npm run dev`, and open `http://localhost:5173/`. Upload, build the shared scene, then select a mode and ask a goal. Further goals reuse the scene. Close the panel to view/tap original boxes; scroll below for detection and text tools.

The loopback-only, development-only Vite proxy and same-origin safeguards remain intact. Production builds deliberately disable Gemma reasoning and explain why; detection/OCR stay functional. **A publicly hosted website cannot automatically access the developer's laptop-local Ollama.** Do not tunnel Ollama or bind it publicly for the demo.

Reproduce browser checks with development on :5173 and production preview on :4173:

```powershell
npm run build
npm run lint
npm run test:reasoning
node scripts/run-browser-check.mjs validate-milestone1 <path-to-playwright/index.mjs>
node scripts/run-browser-check.mjs validate-reasoning-failures <path-to-playwright/index.mjs>
node scripts/run-browser-check.mjs validate-milestone3 <path-to-playwright/index.mjs>
```

Audit and mapping: [integration plan](milestone-3-integration-plan.md). Next work should focus on real-device demo rehearsal and model response quality; no further milestone was started.
