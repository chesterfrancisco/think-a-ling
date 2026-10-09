# Everyday experience and responsiveness

Validated 9 October 2026 on the existing Windows laptop. This iteration changes presentation and orchestration, not the MediaPipe, Tesseract or shared-scene engines. No new dependencies, model, cloud service or public Ollama bridge was introduced.

## What changed

- Camera/photo first landing page, warm background, lime/lilac branding, locally hosted fonts, larger controls and readable mobile layouts. Decorative brand artwork is CSS/SVG, not a simulated camera view or AI result.
- No timed splash screen. Upload immediately starts real detection and OCR concurrently. Each result appears independently, with measured elapsed time. Users can inspect hotspots before deep reasoning completes.
- Browser engines remain warm across images. The scene builder consumes completed results instead of repeating them. Upload does not automatically invoke Gemma; Capture retains its existing one-image scene workflow.
- A plain-language question can be entered before scene creation. The scene interpretation appears as soon as it is ready, while an optional goal response continues. Subsequent modes and questions reuse that same scene.
- Answers appear before the question form and technical details. Evidence, confidence, uncertainty and original JSON remain available through disclosures. Explicit model-prediction warnings remain visible.
- Quick-scan cancellation ignores late results from cancelled work and permits retry. Home clears the current image and scene, cancels in-flight work, and stops camera tracks. Per-request elapsed time resets when switching from scene analysis to intent reasoning.
- Public builds explicitly say deeper answers require the local app. Help explains the privacy and deployment boundary.

Main files: `src/App.tsx`, `src/Everyday.css`, `src/components/ReasoningPanel.tsx`, `src/services/intent.ts`. Existing cards, camera, exact bounding-box mapping, OCR, schema/evidence validation and local proxy safeguards are retained.

## Measured responsiveness

### Actual Gemma comparison

Two sequential real `gemma3:4b` text-only requests used the same previously recorded animal scene, goal, structured format, temperature 0, context 8192, 1400-token hard limit and 15-minute keep-alive. No fresh image-analysis benchmark was repeated in this iteration.

| Measurement | Previous prompt | Shorter prompt |
| --- | ---: | ---: |
| Wall time | 37.16s | 31.30s |
| Prompt characters | 6,620 | 4,600 |
| Evaluated prompt tokens | 1,748 | 1,172 |
| Prompt evaluation | 18.49s | 13.76s |
| Model loading | 4.07s | 0.01s |
| Generation | 14.57s | 17.40s |
| Output tokens | 168 | 216 |
| Runtime schema validation | Pass | Pass |

The prompt no longer duplicates the schema already supplied through Ollama's structured `format`; it requests a short answer and fewer repeated observations/actions. Evidence and safety instructions remain intact. `keep_alive` was already configured and was not a new optimization.

**Interpretation:** wall time decreased by about 16% in this single pair, but roughly four seconds of the difference came from model loading. Excluding loading, the difference is approximately 5%. This is not an isolated causal benchmark, a latency guarantee, or proof of improved accuracy. Both `/api/ps` snapshots reported `size_vram: 0`; no Intel Arc or NPU acceleration is claimed.

The earlier 63.45s scene plus 51.2s object-action measurement is still relevant: the first object action can still require two sequential model requests. This iteration exposes browser results and the completed scene earlier; it does not make Gemma instantaneous or eliminate those two requests. The original image-analysis time was not remeasured.

