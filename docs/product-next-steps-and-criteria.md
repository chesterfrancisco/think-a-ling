# Product improvements and hackathon review

> Historical snapshot. Offline reload and real Supabase integration were added afterward. See [current implementation and acceptance gaps](offline-accounts-risk-review.md).

Reviewed 2026-10-09 against the six AppBuildersPH slides supplied by the user. This is a readiness assessment, not an official judge score or a claim that every criterion has been met.

## Public and localhost remain separate

The development build on a loopback host still selects Gemma through the existing guarded Vite/Ollama proxy. A production build, including `npm run preview` on localhost, selects optional browser SmolVLM. Routing depends on the build as well as the hostname. Production cannot reach the developer's Ollama, and no tunnel or cloud inference service has been introduced.

The interface is shared, so layout, saves and voice controls appear in both environments. The inference implementations were not rewritten. The local proxy rejection checks passed again, and a read-only model listing confirmed `gemma3:4b` is installed. No fresh long Gemma generation benchmark was run in this pass.

## Implemented and checked

| Change | Actual behavior and validation |
| --- | --- |
| Ling Pockets | Explicit Save this for recognized text, scene summaries and answers. Saved opens a browser-only library. Actual OCR saving, reload/revisit without AI requests, deduplication and deletion passed in production preview. |
| Saved evidence | Answer text, recommendations, original evidence IDs, source and uncertainty are retained. Recommendations remain suggestions; no physical task is marked AI-verified. Response saving was tested with recorded Gemma output replay, not new live Gemma generation. |
| Relevant modes | Deterministic UI suggestions use the supplied goal, evidence-linked objects, recognized text and supported issue references. Other ways to explore retains all four choices. These are routing hints, not new model predictions. |
| Responsive Ling | Centered at 390px and 320px, with no horizontal overflow. A short purpose statement balances the desktop heading. Viewport tests do not establish phone model compatibility. |
| Fullscreen scanning | The live viewfinder expands with its camera controls and measured detection boxes. File-backed getUserMedia tests checked alignment, capture review in fullscreen, exit, retake and track cleanup. Physical phone cameras remain untested. |
| Local voice controls | English-only experimental opt-in checks local speech support, offers a browser-managed pack download if needed, and requires `processLocally = true`. A transcript fills an editable question and suggests a mode; it never submits automatically. Context switches/closing stop recording. Unsupported browsers refuse remote fallback. |

Pockets stores text/evidence in localStorage, up to 50 entries and a bounded total payload. It does not store photos, record an automatic transaction log, restore the original live scene or preserve checked-step state. Anyone with the same browser profile can read it; clearing site data removes it. Different origins, including localhost and Vercel, have different libraries. The UI reports storage failures rather than claiming a save succeeded.

### Voice limitation: actual transcription is not validated

Chrome 153 reported English on-device speech as downloadable and Filipino as unavailable. A browser-managed English pack installed during the real-audio attempt. However, recognition from a generated local WAV/fake microphone returned no-speech, and a generated audio-track attempt timed out. No physical microphone was recorded. This does not establish whether manual speech works on this machine, and does not establish speech accuracy, Filipino/Taglish support or offline speech behavior.

The lifecycle regression uses a clearly marked speech event test double. It proves editable transcript handling, mode routing, cleanup, no automatic submission and rejection of remote-only engines. It does not prove real recognition. Keep voice experimental and use typed questions for the reliable demo until a consenting user tests their microphone successfully.

The browser's default SpeechRecognition may use remote services; this app explicitly rejects that path. See [MDN on-device recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally) and [speech API usage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API). No Whisper or other new speech model has been bundled.

## Mode-selection criteria

An explicit recognized goal takes priority. Otherwise, suggestions follow the saved scene. Low-confidence or inferred context never becomes a verified condition.

| Situation | Suggested choices | Why |
| --- | --- | --- |
| A goal such as find, check, organize or explain | Matching mode, then Explore | The user's intent is more useful than guessing solely from a photo. |
| Possible issue with observed evidence references | Fix, Explore | Ask what to inspect; the issue remains a model interpretation. |
| Evidence-linked cable/socket/power-strip context | Fix, Explore | Cabling may invite inspection, but a photo does not establish overload or electrical safety. |
| Recognized text | Explore, Find | Understand text or find a particular detail in it. |
| Desk/table/chair/shelf context | Improve, Explore | Consider organization or useful arrangements. |
| Objects with recorded possible uses | Find, Explore | Match available objects to a goal. |
| Little supported context | Explore | Start with understanding and keep alternative modes accessible. |

For an “octopus wiring” photo, Find is not inherently irrelevant: the person might want to locate a switch or readable rating. It is therefore deprioritized rather than removed. The current detector may not recognize all wiring components, and the small browser model can misinterpret a scene; users can choose another mode. These heuristics are not a safety assessment or a learned classifier. They use available saved-scene context; richer relevance may wait for reasoning while detection/OCR appear progressively.

## Both saved history and real accounts

**Implemented now:** device-only saving described above. **Prepared here:** a concrete account/sync design. **Not implemented:** signup, authentication, cloud storage, account-based feature limits or cross-device history. A static Vercel build alone cannot provide secure real accounts and shared storage. No simulated login or passwords in localStorage were added.

Recommended product flow:

1. Public landing explains the app and offers **Try on this device**. The guest can use detection, OCR and supported local inference without authentication.
2. Optional **Create account / Sign in** unlocks future backup and cross-device access. It does not improve model accuracy or make an unsupported phone support WebGPU.
3. Saved has **On this device** and, when configured and signed in, **My account**. Existing notes stay local until the user explicitly chooses which ones to upload. Original photos are excluded unless a later, separate photo-backup feature is expressly chosen.
4. Offline use continues with local saves and local inference after required assets are available. Sync waits until connectivity returns; signing out does not silently delete local notes. Account and device deletion are explicit separate actions.

Implementation boundary for the next account milestone:

- Select and configure a managed authentication/database provider in the owner's account. No service was selected or provisioned by this refinement pass. Define allowed login redirects for production and development separately.
- Add real signup, verified login, recovery, session expiry and signout using that provider. Server-validated identity must enforce record ownership; UI visibility alone cannot secure data or feature entitlements.
- Store `id`, `owner_id`, `kind`, `title`, `content`, `source`, `photo_name`, `evidence`, `caveats`, `created_at` and `updated_at` in owned discovery records. Keep an explicit sync choice and handle conflicts/errors without overwriting local notes silently.
- Expose authenticated list/create/update/delete operations protected by ownership checks, and provide account/data deletion. Avoid shipping privileged service credentials to Vite client code.
- Test two independent users, guest use, expired sessions, denied cross-user reads/deletes, lost connectivity, retries and deletion before offering account features publicly.

Cloud authentication/storage can be secondary components under the supplied rules, while meaningful inference remains local. Requiring an online login before core local AI works would weaken the “cloud disappears” experience. If account limits are introduced, attach them to future sync/storage allowances rather than the ability to inspect a photo offline. Design guidance: [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Criteria assessment

| Supplied criterion | Weight | Evidence now | Remaining gap |
| --- | --- | --- | --- |
| Problem & Usefulness | 25% | Recognition and OCR, practical local-Gemma recommendations/steps, saved results that can be revisited without another inference. | “Everyday problems” is broad. Demonstrate a specific user and task, such as a student organizing a desk and returning to a saved action list. No user study or measured task-success rate is claimed. |
| Local AI Implementation | 25% | Real MediaPipe/Tesseract browser inference; Gemma on the user's computer; optional SmolVLM WebGPU. No photo inference API. Detection/OCR tested on new images after browser networking was disabled. | First page/assets need a connection on the public site; offline reload/PWA is absent. Browser reasoning and speech are not established as fully offline. |
| Technical Execution | 20% | Build, lint, 48 unit tests, real detection/OCR/camera smoke, object-context regressions, asset hashes and proxy guards. | Small-model hallucinations, slow cold reasoning, failed automated real speech, untested phone hardware and the live Vercel deployment prevent a blanket reliability claim. |
| Innovation | 15% | Observation → context-sensitive action → evidence-linked steps → saved discovery is a coherent product interaction. Same-scene reuse avoids repeated image inference. | Novelty is for judges to assess. Public SmolVLM does not produce Gemma's validated structured steps, issue assessments or study cards. Extra login screens alone do not demonstrate innovation. |
| Product & Demo Quality | 15% | Capture review/retake, responsive Ling, fullscreen scanning, manual tags, selected-object isolation, clear saved history and uncertainty. | Prepare a short repeatable demo on tested hardware. Voice needs manual validation; first model download is too large to hide in a live presentation. |

Meaningful local inference and disclosure have evidence. Substantially built during the hackathon is a provenance requirement: the supplied claim and Git history can support the submission, but this review cannot independently certify the event's timing. A live demonstration and final submitted materials are also outside these automated tests. The slides list example technologies, not a requirement to use all of them. Login, every Local AI category and speech models are not mandatory.

The strongest next demo is one complete, useful task: show a workspace or clear study material, inspect real detections/text, ask a focused question in the local Gemma app, turn an eligible recommendation into Ling Steps, save it, reload, and revisit it. Keep the model's caveats visible. Preload dependencies/models, then demonstrate the specifically verified local behavior with networking disabled. Do not label the whole public site fully offline or claim a model confidence value is measured accuracy.

## Validation and exact commands

```powershell
Set-Location C:\xampp\htdocs\thing-a-ling
npm.cmd run build
npm.cmd run lint
npm.cmd run test
npm.cmd run test:production -- C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
```

For the UI regressions, keep the development server on localhost:5173 and production preview on 127.0.0.1:4173 running. The Playwright path is this machine's existing test installation; substitute your own path elsewhere.

```powershell
node scripts/run-browser-check.mjs validate-pockets-layout C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
node scripts/run-browser-check.mjs validate-voice-controls C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
node scripts/run-browser-check.mjs validate-product-experience C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
node scripts/run-browser-check.mjs validate-object-context C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
node scripts/run-browser-check.mjs validate-ling-story-navigation C:/Users/chest/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs
node scripts/audit-local-security.mjs
```

These suites passed. The voice controls suite simulates events; product/object-context suites replay recorded Gemma responses for UI assertions. Detection/OCR and the production camera API are exercised for real using test fixtures. The separate generated-audio real speech test did not pass and is not part of the passed claims above. Its diagnostic script expects a generated `test-results/voice-question.wav`; no microphone recording or private user photo is included in Git.

Local reports and screenshots are under ignored `test-results/`. The main bundle slightly exceeds Vite's 500 kB warning threshold; the build passes, but this is a bundle-size optimization opportunity. No new package dependencies were introduced by these refinements. See [browser AI validation](browser-ai-validation.md) for the earlier actual SmolVLM runs and [deployment instructions](vercel-deployment.md). No fresh model-quality benchmark or hosted Vercel smoke is claimed here.
