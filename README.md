# Think-a-ling!

**Point at anything. Know what to do.**

Think-a-ling! is an Everyday Action Intelligence app that helps people understand, use, fix and improve what's around them. Capture a photo, inspect objects and text, work toward a goal, and keep useful discoveries with Ling.

**[Public demo](https://thinkaling.vercel.app/)** · Free to use · No account or API key required.

## Run locally — judges and new users

### 1. Get the app

Install **[Node.js 24](https://nodejs.org/en/download)** and Git. Use a recent desktop Chrome or Edge for the tested browser path. Windows was tested; the commands also work in macOS/Linux terminals, but those platforms have not been independently validated.

```sh
git clone https://github.com/chesterfrancisco/think-a-ling.git
cd think-a-ling
npm ci
npm run build
npm run lint
npm test
```

The repository includes detection/OCR assets and the browser-model files, so the checkout is several hundred MB. Initial cloning and dependency installation need internet. Build checks model, WASM, OCR worker and language-file hashes. No XAMPP, PHP, database or `.env` file is required.

### 2. Start local Gemma

Install **[Ollama](https://ollama.com/download)** on the same computer. Start the Ollama app. If its server is not already running, use `ollama serve` in a separate terminal and leave it running.

```sh
ollama pull gemma3:4b
ollama list
```

Keep the exact model name **gemma3:4b**; this app is configured for it. It is a local text-and-image model with an approximately 3.4 GB download, plus additional memory needed while running. Our installed version is Ollama 0.40.2 with model ID `68ceab7e468a`; the upstream tag can change. CPU answers can take a minute or more. See the [official model entry](https://ollama.com/library/gemma3:4b).

### 3. Open the full local app

From the repository folder:

```sh
npm run dev
```

Open **http://localhost:5173/**. Leave both Vite and Ollama running. Detection and English text reading work even when Ollama is unavailable; deeper local analysis requires it.

The local request path is `browser → Vite /local-ollama/api/chat → 127.0.0.1:11434 → Gemma`. This proxy is restricted to localhost. Do not use `--host 0.0.0.0`, expose Ollama publicly, or expect another device's browser to reach this computer's local model.

## Try the workflow

1. **Open camera** and capture/review a frame, or **Choose a photo** / drop one into the dashboard. For a reproducible input, select **Summarize this document** under **Need inspiration?**
2. Objects and English text appear automatically. Tap a marker, correct/remove a mistaken tag, or open **Read text**. The example contains “Photosynthesis uses light to make food.” Check OCR against the image.
3. Choose **Analyze photo**, then Explore, Find, Fix or Improve for your goal, or **Ask This Space**. Follow-up questions reuse the current scene. Check evidence and uncertainty; model answers may be wrong.
4. In the local Gemma app, eligible recommendations offer **Turn into steps**. Checked steps mean user-marked completion, not AI-verified physical changes.
5. Choose **Save this**, then **Saved** to revisit or delete text and evidence. Photos are not saved. Saves stay in this browser/origin; localhost and the public website have separate libraries.

Try your own clear English note after the example: read a detail, find a keyword, practice recall and save it. Text search and verbatim recall are ordinary app tools using real OCR output; they are not generated explanations.

## Browser-only build and offline reproduction

To run the same type of build as the public website, without Ollama:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open **http://127.0.0.1:4173/**. The production preview intentionally has **no Gemma proxy**. For experimental browser answers, open Ask This Space, choose **Enable on-device AI**, and wait for the approximately **374 MB** SmolVLM model/runtime download and initialization. This needs compatible WebGPU hardware; detection and text reading remain available without it.

For a signal-loss demonstration:

1. While connected, open **Settings → Offline downloads → Prepare for offline** and wait for ready (about 84 MiB for the app, detection, English OCR and sample pictures). Browser reasoning requires its separate download above.
2. Disable networking in browser developer tools and reload the same URL. Choose another image, run detection/text reading, save and revisit a discovery.
3. For a physical Wi-Fi-off demo, prepare first and rehearse on the presentation device. A first visit without downloaded files cannot work. Browser storage can be evicted or cleared; a new build may need preparation again.

The localhost Gemma path also works without cloud inference once dependencies/assets/model are installed, with Vite and Ollama still running. Offline preparation is for reopening the production web app; it is separate from saving notes.

## Why local AI matters

A student with unreliable connectivity can read a photographed note, locate a useful detail and revisit saved material after the connection disappears. Personal photos and recognized text remain on the device. Repeated inference does not require a cloud AI account or a per-request cloud API call. Hardware speed and answer quality still matter; local does not automatically mean faster or more accurate.

**Local AI categories:** local vision models, local LLMs, offline AI after preparation, privacy-preserving AI, and AI on a user's PC/laptop. Browser speech is experimental and is not a verified core demo. Phone compatibility is not established across devices.

**Product category:** Personal assistants / Productivity, demonstrated through an Education task. Computer vision is the enabling technology. Accessibility controls and privacy support the experience; this is not a validated assistive-navigation, healthcare or autonomous-agent product.

## Checks and troubleshooting

`npm run build`, `npm run lint` and `npm test` run from the repository root. With Chrome installed, the production browser smoke test uses the Playwright Core package already included in the locked test dependencies:

```sh
npm run test:production
```

If Chrome is absent, install it first ([browser installation guide](https://playwright.dev/docs/browsers#installing-google-chrome--microsoft-edge)). The test runs real detection/OCR and a file-backed camera test, not a real-webcam or model-quality benchmark. Further checks and deployment commands: [technical guide](docs/vercel-deployment.md).

| If this happens | What to do |
| --- | --- |
| Gemma is unavailable | Keep Ollama running; confirm `ollama list` includes `gemma3:4b`; use `npm run dev` on port 5173. |
| Port 5173/4173 is occupied | Use the already-running app or stop your own conflicting process before retrying. |
| Browser AI is unsupported or slow | Try a compatible desktop Chrome/Edge, or use local Gemma. Reading text/detection do not need WebGPU. |
| Camera is denied | Grant permission on localhost/HTTPS or choose a photo. |
| Image will not open | Use JPEG/PNG/WebP/BMP, at most 20 MB and 25 megapixels. HEIC/PDF are not supported. |
| An AI asset is missing | Restore committed assets; `npm run setup:ai` prepares detection/OCR, and `node scripts/prepare-browser-ai.mjs` prepares browser reasoning. Downloads require internet. |
| An offline copy is old | Reconnect, close old app tabs, reopen and prepare the new version. Do not clear site data if you need device saves. |

## Limits and technology

Detection can miss or mislabel objects. OCR targets printed English. SmolVLM answers can invent details or be unhelpful; Gemma is also fallible. Filipino answers and on-device English speech are experimental; reliable physical-microphone transcription, broad phone support and other languages are not established. This is not a safety or medical assessment. Full details: [model results](docs/browser-ai-validation.md) and [offline, accessibility and risk review](docs/offline-risk-review.md).

React · TypeScript · Vite · MediaPipe / EfficientDet-Lite0 · Tesseract.js / English data · Transformers.js / SmolVLM / ONNX Runtime / WebGPU · Ollama / Gemma · experimental browser speech · Vercel hosting. Developed with AI-assisted coding tools. Asset sources, versions and hashes: [detection/OCR manifest](public/ai/manifest.json), [browser AI manifest](public/ai/browser-reasoning.json).

Created by **Chester Francisco** for the **AppBuildersPH Local AI Hackathon 2026**.

The five inspiration pictures are example inputs, not prewritten answers. [Sample provenance](public/demo/README.md) explains the generated mock photographs and synthetic study notes.
