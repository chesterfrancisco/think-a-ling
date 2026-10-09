# Think-a-ling! — product refinement validation

2026-10-09. **Everyday Action Intelligence. Point at anything. Know what to do.**

## Implemented

- Renamed the visible brand, page title/description, package metadata, intro, app labels, model identity, local proxy request header, test selectors and product documentation to Think-a-ling!. The existing Ling mark is now the browser favicon too. Physical workspace paths remain `C:\xampp\htdocs\thing-a-ling`; historical OCR test images and verbatim recorded model outputs remain unchanged as evidence.
- Revised the welcome and intro around everyday problems and practical next actions. The brand theme is **Your world. Full of possibilities.** Explore, Find, Fix, Improve and Ask This Space remain the shared-scene experiences. Public hosting still explains its detection/OCR-only boundary.
- Ling Actions now distinguish furniture, appliances, plants, documents, people and general objects. Actual OCR enables reading actions; document explanation/study actions require recognized text. A saved object goal offers a contextual follow-up. People retain the identity/personal-trait restrictions. Object-specific answers still use the original measured box and exact scene object ID.
- **Turn into steps** re-presents existing supported recommendations or FIX checks as an optional checklist. It does not generate another answer, parse arbitrary prose into tasks or invent substeps. Original recommendation text, caveats and evidence are retained. Missing citations, unknown objects/scenes, user-correction-only evidence, inferred-only evidence and non-answered results do not produce checklists.
- Checkboxes mean **marked done by you**, not AI-verified physical changes. Completion stays with the exact scene/object/goal/answer while the photo is open. Closing the panel preserves it; replacing the photo or refreshing clears it. No login, storage service or cloud sync was added.
- Mode navigation now moves directly to the question panel, fixing mobile smooth-scroll drift uncovered by the responsive regression test.

## Validation

- Build and lint passed. All 17 AI files in source and production output pass manifest/hash checks.
- 42 unit tests passed, including new evidence gating, recommendation preservation, exact scene/object/answer checklist keys and context-sensitive actions.
- `validate-product-experience` passed: opt-in checklist, check/uncheck, original uncertainty, expandable evidence, panel reopen, prior-answer retention, photo reset, empty recommendations, real OCR dialog, four mode labels and 1280/390/320px layout. One scene-image request and two text-only requests were replayed; checkbox interactions caused no inference.
- `validate-object-context` passed: original coordinates, marker controls/fullscreen, separate same-name object answers, cancellation on selection change and shared-scene reuse.
- `validate-ling-story-navigation` passed after fixing the mobile scroll issue: automatic opening animation, tap gate, five story pages, keyboard/reduced motion, all modes and editable suggestions.
- Production static smoke passed: actual MediaPipe detections, actual OCR, camera capture/review/retake with a file-backed camera, disabled Gemma actions, responsive cards and offline inference after initialization. No external/image POST requests or browser page errors.
- Existing Milestone 1 regressions and local proxy rejection checks passed.

For the UI-only reasoning checks, the browser replays previously recorded real Gemma output. These tests validate interaction/state/evidence handling, not fresh model quality. Detector and OCR inference are real. No new long-running Gemma benchmark or physical-camera test was performed. No recorded answers are imported by application code.

Useful local evidence: `test-results/validate-product-experience.json`, `ling-steps-390.png`, `validate-object-context.json`, `validate-ling-story-navigation.json`, `production-smoke.json`, `validate-milestone1.json`, and `security-audit.json`.

## Remaining limits

Public Vercel still cannot run the laptop's Ollama. Generated answers and Ling Steps need the local development app; public users have browser detection/OCR. Evidence references make recommendations traceable, not factually verified. The existing model can misidentify or miss objects. Offline reload is not supported.

Ling Pockets was intentionally left as a stretch goal. Checklists do not persist across reloads, and there is no automatic verification of physical work. The project folder and original Figma export folder have not been renamed, to keep the running development environment and references working.

## Photo interaction follow-up — 2026-10-09

- Changed the question panel greeting to **Hello, thinker!**.
- Navbar help now opens **About Think-a-ling**, including product purpose, Chester Francisco, the user-provided 24-hour hackathon origin, and the actual technology stack. The photo toolbar help opens separate navigation instructions with justified paragraphs and accurate local/public/offline limitations. Toolbar help is visible on mobile too.
- The footer now reads **Think-a-ling! · AppBuildersPH Hackathon Prototype · 2026**. Ling gently floats and waves on the dashboard, respecting reduced-motion preferences.
- **Change photo** visibly opens the file picker directly. Opening the picker preserves the current photo until a replacement is selected.
- **Add missing tag** lets users place a pin, name it, rename it or delete it. Pointer/touch placement and keyboard arrows + Enter are supported. Coordinates are image-relative points, so pins follow responsive resizing and fullscreen. They follow the same marker visibility control as detections.
- Lilac pins are explicitly **Added by you**. They are annotations, not AI detections: no invented bounding rectangle, confidence or observed evidence. They remain separate from detector output and the shared AI scene. Tagging does not retrain the detector or improve measured recognition accuracy. User pins are not supplied to Gemma as evidence. Existing corrections to detected labels still use their established unverified-user-evidence path.
- Tags survive a rescan of the same photo but clear on replacing the photo, returning home or reloading. No storage, uploads, accounts or new dependencies.

Validation: build and lint passed; **44 unit tests passed**. Source and built copies of all **17 AI assets** passed verification. The new `validate-photo-refinements` browser suite passed against the development app and production preview: separate dialogs, greeting/footer, animation/reduced motion, placement/edit/delete, invalid-label handling, repeated-label numbering, keyboard operation, resize/fullscreen alignment, marker visibility, rescan retention, direct replacement and empty-detection annotation. All exercised interactions made zero external or non-read requests and produced zero page errors.

Also reran successfully: `validate-product-experience`, `validate-object-context`, `validate-milestone1`, `test:production`, and `audit-local-security.mjs`. Production used real MediaPipe/OCR, a file-backed camera for capture/review/retake/cleanup, and new-image inference after networking was disabled. The reasoning UI regressions used recorded real Gemma responses, not fresh inference; no new model accuracy or physical-camera claim is made. These checks ran in headless Chrome 153, with production card checks at 1280/390/320px. Public Gemma remains unavailable by design; no deployment was performed by these local smoke tests.

Reproduce the focused checks with an existing Playwright installation (no application dependency needed):

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test
node scripts/run-browser-check.mjs validate-photo-refinements C:/path/to/playwright/index.mjs
# With npm run preview already serving the production build on port 4173:
$env:THINK_TEST_ORIGIN = 'http://127.0.0.1:4173'
node scripts/run-browser-check.mjs validate-photo-refinements C:/path/to/playwright/index.mjs
Remove-Item Env:THINK_TEST_ORIGIN
npm.cmd run test:production -- C:/path/to/playwright/index.mjs
```

Local reports/screenshots are under ignored `test-results/`; the focused report records its tested origin. Public fixture images, rather than the user's attached group/email photographs, were used for regression checks.
