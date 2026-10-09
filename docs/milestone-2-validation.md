# Milestone 2 validation — shared scene and intent MVP

Date: 2026-10-09 (Asia/Singapore).

## Implemented and preserved

One shared scene combines real MediaPipe detections, unchanged bounding boxes, actual OCR, and one Gemma image analysis. Explore, Find, Fix and Improve then answer user goals from that scene and recent same-scene conversation, without repeating image inference. Evidence retains its source and observed/inferred status. Gemma-only objects have no coordinates.

The Milestone 1 inference services, preview component, local assets and regression script were preserved. The minimal UI adds shared-scene building, goals, follow-ups, evidence, OCR-backed study cards, cancellation, retry and errors. No runtime dependencies, cloud inference, public Ollama listener or Milestone 3 redesign were added.

## Actual model and workflow tests

The installed local model was `gemma3:4b` (3.9B, Q4_K_M, vision capability). Ollama listened on 127.0.0.1:11434 and Vite on ::1:5173. Ollama reported zero VRAM allocation during testing: these are CPU observations, not an Intel Arc/NPU benchmark.

`scripts/validate-milestone2.js` used the actual desk image, browser detector and OCR, and real local Gemma responses. The desk produced no MediaPipe detections above threshold and no OCR text; these empty outputs were retained honestly. Gemma described the desk, its surface, legs and two holes.

| Workspace operation | Observed wall time |
| --- | --- |
| Shared scene: detection + OCR + Gemma image analysis | 118.0s (Gemma 117.0s) |
| EXPLORE: uses for study | 63.2s |
| FIND: help with writing notes | 66.7s |
| FIX: visible problems and checks | 92.6s |
| IMPROVE: better use for focused study | 52.1s |

The network trace contained exactly one image request followed by four text-only requests. The scene ID stayed unchanged and follow-up prompts included prior conversation. All external browser URLs were blocked throughout; zero external requests and zero uncaught page errors were observed.

Actual responses suggested possible desk use and organizing study materials. FIND gave a brief desk-use answer without structured suggestions. FIX returned zero issues; the UI explicitly says this does not certify safety. These are real model outputs, including their weak points, not demo answers.

`scripts/validate-shared-scenarios.js` additionally used locally created printed study notes and a fictional cleaner label. Both images ran actual detection, OCR and Gemma image analysis, followed by a text-only goal. OCR read all fixture lines correctly. The request pattern was image, text, image, text. The final study-card check verifies that displayed citations contain each displayed answer; the raw model JSON remains available unchanged.

| Final scenario run | Shared scene wall time | Goal response wall time |
| --- | --- | --- |
| study-notes.png | 54.8s | 49.9s |
| product-label.png | 60.1s | 131.9s |

These are observed runs with an installed model and varying prompt caches, not guaranteed latency or a cold-start benchmark. The four-mode workspace test preceded the final study-card citation check; the final study/label run exercised that check and the narrowed observed-evidence schema.

## Errors and quality limitations observed

- In an earlier study run, Gemma copied correct answers but cited the wrong OCR lines. The implementation now independently matches normalized answer text to OCR, corrects display citations with a notice, and withholds unmatched cards. Tests verify that the original response is not altered.
- Matching answer text does not establish educational correctness. In the final study run, a card used a statement as its question, and an explanatory observation called carbon-dioxide intake/oxygen release “plant respiration.” The fixture discusses photosynthesis. This is an observed model error; explanations and question wording still require review.
- The label scene incorrectly described the white background as black in both the earlier and final runs. The final label intent correctly identified and cited the printed child-access, bleach-mixing and ventilation warnings. No unsupported medical claim was observed in that response. The final goal took 131.9 seconds, versus 45.9 seconds in the earlier run, demonstrating substantial latency variation.
- Workspace answers were sometimes generic and did not fully address every part of a goal. An earlier study response returned three cards when asked for two.
- Uncertainty arrays were sometimes empty despite mistakes. The UI displays a caveat even when the model supplies no uncertainty.
- JSON validation checks structure, limits and existing evidence IDs. It does not prove visual truth, relevance of general citations, correct relationships, or safety. Only study-card answers receive the additional OCR phrase check.
- No known-defect image benchmark was run. FIX was exercised on the desk with zero reported issues; this does not establish defect-detection accuracy.

## Build, regression and failure checks

Passed on the final implementation:

- `npm run build`: all 17 local asset hashes/versions verified, TypeScript and Vite production build passed.
- `npm run lint`.
- `npm run test:reasoning`: 17 tests for response schemas, empty results, missing evidence, unsupported coordinates, mode constraints, exact box preservation, source provenance, same-scene history, partial failures and study-card grounding.
- Unchanged `scripts/validate-milestone1.js` against the final production build: four actual animal detections, OCR, blank/corrupt/unsupported uploads, model/language failure recovery, engine disposal/reinitialization and responsive box alignment at 1280px/390px.
- Milestone 1 cold initialization with all external requests blocked, plus new uploads and both engines in full browser offline mode after initialization. Warm offline inference caused zero additional network requests.
- `scripts/validate-reasoning-failures.js`: missing model (404), unavailable engine (503), malformed JSON, schema failure, incomplete generation, cancellation and retry, and the 180-second timeout using an advanced test clock.
- Error tests inject failures only; the functional suites use real model responses.

Proxy/access checks also passed during development: missing application header and foreign Origin returned 403; non-chat endpoint returned 405; public Vite binding was rejected; production preview returned 404 for the proxy POST. The fixed target and listeners remained loopback-only. A real request cancellation was also observed in the initial transport test; Ollama logged the cancelled task, then subsequent inference succeeded.

Automation used installed Chrome 153.0.8010.55 with an existing Playwright installation; no browser-testing dependency was added. Current raw reports and screenshots are in ignored `test-results/`:

- `validate-milestone1.json`
- `validate-milestone2.json`
- `validate-shared-scenarios.json`
- `validate-reasoning-failures.json`
- `shared-scene-workspace.png`, `study-notes.png-shared.png`, `product-label.png-shared.png`

Other earlier artifacts may describe the superseded per-image mode prototype; the shared-scene reports above are the relevant workflow results.

## Deployment, offline claims and next steps

Reasoning requires the local development app and local Ollama. Production reasoning is disabled. A public website cannot automatically use the developer's localhost model. This is browser-local detection/OCR plus a separate on-device Ollama process, not fully browser-local Gemma inference.

External browser requests were blocked during the workspace run; physical Wi-Fi disconnection was not performed. Full browser Offline blocks localhost too and therefore prevents new Ollama calls. Previously initialized detection/OCR continue to work under full browser Offline as verified. No PWA/offline reload support is claimed.

Images are copied to JPEG at a maximum 1280px longest edge for Gemma, while original images/boxes remain intact. OCR reasoning is capped at 4000 characters and 30 evidence lines. Follow-ups cannot inspect details omitted from the cached scene. Only three recent same-scene turns enter each prompt; twelve are retained in the UI.

This is a functional uploaded-image MVP with a small fixture set, one browser and one local model. Future work should evaluate richer scenes and evidence accuracy, improve goal-response quality and latency, and design local distribution separately from public hosting. The next UI milestone can integrate Figma Make with these reusable services. Milestone 3 and camera input were not started.

Setup, architecture and reproduction commands: [Milestone 2 guide](milestone-2.md).
