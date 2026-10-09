# Milestone 3.1 — camera, performance and interaction validation

Date: 2026-10-09 (Philippine time). Work began around 5:55 PM, ahead of the 11 PM deadline. No redesign, model replacement, new dependency, authentication, database or public Ollama listener was introduced.

## Live camera implementation

- The Figma camera prototype was inspected previously: it provided getUserMedia preview but used timer-based fake scanning/results. The integrated app now has a separate `LiveCamera` component using the existing MediaPipe service and Figma viewfinder styling, without that prototype logic.
- `src/services/camera.ts` owns permission requests, video-only constraints, front/rear preferences, exact device selection, stream cleanup and lossless PNG capture. A generation guard stops even a stream granted after its request has been abandoned.
- `src/components/LiveCamera.tsx` provides actual getUserMedia preview, available-device selection, capture, real boxes/confidences, status, pause/resume/retry and error messages. No microphone is requested.
- Detection samples an aspect-preserving canvas up to 960px on the longest edge, using the same EfficientDet model. It schedules the next sample **750ms after the previous inference finishes**, never overlaps requests and never runs on every video frame. The existing detector was extended only to accept canvas input in addition to images.
- Video and SVG share a fitted rectangle and the sampled native-coordinate viewBox. Preview is explicitly unmirrored; boxes may lag a moving subject between samples. The original image preview/box mapping remains intact.
- Capture draws the current native-resolution frame, stops tracks/detection, decodes the PNG through the existing image service and automatically starts the existing shared-scene pipeline once. Detection/OCR rerun on the frozen image; potentially stale live boxes are not reused. Gemma never receives a continuous video stream.
- Live labels are tappable: tapping captures the frame and prefills a question about that label. Frozen-image labels retain the existing question workflow. Shared-scene object entries now offer Uses, Checks and Better use actions tied to actual object/evidence IDs, without assuming different models identified the same physical object.
- Tracks and detector resources stop on capture, close, upload/source switch, camera selection change, page hide, hidden tab and unmount. Returning to a paused camera requires Resume. Permission denied, absent/busy devices, constraints, insecure contexts and unsupported browsers have actionable messages.
- The development build automatically runs Gemma after Capture. A production build captures successfully and retains browser detection/OCR, but still disables Gemma reasoning and explains the local-service requirement.

The first browser run caught an automatic-capture startup request aborted by React StrictMode's development mount/cleanup probe. Scheduling the once-only request after that probe fixed it; both browser camera suites then passed.

## Measured Gemma performance

Real `gemma3:4b` requests used the existing animal image, temperature 0, 4096 context tokens and the same JSON schema. No detections or responses were fabricated. In this isolated performance test, supporting detection/OCR context was explicitly `null`; the full capture integration separately runs the browser engines.

`ollama ps` reported **100% CPU**. `/api/ps` reported **size_vram = 0**, with approximately 2.9 GB model allocation. The laptop has Intel Arc integrated graphics, but GPU/NPU acceleration was not observed or assumed. No drivers/backend changes were attempted before launch.

| Sequential case | Max image edge | Prompt chars | Output ceiling | keep_alive | Wall time | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| Original baseline | 1280 | 4030 | 1400 | 5m | 73.36s | Valid schema; 507 output tokens |
| Smaller image only | 640 | 4030 | 1400 | 5m | 76.85s | Valid; no speed benefit |
| Aggressively shortened prompt | 640 | 814 | 1400 | 5m | 125.55s | Valid JSON but invented an “Animal Arrangement” issue; rejected |
| Same aggressive prompt, lower ceiling | 640 | 814 | 700 | 5m | 45.62s | Cached prompt; 573 tokens; same unsupported issue; rejected |
| Same aggressive prompt, longer residency | 640 | 814 | 700 | 15m | 48.37s | Same quality failure; rejected |
| Repeat of that request | 640 | 814 | 700 | 15m | 45.21s | Same quality failure; rejected |
| Original grounding rules; schema only in structured format | 1280 | 1623 | 900 | 5m | 47.10s | Valid; four animals, zero issues; 256 tokens |
| Repeat, longer residency | 1280 | 1623 | 900 | 15m | 23.77s | Valid; four animals, zero issues; 280 tokens |

