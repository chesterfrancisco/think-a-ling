# Experimental public browser reasoning

> Follow-up: [offline/account risk review](offline-accounts-risk-review.md) records a successful full offline reload with real SmolVLM inference, and a generic answer failure now rejected by an output guard. Earlier unverified-offline statements below describe the original test run.

Implemented and tested 2026-10-09. Public production builds now offer **Enable AI to analyze → Enable on-device AI → download and prepare → Analyze photo**. Detection and OCR stay usable without enabling this feature. Existing development-only Gemma/Ollama integration is unchanged.

## What works

- Actual image inference using `HuggingFaceTB/SmolVLM-500M-Instruct`, pinned revision `a7da5b986cb59b408707209984f360a5f4ad7e47`, through Transformers.js 4.3.1 and ONNX Runtime Web/WebGPU in a dedicated worker.
- Short scene interpretations and text-only follow-ups through the existing Explore, Find, Fix, Improve and object conversation interface. Follow-ups reuse real detector/OCR context and the saved interpretation, with exact selected object IDs.
- Explicit opt-in before downloading model weights; download progress counts bytes, followed by a separate initialization state. Approximately 374 MB including runtime files. All assets are hosted by the same website, version-pinned and hash-checked. No Hugging Face connection is needed at runtime.
- Dedicated browser model cache; cancellation terminates the worker; retry reloads cached valid assets. Remove downloaded model clears this dedicated cache, not the browser's entire HTTP cache. Images and answers are not saved to that model cache.
- Unsupported WebGPU, storage, model loading and inference failures are surfaced. Setup timeout is 10 minutes; generation timeout is 90 seconds. Cancelled inference requires enabling the cached model again.
- Browser mode preserves original MediaPipe boxes. It does not convert generated object names into coordinates. Model interpretation is marked inferred, with explicit uncertainty.
- Nearly uniform images are rejected before vision inference because the raw model hallucinated content on a blank test image.

## Actual model results

Chrome 153.0.8010.55, Windows laptop, production preview over loopback. These are individual runs, not averages or internet/mobile benchmarks. WebGPU was available; GPU vendor utilization was not measured.

| Production end-to-end check | Measured result |
| --- | --- |
| Fresh context: download, cache integrity checks and WebGPU initialization | 19.13 s over localhost |
| First desk image analysis | 38.84 s until displayed |
| Actual caption | “A wooden desk with a smooth surface and two black corners.” |
| Follow-up using the saved scene | 0.883 s until displayed |
| Actual follow-up | “Desk could be used for office work, computer use, or storage.” |

The desk was recognized, but the caption's details are not independently verified. The original photo is an isolated wooden office desk. The cold first image run is still slow. An earlier worker probe processed a subsequent desk image in 1.60 s, but this is not a guaranteed warm latency.

The 256M candidate was rejected: it missed multiple animals and hallucinated objects in a blank image. The 500M probe also made errors: on a two-cat/two-dog image it invented a chair and gave inconsistent animal counts; on a blank image it invented a door and wall. The uniform-image check prevents that specific blank-input failure in the integrated flow. It does **not** solve general hallucination. No accuracy percentage is claimed.

For that reason public mode is explicitly experimental. It uses plain generated text with basic format/length validation, **not a validated JSON reasoning schema**. It does not produce evidence-validated action suggestions, Ling Steps, structured issue assessments, or study cards. Fix explicitly says that no structured issue assessment occurred. Existing structured Gemma output remains available in the local development app. OCR text is supplied as context but this small model's ability to follow it is limited.

## Checks executed

- Production build with detection/OCR and browser-model integrity checks: passed.
- Lint: passed. Unit tests: 44 passed. `npm audit --omit=dev`: zero reported vulnerabilities.
- Real model production integration: passed. Explicit consent, actual image response, actual text-only follow-up, same-scene reuse, no invented coordinates/checklists, mobile viewport without horizontal overflow, blank-image rejection, and cache removal.
- Unsupported WebGPU and failed download injection: passed. Detection/OCR still completed; retry/cancel returned to a usable state. These tests simulate failures only, not AI answers.
- Production camera/detection/OCR smoke with Vercel security headers: passed. Real four-animal detections; real printed OCR; file-backed camera capture/review/retake/track cleanup; aligned boxes at 1280/390/320 px; zero external requests, image/API POSTs or page errors.
- Existing object-context and product-experience browser regressions: passed. Those suites replay previously recorded Gemma responses for UI checks; they are not new live Gemma benchmarks.
- Existing photo refinements: passed, including manual tags, direct photo replacement, fullscreen, marker visibility and narrow-screen layouts.
- Milestone 1 regression suite: passed, including corrupt/unsupported input, missing model/language failures, retries, disposal/reinitialization and detection/OCR with all browser networking offline after initialization.

Local reports: `test-results/validate-browser-ai.json`, `browser-vlm-probe.json`, `validate-browser-ai-guards.json`, `production-smoke.json`, `validate-object-context.json`, `validate-product-experience.json`, `validate-photo-refinements.json`. Reports and screenshots are excluded from Git/deployment.

## Reproduce

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run lint
npm.cmd run test
npm.cmd run preview -- --host 127.0.0.1 --port 4173
```

In another terminal, with Playwright already installed:

```powershell
node scripts/run-browser-check.mjs validate-browser-ai C:/path/to/playwright/index.mjs
node scripts/run-browser-check.mjs validate-browser-ai-guards C:/path/to/playwright/index.mjs
npm.cmd run test:production -- C:/path/to/playwright/index.mjs
```

The real-model test runs one desk-image inference and one follow-up. Use `scripts/probe-browser-vlm.mjs` only when another model-quality evaluation is needed; it intentionally includes a blank image and bypasses the app's blank-input gate to expose model failure modes.

## Limits and deployment

HTTPS/localhost, WebGPU and sufficient memory/storage are required. Tested on this laptop's Chrome; Edge, Safari, actual phones, storage-pressure behavior and public network download speeds are unverified. Viewport tests do not establish phone hardware compatibility. First-use initialization and inference can be slow or fail on less capable devices.

This adds no cloud inference or public Ollama access. Website/model downloads still contact the hosting provider. Detection/OCR offline use after initialization was reverified; a new browser-reasoning offline test and offline page reload were not verified. Do not call the entire app fully offline. The model cache can be evicted by the browser.

The public Vercel URL/CDN deployment was not tested in this pass. After deploying, verify the model part requests return actual bytes, all WASM requests succeed, and Analyze works on a compatible device. No environment variable or API key enables this feature: it is shipped application code and static assets.

References: [official SmolVLM browser example](https://github.com/huggingface/transformers.js-examples/tree/main/smolvlm-webgpu), [Transformers.js WebGPU guide](https://huggingface.co/docs/transformers.js/guides/webgpu), [pinned model](https://huggingface.co/HuggingFaceTB/SmolVLM-500M-Instruct/tree/a7da5b986cb59b408707209984f360a5f4ad7e47).
