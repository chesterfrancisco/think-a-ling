# Think-a-ling!

**Point at anything. Know what to do.**

Your world. Full of possibilities. Think-a-ling! is an Everyday Action Intelligence app that helps you understand, use, fix and improve what's around you, with Ling as your guide.

**[Try the free web app](https://think-a-ling.vercel.app/)** · No account required.

## What you can do

- Capture or choose a photo, inspect detected objects and read English text.
- Explore, Find, Fix or Improve with a question about your goal. Optional on-device AI provides experimental answers on compatible hardware.
- Correct or remove mistaken tags, add a missing tag, and crop or adjust a photo before trying again.
- Find a detail in recognized text, practice recalling a line and save useful discoveries in **Saved**. Saves contain text and evidence, not the photo, and stay in this browser.
- Adjust reading, motion and answer-language preferences in **Settings**.

For a quick example, open **First time? Try a study task.** on the dashboard. The sample is an input image; Ling reads it locally each time.

## Online website, local AI

Vercel hosts the website and downloads. Object detection and text reading run on your device. Optional **SmolVLM 500M** reasoning also runs in the browser using WebGPU after a separate model download of about 374 MB. No cloud inference API or photo upload is used.

The local development app preserves **Gemma 3 4B through Ollama** for deeper reasoning, supported recommendations and Ling Steps. The public website cannot access that local model. Checklist completion is marked by the user, not verified by AI.

**Offline use is optional.** The first visit and downloads need internet. Prepare **Offline downloads** in Settings before losing connectivity to reopen the app and use detection, English text reading and saved notes in the same browser. Browser reasoning needs its separate model download and compatible hardware. Browser storage can be cleared or evicted; local Gemma still needs the local app and Ollama running.

## Prototype limits

Detections can miss or mislabel objects; OCR can misread text. SmolVLM answers can invent details or be unhelpful and are not equivalent to Gemma. English is the main tested path; Filipino answers and local voice are experimental. Broad phone/browser compatibility and reliable voice transcription are not established. This is not a safety or medical assessment.

## Built with

React · TypeScript · Vite · MediaPipe / EfficientDet-Lite0 · Tesseract.js / English data · Transformers.js / SmolVLM / ONNX Runtime / WebGPU · Ollama / Gemma · browser on-device speech (experimental) · Vercel. Developed with AI-assisted coding tools.

Technical details: [deployment and validation](docs/vercel-deployment.md), [offline tests, demo and risks](docs/offline-accounts-risk-review.md), [browser-model results](docs/browser-ai-validation.md). Model asset sources and hashes are recorded in [the detection/OCR manifest](public/ai/manifest.json) and [the browser-AI manifest](public/ai/browser-reasoning.json).

Created by **Chester Francisco** for the **AppBuildersPH Local AI Hackathon 2026**.