Adopted: remove duplicate schema text from the image prompt while retaining its grounding instructions and the schema in `format`; keep 1280px images; cap image output at 900 tokens; use 15-minute model residency during the demo. Text-only intents retain the 1400-token ceiling and 8192 context. Full runtime validation and incomplete-output rejection remain unchanged. No model was replaced.

These are individual observations, not controlled statistical averages. Prompt caches, output length, model loading, system load and queueing varied. The conservative first run included 3.79s model loading and no cached prompt tokens; the repeat reused 642 tokens and loaded in roughly 9ms. The 900-token ceiling was not reached, so its independent speed benefit is unproven. Likewise, `keep_alive` controls residency, not generation speed; no 15-minute idle retention experiment was performed. The faster conservative outputs omitted affordances/relationships and still sometimes inferred incorrect details such as collars. Structured output is not factual verification.

Raw timing, load/prompt/evaluation durations, token counts, actual responses and before/after running-model metadata are in `test-results/gemma-benchmark-31.json` and `gemma-benchmark-31-conservative.json`. The script reconstructs the former duplicated-schema baseline for reproduction.

## Interaction changes

Find now explicitly asks for capability matches against existing scene objects/affordances, with their evidence IDs and uncertainty. It excludes assumed ports, compatibility, power or unseen accessories and accepts no supported result. Fix explicitly separates observed concerns from possible inspections; generic checks remain inferred suggestions, not faults. OCR, study-card evidence checks, uncertainty and same-scene follow-ups are retained. Goal inputs/actions never insert hardcoded model answers.

A real Find test still invented using animals to support a charger even though its answer admitted there was no charging capability. Prompt guidance alone was insufficient. Find's runtime/output schema now forbids capability suggestions when the scene has no recorded object affordances; literal object identification remains available in observations/answer. The UI explains this restriction. This is a narrow evidence gate, not a semantic proof of every suggestion when affordances do exist. No generated answer is silently replaced with a canned response.

## Validation

- Build, lint and `npm run test` passed. The new test command includes the 17 existing schema/scene tests, four camera lifecycle/error tests and the new Find evidence-gate regression (22 total).
- Existing Milestone 1 regression passed: real detections/OCR, image errors, asset recovery, resource release, responsive boxes, cold startup with external traffic blocked and warm full-browser-offline inference. No additional warm-offline requests.
- Existing reasoning error suite passed: unavailable model/server, malformed/invalid/incomplete output, cancellation, timeout and retry.
- Existing Milestone 3 UI regression passed. As previously documented, that suite replays recorded M2 responses only for UI checks; it is not an inference benchmark.
- File-backed camera suites passed in **Chrome 153.0.8010.55** and **Edge 154.0.4258.62**. A Y4M video fixture derived from the real animal image supplies browser camera input; MediaPipe runs for real and detected two dogs/two cats. Three samples took approximately 2.1 seconds, consistent with the non-overlapping throttle.
- Both browsers verified aspect/box alignment at 1280px and 390px, front-preference switching and old-track release, capture into actual image bytes, upload source switch, explicit Stop and pagehide cleanup. Live preview produced zero Ollama requests; Capture produced exactly one image request. That pipeline boundary test intentionally returns HTTP 503 to verify retry, rather than fabricating a successful model response.
- Camera suites observed zero external requests and zero uncaught page errors. Permission lifecycle/security-context behavior also has unit coverage.

The real captured-frame pipeline also completed with actual local Gemma: **48.79s scene wall time / 48.19s Ollama duration**, including actual MediaPipe and OCR support. The first Find response took **55.85s** but failed the semantic check by inventing animal-based charging-device support. After the evidence gate, a real text-only retry using that exact cached scene took **32.99s**, returned `needs-more-evidence`, stated that no object could charge a phone, and produced zero suggestions. Network trace: one request, zero images for the retry. No new image analysis was needed.

