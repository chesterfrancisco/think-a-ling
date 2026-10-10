# Think-a-ling: launch-readiness audit and interaction fixes

9 October 2026. Local Windows workspace, Chrome 153.0.8010.55, Edge 154.0.4258.62 for camera checks. This report supersedes the older static step-percentage and overlay-free fullscreen descriptions.

## Assessment

The application performs real local inference and its core interaction flow works. Browser detection/OCR is responsive on the supplied laptop. **Gemma scene understanding is still slow and sometimes factually wrong.** A valid JSON response or a detector confidence score is not an accuracy measurement. Treat this as a functioning, bounded hackathon MVP, not a generally reliable visual assistant or safety assessment product.

No authentication, cloud inference, new model, dependency or telemetry was added. Existing image, camera, detector, OCR, shared-scene, cancellation and loopback services remain in place. A small deterministic OCR source-matching addition improves traceability without rewriting model answers.

## Changes made

- Same-category photo detections now receive consistent display names: **Person 1, Person 2**, Dog 1, Dog 2, etc. Hotspots, discovery cards, chat headings and return buttons agree. Ordinals follow detection order within the current photo; they are not identity recognition or tracking. Original labels, evidence IDs, confidence and boxes remain unchanged. Corrected names retain user provenance.
- Object Ask opens an **empty input** with an example as its placeholder. Nothing is silently submitted from a placeholder. Contextual Learn/Check actions still submit their real instructions; cancelling and retrying those actions works even with an empty question input. Choosing another action after cancellation resets the request state even on the same object; a superseded queued action cannot start after initial scene creation.
- Fullscreen still shows the complete photo. It now preserves markers unless hidden, includes a hide/show control, and returns to the correct object card when a hotspot is selected. The full-window mobile/API-unavailable fallback has the same behavior. No inference is triggered by marker toggling or fullscreen.
- A pending request starts at **0% Estimated progress**, advances with elapsed time, and holds at 95% if necessary. Only an actual schema-validated completion displays 100%. Previous completed request duration informs subsequent estimates of that type; first-use estimates use approximate defaults. Actual object/OCR-ready checkpoints remain separate. No countdown claims to measure generated tokens, certainty or real model completion. Errors/cancellation do not reach 100%. The progress timer is cleared when the request UI unmounts.
- Whole-photo Analyze clears an older object selection so its chat heading does not incorrectly name that object. Exact-object answer/history separation and saved-scene reuse remain intact.
- When a model answer contains a complete OCR evidence line of at least three words, the app shows that **matching source text** inside “What supports this answer?”. Matching ignores case/punctuation. It does not validate meaning, negation, other claims, or OCR correctness. Original model output is retained. This addresses a real audited response that accurately repeated warnings but omitted optional model citation entries.

## Fresh performance observations

These are individual measurements, not percentiles or controlled before/after benchmarks. Browser times include upload decoding and UI readiness; detection and OCR run concurrently. First use includes engine startup in a new browser context, with local disk/OS caches potentially warm. No other benchmark suite ran during the recorded Gemma animal-scene request.

| Operation | Observed time |
| --- | ---: |
| First animal upload: four detector hotspots | 0.629 s |
| First animal upload: OCR complete | 0.612 s |
| Subsequent uploads: detector ready | 0.150–0.190 s |
| Subsequent uploads: OCR ready | 0.150–0.302 s |
| Real Gemma animal scene, UI request to response | 62.379 s |
| Real Gemma study question, saved scene | 67.136 s |
| Real Gemma product-label question, saved scene, repeat audit | 20.943 s |

`ollama ps` reported **100% CPU**, runner `llamacpp`, about 2.9–3.0 GB model allocation. Arc GPU/NPU acceleration was not observed. The animal response reported 62.115 s total runtime, including 5.329 s load, 26.868 s prompt evaluation and 29.874 s generation. The product intent reported 20.892 s total including 4.818 s load. The app uses `keep_alive: 15m`; this does not guarantee zero load overhead. Image and intent requests currently use different context limits, which merits a separate controlled benchmark before changing configuration.

The 62.4 s scene result is similar to the user's earlier 63.45 s example. **No model speedup is claimed from this turn.** The visible estimate improves feedback, not inference speed. An object action without a saved scene can still require an image call plus a text-only call. Later modes/questions reuse the scene without resending the image.

