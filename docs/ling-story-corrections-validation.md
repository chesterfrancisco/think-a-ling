# Ling story, progress and label corrections

9 October 2026. This iteration adds the requested layout, introductory story and a way to correct a detected name. It preserves the actual detector output and the existing local inference pipeline.

## Interface

- The scene description now sits **inside the photo card, below the photo controls**. The four explained intent choices sit outside, immediately below the card. Verified at 1280, 390 and 320px with preserved image aspect ratio and real boxes.
- First visit shows a three-step Ling story: meet Ling, point/pick a photo, then ask or correct. Next, direct step selection, Skip, finish and replay work. There is no timed gate. Only the seen-intro preference is saved in browser localStorage; images and label edits are not persisted. Storage denial falls back to a skippable intro.
- Removed the seconds counter from active reasoning. Gemma now uses an animated indeterminate bar with real Objects/Text/Understanding stage indicators. Its response API does not supply a completion percentage, so no percentage is synthesized from elapsed time. Tesseract's reported recognition-stage percentage is shown during text recognition; it is not an overall analysis percentage. Cancellation, errors, timeout and retries remain available. Reduced-motion preferences stop the bar animation.

## Why some names are wrong

Inspected `labels.txt` embedded in the actual `public/ai/models/efficientdet_lite0.tflite` asset using Python's ZIP reader. It contains the COCO category set: **pen/ballpen, door, watch and ruler are absent**; toothbrush, cell phone, clock and surfboard are present. The model cannot predict a category it was not trained to output. A lookalike category can be predicted instead. This is consistent with Google's [EfficientDet-Lite0 model documentation](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector), which describes COCO's 80 labels and the model's 320px input.

No threshold, model or weights were changed. Increasing confidence alone cannot add missing classes. A model with suitable categories or a trained local detector would be needed for broader automatic identification. This update provides an honest correction workflow, not a claimed detector-accuracy improvement.

## Correcting a label

1. Capture/upload a photo and tap its detected hotspot.
2. Select **Correct this label**, enter an object name (up to 60 characters), and **Save label**.
3. The hotspot/card show the new name as **named by you** and retain the original AI guess. **Edit your label → Use AI label** undoes the change.
4. Next questions receive the user's name separately from the detector's original name and evidence. No new image pass is required for an existing scene. Older answers/history are cleared so they cannot silently contradict the correction.
5. **Upload a clearer photo** replaces the current image and clears its scene/corrections. This is not an attached training example or reference-image comparison. The new photo follows the normal local inference path.

Live labels are tentative; capture a stable frame before correcting. Labels below 60% show “Maybe”; the 35% detection threshold is unchanged. Edits match the exact original label and measured box, never another same-named object or a Gemma-only object. The original box, confidence, model evidence and scene prose remain unchanged. A note explains that corrections apply to new questions while the original scene description is retained.

User corrections are separate `source: user` evidence in the existing unverified/inferred category. They are not eligible for observed-fact or visible-issue citations, do not create affordances, and do not count as OCR. The prompt treats correction text as untrusted data. Person-specific privacy instructions remain when either the original or corrected category is a person. Correction does not retrain or permanently teach the model, nor guarantee a correct next answer.

## Validation

- Build and lint passed; all 17 AI assets verified. Unit suite: **29 passed**, including three new correction tests for exact-box identity, nonmutation, undo, unverified provenance, schema boundaries, bounded labels and person safeguards.
- New `validate-ling-refinement` browser suite passed: story navigation/skip/replay/persistence; real four-object detection; label edit and undo; unchanged boxes; correction context sent in a text-only follow-up; stale answer/history reset; clear-photo replacement; indeterminate progress with no invented `aria-valuenow`; layout at 1280/390/320px. Zero external requests and page errors.
- Milestone 1 passed: actual detection/OCR, local assets, coordinate alignment, cold external-network-blocked startup, warm full-browser-offline new-image inference, blank/invalid images, missing assets, recovery and worker cleanup.
- Milestone 3, discovery reuse, interaction alignment, progressive results and reasoning-failure suites passed. These UI suites use documented **recorded Gemma HTTP replays**, while MediaPipe and OCR execute for real.
- Chrome and Edge file-backed camera suites passed with real MediaPipe, capture bytes, throttling and track cleanup. No new physical-camera accuracy or permission claim is made.
- One **actual local Gemma text-only test** used the previously recorded real animal scene and the user label “pet dog”. It returned the supplied name, distinguished it from the original detector label “dog”, and passed schema validation. **45.28s wall time / 45.22s service time**, one local request, zero image payloads, zero external requests. No full image benchmark was repeated.

The live result also attached the detector evidence ID to an observation about the user label. That secondary citation was not semantically justified, despite schema validity. The response is retained in `test-results/label-live.json`; this is a known grounding limitation, not hidden as a passing general accuracy evaluation. Real pen/door/watch photos were not newly tested or claimed fixed.

Reports and screenshots: `test-results/validate-ling-refinement.json`, `label-live.json`, `ling-story-desktop.png`, `ling-story-mobile.png`, `ling-progress.png`, `ling-layout-390.png`. Layout/progress screenshots use recorded scene replay and therefore can contain the original model's mistakes; they are UI evidence, not new vision-accuracy results.

Run the new checks with:

```powershell
npm run build
npm run lint
npm run test
node scripts/run-browser-check.mjs validate-ling-refinement <playwright/index.mjs>
node scripts/validate-label-live.mjs <playwright/index.mjs>
```

The live test requires the existing actual scene recording and local Ollama. The public deployment boundary is unchanged: browser detection/OCR work there; deeper reasoning needs the laptop-local app. No cloud fallback, public Ollama exposure, training upload or new dependency was introduced.