Model limitations remained visible: the scene description miscounted animals and misplaced a cat; the corrected Find response still said “three dogs and two cats” despite four detector predictions. These responses were not edited to hide mistakes. Recorded real responses are in `camera-live-gemma-initial.json` (retains the initial semantic-test failure) and `find-grounding-live.json` (successful corrected negative-capability check). This is not a claim of reliable counting, localization by Gemma or general capability accuracy.

## Physical-camera limitation and manual demo check

Windows enumerated HP Wide Vision 5MP and HP IR cameras. **Both automated physical-camera attempts were denied**, in Chrome and Edge, and correctly displayed the permission message and Retry control. Thus physical preview/capture, actual front/rear hardware selection and human-operated camera testing are not verified. Browser automation cannot establish whether Windows privacy settings, browser policy or another restriction caused the denial. No privacy/permission settings were changed. The user was asked to try their normal browser; a successful fixture run must not be represented as a successful physical-camera run.

Before recording:

1. Open `http://localhost:5173/` in normal Chrome or Edge; keep local Ollama running.
2. Click **Use camera** and allow this site's camera permission. If denied, inspect browser site permissions and Windows camera privacy settings. Choose the HP Wide Vision camera rather than IR if needed.
3. Verify the live image and boxes, then **Capture & explore**. Confirm the camera indicator turns off and the frozen image remains while the scene builds.
4. Ask a goal, switch modes and ask a follow-up; no new image analysis should run. Test Stop and switching to an uploaded photo.
5. If hardware permission cannot be resolved promptly, the tested upload workflow remains the demo fallback.

## Reproduce

With development on :5173 and production preview on :4173:

```powershell
npm run build
npm run lint
npm run test
node scripts/run-browser-check.mjs validate-milestone1 <playwright/index.mjs>
node scripts/run-browser-check.mjs validate-reasoning-failures <playwright/index.mjs>
node scripts/run-browser-check.mjs validate-milestone3 <playwright/index.mjs>
node scripts/validate-camera.mjs <playwright/index.mjs>
node scripts/validate-camera.mjs <playwright/index.mjs> --physical
node scripts/validate-camera.mjs <playwright/index.mjs> --live-gemma
node scripts/validate-find-live.mjs <playwright/index.mjs>
node scripts/benchmark-gemma.mjs <playwright/index.mjs>
node scripts/benchmark-gemma.mjs <playwright/index.mjs> --conservative
```

Camera reports: `test-results/camera-fixture.json`, `camera-physical.json`, `camera-live-gemma.json`; fixture-only screenshots: `camera-chrome-fixture.png`, `camera-msedge-fixture.png`. Physical-camera imagery is not written to disk by these tests.

`validate-find-live.mjs` reuses the actual scene in `camera-live-gemma-initial.json`. That file preserves the original failure for comparison; no generated fixture is substituted for it. The live test report's initial semantic failure remains documented rather than overwritten as a passing full-suite result.

## Launch boundaries

The loopback Vite proxy, local AI assets, connection CSP and production Gemma restriction remain intact. Camera requires HTTPS or localhost. Public deployment can run browser detection/OCR but cannot access the developer's laptop-local Ollama. No cloud fallback or external upload is introduced. Voice, storage, broad device/browser support, GPU acceleration and offline page reload remain outside scope. Live synchronous detection can briefly pause the UI, and sampled boxes can lag movement. Complex image JSON may hit the lower output ceiling; the app rejects incomplete output instead of displaying fabricated completion.

Implementation references: [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) for secure contexts, constraints and track cleanup; [Ollama FAQ](https://github.com/ollama/ollama/blob/main/docs/faq.mdx) for processor reporting and model residency. Changes stop at the launch-critical camera/workflow/performance scope.
