# Offline experience, accessibility and risk review

**Current free-app workflow:** choose or capture a photo, inspect objects or text, ask an optional on-device question, and explicitly save useful text in this browser. The app opens directly and saved discoveries stay in this browser. Accessibility, language and optional offline preparation live in navbar **Settings**. **Need inspiration?** offers five sample pictures with editable questions. Users can correct or remove mistaken tags and undo removals; removed tags cannot supply detection evidence to new questions.

Updated 2026-10-10. This is the current status; earlier milestone reports describe earlier builds.

## What is implemented and tested

- Explicit offline preparation, followed by a full page reload with browser networking disabled. Actual detection, English OCR, keyword lookup, recall practice, photo editing and device saves work afterward. This is a service-worker app cache, not a claim that a first visit works without internet or that PWA installation is implemented.
- Real SmolVLM image interpretation and a follow-up executed after an offline reload with its separate model cache prepared. The image run took 39.36 seconds on this laptop. Execution passed; reliable answer quality did not. It described a wooden desk, then answered that it could be used for anything. The latter is now rejected by a tested output guard. This narrow guard does not solve hallucination.
- Crop, rotate, flip, brightness/contrast, preview/reset/apply; edits stay on-device. Applying produces a new image and clears old answers/tags before rescanning. Original files are unchanged. Edited long edge is capped at 2048 pixels; enhancement cannot recover missing detail.
- Ling 404 and render-error fallbacks, a skip link, native dialogs, keyboard-operable controls, labelled icons, larger reading text, stronger contrast and animation controls. Preferences persist locally and OS reduced-motion is respected. Axe found **zero violations** on the tested home, Settings, OCR/recall, answer and photo-editor screens. This is not full WCAG certification, a screen-reader audit or a substitute for testing with disabled users.
- Desktop heading fits on one line; it wraps on phones. Ling stays centered at narrow widths. Voice icon appears only after a scene analysis; its tooltip describes it. Red cancel/error, green success and yellow warnings also use explanatory text.

## Hosting, local AI and offline use

These are three separate capabilities:

- **Online hosting:** Vercel delivers the page and model files. The first visit and initial downloads need internet.
- **Local inference:** detection, OCR and optional SmolVLM execute on the visitor's device. Local Gemma executes on the computer running the local app and Ollama. Hosting a page online does not make its inference cloud-based.
- **Offline preparation:** the service worker stores the app and required assets so the same browser can reopen it without a connection. Optional reasoning has a separate model cache. New versions, storage eviction or cleared site data may require preparation again.

**Saved** stores selected text and evidence. It does not cache the application, and the offline pack does not automatically save a user's discoveries. Offline preparation is optional for online use, but necessary for the promised reload-without-signal experience. Existing browser tests verify networking-disabled reload; a recorded physical-disconnection demo on the actual presentation device is still useful evidence.

The About dialog states the distinction briefly. How to explains preparation; Settings contains the download controls. Initial network requirements and storage limits must remain visible there. No first-visit-offline or permanent-cache promise is made.

## Current acceptance workflow

Photo or camera → real detections/text → inspect, correct or retry → useful result → Save this → revisit or delete in Saved. No account is required. Saved text and evidence remain in this browser profile and origin; clearing site data removes them.

## A focused two-minute demonstration

Target user: **a student revisiting short printed English notes with unreliable connectivity**. Product category: **Personal assistants / Productivity**, demonstrated through an **Education** task. Computer vision is the enabling technology; privacy is a benefit. Accessibility is a design consideration, not a claim that this is a validated assistive-navigation product.

While online, build/deploy and choose **Settings → Offline downloads → Prepare for offline**. Wait for ready (about 84 MiB, app/detection/OCR/fonts/five examples). Optional SmolVLM needs another approximately 374 MB and compatible WebGPU hardware. Prepare and verify both before the demo if you plan to use model reasoning. Keep a typed-input route available; do not depend on experimental speech.

1. Turn browser networking off and reload the page.
2. Choose **Need inspiration? → Summarize this document**, or upload your short English notes. This runs real OCR; it does not replay a prepared answer.
3. Choose **Read text**; search `Photosynthesis`. Compare the returned line to the image.
4. Choose **Practice recall from these lines**; reveal the exact recognized text. These are verbatim recall cues, explicitly not generated explanations or fact verification.
5. Save the useful practice, reload and revisit **Saved** without reanalyzing. Show the preserved uncertainty. Saved discoveries stay on this device.