Reproduce with `node scripts/benchmark-responsive.mjs <playwright/index.mjs>`. Raw results: `test-results/responsive-benchmark.json`. The script reconstructs the former prompt for subsequent comparisons. Ollama behavior references: [Chat API](https://docs.ollama.com/api/chat), [processor and keep-alive documentation](https://docs.ollama.com/faq).

### Actual automatic browser inference

Measured from file selection until the corresponding result appeared, with prepared assets served on localhost and no competing benchmark:

| Image | Object results | OCR results |
| --- | ---: | ---: |
| Animals, fresh page/engines | 0.55s, four predictions | 0.53s, no readable text |
| English OCR fixture, warm engines | 0.16s | 0.20s, expected invoice text |
| Desk, warm engines | 0.15s | 0.15s |

These are individual laptop runs with browser polling overhead, not population benchmarks. A public cold asset download, mobile processor, larger image or difficult text can take longer. Raw report: `test-results/validate-progressive.json`.

## Validation performed

- `npm run build`: passed, including hashes/versions of all 17 local inference assets.
- `npm run lint`: passed.
- `npm run test`: 26 passed; camera lifecycle, object identity/actions, schema, evidence, OCR-grounded study answers and Find affordance gate.
- Milestone 1 browser regression: passed with real inference, four animal boxes, OCR fixture text, responsive coordinates, empty/invalid uploads, asset failure/recovery and worker cleanup. External network blocked during cold initialization. Full browser offline mode after initialization accepted new images with zero further requests. Offline reload remains unsupported.
- Interaction regression: passed at 1280/390/320px, exact box-relative hotspot alignment, full image aspect ratio, contextual cards, collapsed confidence, Escape/focus restoration, one real person prediction and blank-image empty state.
- Milestone 3 UI and saved-answer reuse suites: passed using **recorded model HTTP replay**, with actual browser detection/OCR. Verify all four modes, one image request followed by text-only intent requests, same-name object separation, source/scene reset, cancellation, retry and responsive cards. These tests are not fresh Gemma accuracy evaluations.
- Progressive UI suite: passed. Real automatic results require no Gemma request; a recorded scene is visible during a held text-only answer; local results remain accessible. Question-before-analysis, cancellation, home reset, held-model initialization cancellation and actual detection retry passed.
- Reasoning failure suite: passed for unavailable server/model, malformed/invalid/truncated JSON, cancellation, simulated 180-second timeout and retry.
- Chrome 153 and Edge 154 camera suites: passed using **file-backed camera input with real MediaPipe inference**. Verified throttling, aspect/boxes, source switching, track cleanup and captured JPEG delivery to the scene pipeline. No continuous video Gemma requests. Capture's model boundary intentionally returned HTTP 503; it was not a fake successful response. Physical-camera access was not revalidated; previous automatic physical-camera attempts were denied.
- Security checks: missing app header and foreign Origin rejected with 403; wrong method and other Ollama paths rejected with 405; production preview POST to the bridge returned 404. Browser suites observed zero external requests. Same-origin CSP and loopback-only proxy remain unchanged. This is regression coverage, not a penetration-test certification.

Browser regression selectors were updated for the intentional removal of splash/automatic drawer opening. Missing-language tests explicitly release the now automatically warmed OCR worker before exercising initialization failure.

Screenshots: `test-results/everyday-home-1280.png`, `everyday-home-390.png`, `everyday-home-320.png`, `everyday-auto-detection.png`, `interactions-card-390.png`, `discovery-saved-answer-390.png`. Saved-answer screenshots use clearly documented recorded-response replay.

## Accuracy and deployment boundaries

Schema validity is not factual correctness. Actual Gemma responses in the comparison still inherited incorrect positions from the saved scene; the baseline also contradicted its own animal count. Responses were not edited to disguise these mistakes. No general accuracy percentage or safety/medical reliability is claimed. MediaPipe retains its 35% threshold and limited trained categories; OCR supports English print and can misread small/blurred text.

The public static application provides genuinely browser-local object detection and OCR. Full Explore/Find/Fix/Improve interpretation uses Ollama in the local development app on the user's computer. A deployed Vercel website does not get access to the developer's laptop; no tunneling, remote fallback, wildcard CORS or public binding was added. A visitor-installable local runtime/browser reasoning model is still a separate, unfinished distribution feature.

## Submission and demo

Use the working laptop-local app for the complete demo. Show an upload, immediate boxes/text, a contextual object action, the first scene interpretation, and a follow-up reusing the scene. Describe public browser features separately. For a short video, disclose any time cut during Gemma generation instead of implying instant answers; the visible elapsed timer remains truthful.

Useful framing for the judging criteria: everyday labels/photos/spaces (usefulness), real browser and laptop inference (local AI), validated shared evidence and reusable scene (execution), object-specific goals over one visual context (innovation), and a clear camera-first responsive flow (product/demo). These are implemented capabilities, not a claim about the judges' score.

Remaining launch limits: CPU Gemma latency; model miscounts/misinterpretations; physical camera permissions; English-only OCR; no public Gemma runtime; no offline page reload. The UI/perceived-latency work stops here rather than adding an untested replacement model before submission.
