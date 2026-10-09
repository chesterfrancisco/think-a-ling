# Camera review and splash validation

Validated 2026-10-09. This supersedes the earlier automatic capture-to-analysis flow and loading-after-tap splash behavior.

## Behavior

- **Capture photo** immediately draws the current frame onto a visible canvas before stopping the camera tracks. That canvas stays visible during PNG encoding and photo review.
- **Retake photo** restarts the selected camera. Late encoding callbacks from a discarded frame cannot overwrite the new camera session. **Back** and **Discard photo** return to source selection and release camera resources.
- **Analyze photo** is enabled when the captured file is ready. Only confirmation sends the frozen photo into the existing detection, OCR and shared-scene pipeline. The review remains visible while the application decodes the image. Live Gemma inference is not introduced.
- The opening logo and green bar animate automatically for 1.5 seconds. Afterward, **Tap anywhere to continue** appears and waits for user input. Early clicks/Enter do not advance. Reduced-motion preference skips the animation and still waits for input. This is a branding animation, not AI readiness or inference progress.

## Actual validation

| Check | Result |
| --- | --- |
| `npm run build` | Passed; all 17 local AI assets verified |
| `npm run lint` | Passed |
| `npm run test` | 37 passed, 0 failed |
| `validate-camera.mjs` | Passed in Chrome 153.0.8010.55 and Edge 154.0.4258.62 |
| `validate-ling-story-navigation` | Passed: loading before tap prompt, early input ignored, no automatic advance, keyboard activation, reduced motion, five story pages, replay, responsive layout, mode navigation and scene reuse |
| `validate-milestone1` | Passed: real detection/OCR, responsive boxes, offline inference after initialization, blank/corrupt/unsupported inputs, disposal, missing-asset errors and retries |
| `validate-progressive` | Passed: browser detection/OCR before Gemma, staged results, cancellation, preserved scene, source reset and ignored stale initialization |

Camera tests use browser `getUserMedia` with a file-backed video source and actual MediaPipe inference. They deliberately delay delivery of the real PNG encoding callback to reproduce the previously blank interval. The tests verify visible pixels during encoding; review layouts at 1280, 390 and 320 pixels; Retake while encoding; Back/Discard/reopen; retained camera selection; track cleanup; and no scene request before confirmation. Pixels from the confirmed image match the reviewed canvas exactly. Each browser observed one image-bearing scene request after confirmation, zero external requests and zero page errors.

The camera suite deliberately returns an unavailable-service error for that scene request. The progressive UI suite uses a recorded response for timing/cancellation assertions. Neither is a new Gemma accuracy or latency benchmark. Real object detection and OCR ran in the browser; no fabricated detections were added to application workflows.

Screenshots and machine-readable results are in `test-results/`, including `camera-chrome-review.png`, `camera-chrome-encoding-preview.png`, equivalent Edge images, `ling-splash-loading.png`, `ling-splash-new.png`, and `camera-fixture.json`.

## Limits and manual follow-up

The physical webcam was not retested in this pass. To check it: open camera, capture, inspect the preview, retake, capture again, confirm Analyze, then try Back and reopen. Permission and hardware behavior can differ from a file-backed test camera.

Existing model accuracy limits, inference latency and public-deployment limitations remain as documented in the [usability and accuracy audit](usability-performance-accuracy-audit.md). No model, inference endpoint, cloud upload, authentication, dependency or deployment changes were introduced.