For richer reasoning use a specific English question, compare it with evidence and show an honest retry/limitation when the model is wrong. Gemma's existing structured recommendations and eligible Ling Steps remain in the local development app; SmolVLM does not fabricate equivalent structured evidence. A larger feature count does not substitute for this end-to-end useful task.

## Languages and mode selection

| Capability | Current support and limitation |
| --- | --- |
| Typed goals | Unicode input, up to 500 characters, one focused question at a time. Accepting characters does not establish language accuracy. |
| English answers | Primary tested path, still fallible. OCR retrieval is verbatim; generated answers are explicitly inferred. |
| Filipino/Tagalog answers | User-selectable language instruction, experimental. No representative native-language quality benchmark passed in this change. |
| Cebuano/Bisaya, Arabic, Korean | Not validated or promised. Prefer an English rephrasing and compare any model output to the original evidence. |
| Text reading | English Tesseract language data only. Latin-script words may appear, but accurate Tagalog/Cebuano OCR is not established; Arabic/Korean OCR packs are not installed. |
| Local speech | English browser speech pack only where supported. Simulated controls pass. Earlier real generated-audio tests returned no-speech/timeout; physical-mic accuracy, Tagalog and offline speech are unverified. No remote fallback. |
| Interface | English labels; this is not a fully translated multilingual UI. |

Explore is useful for explaining an observed item; Find needs a user goal and potentially relevant recorded objects; Fix needs a concern or evidence worth checking; Improve offers an optional better use. Modes are ranked using recorded context and intent, not silently removed based on a fallible guess. For crowded wiring, Fix/Improve can be prominent; Find could still be relevant if the user wants to locate a switch or label. A photo cannot certify electrical safety, infer hidden damage or prove overload. User-added tags and corrected labels remain unverified annotations, not fresh detector measurements.

## Risk register and mitigation

This lists the material risks identified in review, not every possible future bug.

| Risk / consequence | Mitigation implemented | Remaining procedure / limit |
| --- | --- | --- |
| Invented model details or useless advice | Inferred labels, evidence separation, blank-input check, format/repetition/blanket-answer rejection, conservative safety/identity responses | Inspect outputs for the demo task. These checks are incomplete; do not claim an accuracy rate. |
| Missing people/objects or wrong count | Real boxes/confidence preserved; manual missing tags clearly distinguished | Never present detector count as complete. Confidence is not accuracy. |
| OCR misreads, wrong digits or label instructions | Verbatim text, source comparison, crop/rotate/contrast and retry | English printed text only; verify important details manually. |
| Image/OCR prompt injection | Quoted OCR treated as data, bounded prompt context; generated text cannot execute app actions | Model may still follow malicious text. No autonomous real-world actions or trusted recommendations. |
| Old object's answer appears for a new object | Scene/object IDs, separate response keys, cancellation and late-result checks | Existing isolation tests retained; switching images clears context. |
| Manual tag treated as measured/verified | Separate annotation provenance; no borrowed confidence or generated boxes | User labels can be incorrect; do not retrain/invent evidence. |
| Unsupported or looping model output | Bounded generation, explicit errors, retry hints, cancel terminates worker | Safeguards do not ensure useful content. Use direct text tools when reasoning is weak. |
| Slow GPU/CPU, memory pressure or device loss | Optional model, WebGPU check, worker, deadlines and cancel; detection/OCR continue independently | Phone hardware and all browsers untested. Cold inference may take tens of seconds. |
| Estimated progress mistaken for real completion | Estimated label remains; 100% only after answer ready; requested plain waiting copy | No true model-token completion percentage is available. |
| Damaged/oversized photo or extreme crop | MIME/decode/20 MiB/25 MP validation; crop bounds and edited size cap | JPEG/PNG/WebP/BMP supported; HEIC/PDF are not. Editing may reduce OCR detail. |
| Callback from cancelled edit/inference | Active/generation guards discard late responses | Retake/new-photo paths reset the analysis. |
| Incorrect compressed OCR cache bytes | Verify both exact source gzip hash and exact known decompressed hash | Fix confirmed by full offline OCR after a preview server decompressed the language file. |
| Partial download or stale build cache | Build-version cache, SHA-256 checks, completion marker only after all files, resumable retry/cancel | New deployments need a new offline pack. Close old tabs before adopting an update; test the final deployed build. |
| Quota, eviction or cleared browser storage | Friendly storage errors; readiness check verifies expected cache entries; explicit saved-copy semantics | Offline availability is not permanent. Check before demo; clearing site data loses device saves/models/preferences. |
| No signal on first ever visit | Clear preparation requirement; prepared pack can reload offline | Assets cannot be downloaded without a connection. Service-worker-disabled/private modes may fail. |
| Untrusted saved HTML | React renders text; validates saved payload shape and length | Do not add raw HTML rendering. Saved claims retain original caveats. |
| Shared-device privacy | Explicit local saves, no photo persistence, delete controls | Anyone with the browser profile can read local saves. Delete them in Saved when using a shared device. |
| Misleading “private/offline” promise | About/Help distinguish hosting, local inference, device saves and offline preparation | Initial downloads need internet; storage can be evicted. Device saves are not an offline app pack. |
| Inaccessible controls or distracting motion | Labels/tooltips/focus/skip link, keyboard controls, reduced motion, reading preferences, status words | Run manual screen-reader and disabled-user usability sessions; automated audits are incomplete. |
| Missing page/crash strands the user | Ling 404, Back link, React render-error boundary, static `404.html` | Asset 404s stay errors; hosting needs the built fallback deployed. |
| Conflicting development servers / dependency reload | Tesseract explicitly prebundled; separate test cache when needed | Reuse the existing dev server. A stale dependency 504 and first-photo reload were corrected and browser regression passed. |
| Large initial JS bundle | AI model download remains optional, fonts local, explicit offline pack | The main bundle is about 524 KB; build reports a >500 KB chunk warning. Further splitting is a performance opportunity, not a passing mobile-speed claim. |

