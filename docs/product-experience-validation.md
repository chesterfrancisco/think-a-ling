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