The browser quality run recorded ten main-thread tasks over 50 ms, maximum 176 ms. MediaPipe detection is synchronous; slower/mobile devices could have more noticeable input pauses. Moving it to a worker is a future performance task, not implemented here. Production JS is 468.02 kB / 144.91 kB gzip; local AI assets total 72.8 MiB on disk, including compatibility variants. Each browser loads its selected variants.

## Accuracy findings from actual inputs

Seven distinct local fixtures plus a repeat animal upload were tested. Source images were inspected; these are a small diagnostic set, not a representative accuracy dataset or an mAP/IoU benchmark.

| Input | Actual finding |
| --- | --- |
| Two cats + two dogs | Detector returned two cats and two dogs with real boxes. Gemma's description incorrectly said **three** animals, while listing four entries. It also described the cats' eyes as closed when they are open. Pink background was correct. Schema validation passed despite those factual errors. |
| Portrait | One person and the visible tie detected; 94.9% and 69.0% model confidence. These percentages are not measured accuracy. |
| Blank white image | Zero detections and no readable text, correctly presented as empty. |
| Single desk | Zero detections at the existing 35% threshold despite a visible desk. This is a recognition coverage/miss limitation. |
| Printed invoice/test text | OCR preserved the sentence and invoice/total; the title's `AI` became `Al`: one normalized word error out of 15 reference tokens. |
| Printed study notes | Zero normalized OCR word errors across 22 reference tokens. Gemma incorrectly called the printed notes handwritten. Two cards were proposed; one passed exact OCR answer grounding, one was withheld. “Food” was grounded; “carbon dioxide and oxygen” was withheld because it was not a contiguous OCR quote. This safeguard can reject useful paraphrases. |
| Fictional cleaner label | Zero normalized OCR word errors across 22 reference tokens. The inspected repeat answer correctly included children, bleach and ventilation warnings, but its observation/suggestion citation arrays were empty. It also added “standard precaution” as an uncertainty note, which is not established by the label. |

Word-error measurement is case-insensitive and ignores punctuation/layout; it is not a claim of perfect character recognition. No overall “accuracy rate” is advertised. The detector uses fixed pretrained categories, misses some supported objects, and cannot reliably label every everyday item. User corrections are per-photo assertions, not model retraining. Gemma-only names never receive invented measured coordinates.

Seven fresh Gemma calls were made: study and label scene+intent pairs, a label pair repeated to retain the failing response, and one animal scene. The first live scenario suite failed the label citation assertion. The repeat confirmed the missing citations while preserving an otherwise useful warning answer. **Those original live failures remain recorded.** The new source-text display was verified using that exact recorded answer plus freshly executed OCR; it was not a further live model run. Likewise, the animal integration check passing means transport/schema/display passed, not that its content was accurate.

## Stability, security and privacy

- Build, lint and **37 unit tests** passed. Build verified all 17 local AI assets. No lint warnings.
- Production offline regression passed: cold browser initialization with every external URL blocked; then new uploads with all browser networking disabled after engine initialization. No extra network requests for warmed inference. This does not promise offline page reload or a PWA.
- Chrome and Edge camera tests used real `getUserMedia` with a file-backed input and actual MediaPipe predictions. Throttling, source switch, Capture, Stop, upload switch and page-hide track cleanup passed. Capture passed actual frozen bytes to one intentionally failing test endpoint; live frames did not call Gemma. This is not a new physical-camera test on a phone/laptop camera.
- Missing model, unavailable runtime, invalid/truncated JSON, cancellation, retry and 180-second timeout checks passed. Existing image replacement, correction, same-name object separation and stale-request suppression checks passed.
- Nine local bridge checks passed: missing app header, foreign/opaque Origin, unexpected Host, wrong content type, unsupported method/path/query, and absence of a production preview proxy. Current listeners were `::1:5173`, `127.0.0.1:4173`, `127.0.0.1:11434`; no public Ollama listener was observed.
- `npm audit --json` and `npm audit --omit=dev --json` both reported **zero known vulnerabilities** on this date. This is registry coverage, not proof of no vulnerabilities.
- Browser suites reported no external requests/uploads or uncaught page errors. Uploaded images remain browser-local except the explicitly local Ollama image request. The same-origin connection policy is retained, including blocking MediaPipe's external metrics endpoint.
- React renders user/model strings as text; no added raw HTML execution. File type/size/pixel validation and bounded structured model outputs remain. Label/scene text is treated as untrusted data in prompts. Prompt instructions and schema validation cannot guarantee resistance to all semantic prompt injection or hallucinations.
- The loopback bridge is a development tool. It has no per-user authorization, rate limiting or robust local-client isolation. A malicious program already running on the device is outside these browser-origin protections. This was a targeted audit, not a penetration test.