## Judging criteria assessment

| Supplied criterion | Evidence and honest gap |
| --- | --- |
| Problem & usefulness — 25% | Student note lookup/recall/save/offline revisit is a concrete task. Actual OCR flow passes; target-user interviews, task completion/time measurements and repeat-use evidence remain absent. |
| Local AI — 25% | MediaPipe, Tesseract, optional browser SmolVLM and local Gemma execute locally. Offline reload and real cached browser inference tested. Initial preparation requires a connection; local execution is not a claim of fast or accurate answers. |
| Technical execution — 20% | Build/lint/55 unit tests, production camera smoke, offline reload/crop/save, tag correction/removal and stale-answer cancellation pass. Consistent reasoning quality, a physical-device matrix and all fault cases remain unverified. |
| Innovation — 15% | From observation to useful actions, evidence and reusable notes; local inference enables private/offline use. Demonstrate the benefit end to end with a new input. No competitor comparison or uniqueness claim has been established. |
| Product/demo quality — 15% | Coherent student flow, accessible controls and Ling branding. Must rehearse on the actual presentation device; speech and broad SmolVLM advice should not be the critical path. |

The screenshots allow secondary cloud services while meaningful inference runs locally. The implemented architecture fits that technical direction. Build-time eligibility, disclosure completeness and final scoring are organizer decisions; not all criteria can be certified from code. Disclose MediaPipe/EfficientDet, Tesseract English data, Transformers.js/SmolVLM/ONNX/WebGPU, Ollama/Gemma, experimental browser speech, React/Vite/Vercel and AI-assisted development. Do not present rule-based OCR retrieval or recall cues as generative AI.

The strongest next evidence is a short observed trial with 3–5 target students: give each their own clear English note photo, record whether they can extract a useful detail and save/reopen it without help, record time and errors, and ask whether they would return. This is a proposed evaluation, not completed research or proof of learning improvement. Rehearse the prepared offline flow on the actual laptop and show model mistakes honestly. Ranking depends on judges and competing entries; no top-ten guarantee is supportable.

Local evidence: `test-results/validate-hosted.json`, `validate-resilience.json`, `validate-offline-reasoning.json`, `validate-simple-answers.json`, `validate-settings.json`, `validate-pockets-layout.json`, `validate-voice-controls.json`, `production-smoke.json`, `security-audit.json`. These artifacts are excluded from Git/deployment because they may contain test inputs or temporary session details. See [deployment commands](vercel-deployment.md).
