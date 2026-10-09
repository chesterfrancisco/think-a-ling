# Animated Ling and guided mode navigation

9 October 2026. UI-only enhancement of the existing local AI application; no inference model, endpoint, detector, OCR worker or evidence-validation changes.

## What changed

- A dark, full-screen think-a-ling splash waits for a user tap anywhere, or keyboard activation. It never advances on its own. The lime bar animates for a 600ms visual transition **after** activation; it does not represent model loading. Reduced-motion skips that transition.
- Four violet story screens with white text and local SVG illustrations: Ling holding a cable beside a laptop, reading a product label, reading a book, and inspecting a cable with a magnifying glass. Ling bobs, blinks and moves the held prop; text enters gently. No remote images, raster sprite downloads, fonts or animation dependencies were added.
- The story has Next, Back, direct step buttons, Skip and finish. Completion is remembered under `think-a-ling-story-v2`; old v1 visitors see the revised story once. A fresh app load still waits at the splash. **Meet Ling again** replays the story. Storage denial leaves the story usable and skippable. The animation respects reduced-motion, headings receive focus on step changes, and controls support keyboard navigation.
- Removed the dashboard's long promotional description and the local-only “Private AI on this computer” strip. The help dialog, privacy badge/footer and production-runtime limitation notice remain available.
- Every mode-button click opens and scrolls to the chat, including desktop, an already-open chat, and the currently selected mode. A lime highlight under “Hello, possibilities” names the selected mode and explains the next step.
- Editable question starters use the **current saved scene**: evidence-linked object names, user corrections, recorded affordances, visible issues, and actual OCR when present. They are deterministic UI questions, not generated AI answers or asserted findings. No new inference request is made when changing modes or selecting a starter. The user edits the question and presses Ask Ling to send it through the existing intent engine.
- The question form appears before previous answers. Answer badges retain their original mode, so an old Understand answer is not presented as a new Check result. Existing answers, follow-ups, cancel/retry and scene reuse remain intact.

## Files

- `src/components/LingStory.tsx`, `LingStoryArt.tsx`, `LingStory.css`: splash, story state, animated poses and responsive styles.
- `src/services/storyPreference.ts`: updated introduction preference version.
- `src/App.tsx`, `src/SimpleExperience.css`: dashboard simplification and repeatable chat scrolling.
- `src/components/ReasoningPanel.tsx`, `src/services/sceneSuggestions.ts`: selected mode, scene-derived editable starters and answer context.
- `scripts/scene-suggestions.test.mjs`, `validate-ling-story-navigation.js`: grounding-boundary unit checks and new browser checks.
- Existing story/refinement/regression scripts now activate the splash before testing the application; inference assertions are preserved.

## Actual validation

- `npm run build`: passed, all 17 local AI assets verified. Production JS 460.30 kB / gzip 142.62 kB; CSS 79.65 kB / gzip 16.82 kB.
- `npm run lint`: passed with no warnings.
- `npm run test`: **32 passed**, including corrected-name, OCR eligibility, missing-evidence, person-only, empty-scene and bounded-question cases for the new starters.
- `validate-ling-story-navigation`: passed on Chrome 153. Splash stays without input; outside-logo tap and keyboard activation work; four poses animate; Back/Next/direct steps/skip/finish/replay work; reduced-motion stops animation; layouts fit 1280, 390 and 320px. All four modes and repeated same-mode clicks scroll to chat. Scene-derived questions fill/focus the input without inference; one submitted question reuses the scene with a text-only request. Zero external requests and page errors.
- `validate-ling-refinement`: passed with real four-object detection, unchanged measured boxes, correction/undo, stale-answer clearing, text-only context reuse and clearer-photo replacement.
- `validate-milestone1`: passed on the production build, with actual detection/OCR, external-network-blocked cold initialization, warmed full-browser-offline inference, responsive boxes, empty/corrupt inputs, missing assets, cleanup and retries. No physical Wi-Fi-disconnection claim.
- `validate-milestone3`: passed for all four modes, retained history, cancellation, unavailable-model handling/retry, mobile layouts and new-image reset.
- `validate-progressive`: passed for immediate browser results after intro, scene-before-answer rendering, cancellation and reinitialization.
- `validate-camera`: Chrome 153 and Edge 154 passed using a **file-backed camera input**, real getUserMedia/MediaPipe, throttling, capture bytes, source switching and track cleanup. Zero external requests; no continuous Gemma. The capture endpoint was intentionally failed by this regression test. This does not claim a new physical-camera test.

Gemma responses in these UI suites are **recorded HTTP replays**, not new model inference. No new long-running Gemma benchmark was performed; existing latency and semantic-citation limitations still apply. The browser detector's supported categories and accuracy are unchanged. Public deployments still cannot reach the developer's Ollama instance.

Screenshots under `test-results/`: `ling-splash-new.png`, `ling-story-workspace.png`, `ling-story-label.png`, `ling-story-study.png`, `ling-story-check.png`, `ling-story-new-390.png`, `ling-story-new-320.png`, and `ling-mode-navigation-{1280,390,320}.png`. Story illustrations are decorative. Scene screenshots use the recorded model replay and are UI evidence, not accuracy evidence.

Reproduce the new browser check:

```powershell
node scripts/run-browser-check.mjs validate-ling-story-navigation <path-to-playwright/index.mjs>
```

The test requires the development server on localhost:5173 and an existing Playwright installation. No app dependency was added for browser automation.