## Ease of use

Verified at 1280/390/320 px: intro skip/replay and keyboard navigation; upload/capture entry; complete-photo aspect ratio; hotspot alignment; responsive cards; marker hide/show; fullscreen/fallback; scroll-to-chat and selected mode; placeholder-only input; saved object answers; Back/reset; accessible errors/retry; and reduced-motion story behavior. The green markers now remain discoverable in fullscreen. A two-copy portrait **test input**, processed by the real detector, confirmed Person 1/Person 2 consistency; it does not test identity recognition.

This is an engineering walkthrough, **not a usability study with ordinary users**. English-only interface/OCR, small secondary text, inference wait times and overlapping hotspots remain concerns for older users or small screens. Next, give three unfamiliar users one photo task each without coaching. Record whether they can choose a photo, identify the next action, correct a label and find their answer; measure completion time and points of hesitation. Include someone using larger text and someone using a phone.

## Simple workflow and differentiation

The free app opens directly, with useful text and evidence saved in the same browser. Keep on-device scanning and reading easy to reach for a hurried user or someone revisiting a label offline. Local Gemma remains available through the separate local development app and Ollama.

For the hackathon, prioritize a memorable complete task rather than expanding the menu:

1. **A label-to-useful-answer demo:** immediate readable text, ask which warnings are actually present, expand the matching source lines. Acknowledge OCR limitations. This shows usefulness, real local AI and auditable output.
2. **A notes-to-study demo:** show one grounded flashcard with its original text and a same-scene follow-up. Show withheld unsupported output honestly, not as a successful extra card.
3. **Ling as a trustworthy guide:** consistent identity, ordinary-language goals, correctable labels, privacy and visible uncertainty. Let the correction/update/reuse interaction demonstrate technical execution.

The next engineering investment should be a bounded accuracy suite using real intended-user photos and a controlled runtime/model benchmark, including the actual hardware path. Then consider one offline utility such as a local saved discovery card with an explicit delete control. These are recommendations, not implemented features or a promise of competition ranking.

## Reproduce and inspect

Run `npm run build`, `npm run lint`, `npm run test`. Start the loopback dev server at 5173, production preview at 4173 and local Ollama for live tests. Browser scripts accept the available Playwright `index.mjs` path through `scripts/run-browser-check.mjs`; no Playwright runtime dependency was added.

Fresh passing browser suites: `audit-browser-quality`, `audit-live-scene` (integration only), `validate-audit-ui`, `validate-label-grounding` (recorded model), `validate-milestone1`, `validate-milestone3`, `validate-object-context`, `validate-discovery-reuse`, `validate-ling-refinement`, `validate-ling-story-navigation`, `validate-reasoning-failures`, `validate-progressive`, plus `validate-interactions.mjs` and `validate-camera.mjs`. All non-live reasoning UI suites explicitly use recorded response replay or intentional failures; they do not measure new model accuracy.

Raw artifacts: `test-results/audit-browser-quality.json`, `audit-live-scene.json`, `shared-scenarios-audit-first.json`, `validate-shared-scenarios.json` (repeat label failure), `security-audit.json`, and the individual suite reports. Screenshots include `fullscreen-markers-mobile.png`, `estimated-progress-audit.png`, `label-text-matches.png`, `live-scene-audit.png` and responsive discovery images. Source fixture provenance is in `test-images/README.md` and the replay fixture metadata.

Main changed files: `App.tsx`, `ImagePreview.tsx`, `ObjectCard.tsx`, `ReasoningPanel.tsx`, `AnalysisProgress.tsx`, `SimpleExperience.css`, `services/objectNames.ts`, `analysisProgress.ts`, `intent.ts`, `types/scene.ts`, and the audit/regression scripts. No deployed-site infrastructure changes were made.

**Deployment remains limited:** public production builds run browser detection/OCR only. Local Gemma currently requires the local development app and Ollama. Browser Offline mode blocks even localhost HTTP reasoning, while disconnecting the internet alone can still leave localhost reachable. No public tunnel or shared laptop endpoint was introduced.
