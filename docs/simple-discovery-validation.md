# Simple discovery and Ling identity

9 October 2026. This is a presentation update; the local inference services, prompts, models, proxy/CSP and evidence validation were not changed.

## Consumer flow

1. Welcome shows the camera and photo choices with **Ling**, a lime/lilac mascot extending the original viewfinder-face logo. The same SVG character appears in scene summaries, chat and the floating Ask button. It is decorative branding, never a simulated result. No external images, new downloads or dependencies are required.
2. Upload/capture retains real local detection and OCR. Home, live camera and an uploaded photo with no scene analysis do not show the four reasoning modes.
3. **Analyze photo** starts the existing local scene workflow. A successful description appears prominently above the photo, followed by four explained choices: **Understand** (Explore), **Find something** (Find), **Check a concern** (Fix), **Get ideas** (Improve). Failed/cancelled analysis does not invent a description or show completed-scene actions.
4. The floating **Ask This Space / Close chat** button opens/closes the mounted chat without discarding its scene or history. Closing gives the image more room; original aspect ratio and measured hotspot coordinates are preserved. On phones opening chat brings it into view. Escape closes chat and restores focus to its toggle.
5. **Back** clears the current photo and analysis and returns to source selection. The upload icon changes the photo, including during a pending request. New source selection aborts old work. Back is a reset, not a multi-step undo history.
6. **Read text** opens a focused text dialog with actual OCR, empty/error states and retry. Explain text carries the request into the same chat; study suggestions remain available when OCR exists.

Removed from the consumer UI: the lower detection/OCR dashboard, raw coordinates/confidence lists, duplicate object inventories, shared-scene/model JSON, completed-question counters, resource-release button and the three promotional feature cards. No hidden developer JSON or production debug panel replaces them. Short AI disclosures and answer-specific supporting evidence/uncertainty remain available. Object questions display ordinary wording while the original object-specific evidence instructions are retained for inference.

## Validation

- Production build, 17 local-asset checks, lint and all 26 unit tests passed.
- Milestone 1 browser regression passed: real animal detection and exact box alignment, real OCR, blank/invalid files, missing model/language errors and retries, worker cleanup on reload, external requests blocked, warm full-browser-offline inference with zero extra requests. The removed release control is no longer a test dependency.
- Milestone 3 UI regression passed: no modes/dashboard/chat on home; no modes before analysis; one-click Analyze; actual response description above the image; zero `<pre>` JSON output; all four modes/history; floating close/open without scene loss; more image room with chat closed; 390/320px layouts; Back/source reset and errors/cancellation/retry.
- Progressive scan suite passed: real browser results independently of Gemma, early actual scene display during a held follow-up, cancellation during model initialization and real retry.
- Discovery suites passed: four real animal hotspots, portrait and empty image, box-relative alignment at 1280/390/320px, keyboard dismissal, compact cards, correct same-name-object separation and saved-answer reuse.
- Reasoning error suite passed: unavailable model/server, invalid/malformed/incomplete output, timeout, cancellation and retry.
- Chrome and Edge file-backed camera tests passed with real MediaPipe inference, capture bytes, source switching and track cleanup. Physical camera access was not revalidated.

Model responses in UI regression suites are **recorded HTTP replays**, explicitly isolated to tests. Actual MediaPipe/OCR run in those tests. This iteration does not claim a fresh Gemma benchmark or improved model accuracy. Long-running live-model scripts now read responses/context through test-only network observation (`scripts/observe-reasoning.js`) instead of requiring JSON in the consumer interface; the observer was exercised by the recorded-response UI suite. Those live suites were adapted but not rerun against Gemma in this design iteration.

Screenshots: `test-results/everyday-home-1280.png`, `everyday-home-390.png`, `milestone3-desktop-result.png`, `milestone3-mobile-390-sheet.png`, `interactions-card-390.png`. Result screenshots use the documented recorded responses; they are layout evidence, not new inference claims.

Changed UI files: `src/App.tsx`, `src/SimpleExperience.css`, `src/components/Mascot.tsx`, `src/components/ReasoningPanel.tsx`, `src/components/ObjectCard.tsx`. Existing regression scripts were updated for the new user-facing controls and assertions.

## Unchanged boundaries

Gemma still runs through the laptop-local development app and may take a minute or more. Public builds retain browser object detection and OCR but do not connect to the developer's Ollama. No cloud fallback or public exposure was added. Recognition can be wrong; a schema/evidence link is not proof of factual accuracy. English OCR, physical camera permissions and offline reload limitations remain as documented in earlier validation reports.
