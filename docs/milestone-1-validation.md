# Milestone 1 audit and validation

Date: 2026-10-09 (Asia/Singapore).

## Before implementation

- React/Vite/TypeScript project served the default Vite counter/template.
- `@mediapipe/tasks-vision@1.1.0` and `tesseract.js@7.0.0` were installed already.
- No object detection service, OCR service, upload workflow, inference UI, local model, WASM, or OCR language assets existed.
- `test-images/desk.jpg` already existed and was preserved.

## Implemented

Real MediaPipe EfficientDet-Lite0 and Tesseract English OCR, local assets, separate TypeScript services, responsive bounding boxes, confidence labels, image validation, loading/progress/errors/empty results, worker/resource cleanup and retries. No new runtime package was needed.

Asset preparation is separate from runtime. The application uses same-origin model/worker/WASM/language URLs. A connection CSP blocks external MediaPipe usage metrics found during testing. No cloud inference or remote image uploads are used.

## Actual test results

Production build and lint passed:

```text
npm run build
  Verified all 17 local AI assets and package versions.
  TypeScript passed; Vite production bundle generated.
npm run lint
  Passed.
```

Browser: Chromium 153.0.8010.55. Tests exercised the built production app at http://127.0.0.1:4173/ using the available Playwright browser tool and `scripts/validate-milestone1.js`. No model results were mocked. Route stubs were used only to simulate missing assets during error tests.

### Object detection

`cats-and-dogs.jpg`, 1200 × 600 pixels:

| Prediction | Confidence (rounded) | Box x, y, width, height in original pixels |
| --- | --- | --- |
| dog | 73.4% | 636, 160, 282, 451 |
| cat | 70.1% | 870, 411, 208, 187 |
| dog | 68.2% | 386, 216, 256, 376 |
| cat | 64.6% | 83, 399, 347, 198 |

Four corresponding boxes appeared over the animals. The renderer preserves the model's coordinates (a prediction can extend past an image edge; the SVG viewport clips it). Numeric DOM checks verified scaling and positioning to within one CSS pixel at 1280px and 390px viewport widths. A desktop screenshot was visually inspected.

The existing `desk.jpg` returned **no objects above 35%**. This was kept as the real result. A white blank PNG also produced no detections.

### OCR

The generated test image contains these three lines:

```text
THING A LING LOCAL AI
Read this text without internet.
Invoice 12345 Total 250.00
```

Actual returned text:

```text
THING A LING LOCAL Al

Read this text without internet.
Invoice 12345 Total 250.00
```

The final capital I was recognized as lowercase l. The output is displayed without correction. The blank PNG returned no readable text.

### Connectivity and privacy

- Fresh browser context, no existing cache/service worker; external routes blocked before app load.
- Both engines initialized successfully from localhost and completed real inference.
- After initialization, full browser offline mode enabled; new image uploads, detection and OCR completed with **zero new requests**.
- Final integration test observed **zero external network requests**, only same-origin GET requests, and **zero uncaught page errors**.
- Initial implementation exposed MediaPipe usage-metrics POST attempts; the final CSP blocks those before transmission. The final tests include detector disposal, which also exercises metrics flushing.
- This validates network-disabled browser behavior, not a physical network-adapter disconnection or offline navigation without a server.

### Recovery, lifecycle and UI

Passed:

- Buttons disabled before image selection and while work is running.
- New uploads clear prior predictions and text.
- Unsupported MIME type and corrupt PNG produce visible errors.
- Blank detection and OCR results show their dedicated empty states.
- Missing model produces a detection error; restoring it and retrying works.
- Missing English language file produces an OCR error; restoring it and retrying works.
- Releasing resources terminates both OCR parent and child workers.
- Failed OCR initialization also terminates its worker tree.
- Reinitialization after disposal works.

Screenshots from the run are saved locally in ignored `test-results/detection.png` and `test-results/ocr.png`. The reusable validation function accepts a Playwright Page; it opens/closes its own isolated browser context and returns a report. It uses the project path declared at its top. The existing browser tool ran it directly; no Playwright package was added to the app.

## What remains

No required Milestone 1 implementation or validation is outstanding. Limitations are English OCR, fixed detector categories and threshold, single-image CPU detection on the main thread, and Chromium-only validation. Confidence scores are model outputs, not accuracy guarantees. No Arc/NPU performance claim was tested.

Offline reload/PWA caching, GPU benchmarking, additional languages, custom object training, Figma UI integration, Ollama and all Milestone 2 modes remain outside the implemented scope.
