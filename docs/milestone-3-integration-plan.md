# Milestone 3 integration plan

Audit date: 2026-10-09. Target: `C:\xampp\htdocs\thing-a-ling`. Read-only design reference: `C:\xampp\htdocs\thing-a-ling-figma`.

## A. Audit

The Figma Make export is React 19 + TypeScript + Vite 8. It declares Lucide icons and Tailwind 4, but the design is predominantly custom CSS. There is no router: one App component uses local state for splash, camera, scanning, objects, Find, Fix, Improve, questions, responses and errors. Brand is an inline SVG component. All screens and demo data are in `src/App.tsx`; `src/index.css` contains the complete visual system and responsive overrides. No bundled image/font assets exist. A room image is fetched from Unsplash and DM Sans/Manrope from Google Fonts.

The final token overrides use ink `#0f1012`, lime `#c6f432`, lilac `#b4a2ff`, purple `#7d66f0` and canvas `#f3f3f1`. Rounded 24–30px viewfinder/sheets, dark active mode buttons, lime shutter, glass controls and Lucide icons are the principal visual elements. Desktop has a header, intro, viewfinder and bottom navigation; <=640px uses an edge-to-edge viewfinder with bottom navigation/sheets. Motion includes scans, card entrance and reduced-motion overrides.

The export's Vite config also includes Figma site configuration, error-overlay replay, React refresh fallback and Make story-kit plugins, an `@` alias, optional environment-controlled base URL and a default `0.0.0.0:8443` listener. None of that hosting infrastructure is copied: the existing app keeps its restricted loopback development config. The export's site plugin can inject analytics/custom scripts; it is not part of the integrated application. Both entrypoints mount React in StrictMode.

Prototype interactions include uploads, camera preview, speech recognition, fake timed scans, hardcoded object hotspots, keyword-based Find, fixed defect lists, generic answers, save toggles, fake positioning guides, fullscreen and help. All fabricated results, timers, coordinates, severity badges and safety-like claims must be removed. Browser speech may use a remote service and will not be carried into the local-only MVP. Live camera is not essential to the requested upload workflow and will remain deferred; no dead camera/mic controls will be shown.

The working app uses React state/refs with generation guards and abort controllers, without a global state library/router. App owns validated image URLs, reusable MediaPipe/Tesseract service instances, progress, results and disposal. ImagePreview maps original pixel coordinates into an SVG viewBox. ReasoningPanel owns the shared scene and bounded follow-up history. SceneAnalysis/VisualObject/OCRText/Evidence/UserIntent/ActionSuggestion types are in `src/types/scene.ts`.

`sceneAnalysis.ts` reuses existing detection/OCR, then calls Gemma once with actual pixels; `scene.ts` preserves provenance and boxes. `intentEngine.ts` answers subsequent goals from the same scene. `reasoning.ts` and `intent.ts` enforce schemas, evidence IDs and OCR phrase matching for displayed study answers. `ollama.ts` handles local chat transport, errors, cancellation and timeout. Vite restricts the proxy to loopback development; production reasoning is disabled. CSP blocks external MediaPipe telemetry. These services, safeguards and AI assets will remain unchanged.

## B–C. Integration mapping

| Figma element | Reuse/adaptation | Real connection |
| --- | --- | --- |
| Brand, header, introduction | Reuse SVG/markup and design styling | Home returns focus to the viewfinder without silently deleting analysis |
| Viewfinder, glass toolbar, shutter | Reuse visual treatment; contain the original image rather than crop/pan it | Validated local upload, original ImagePreview, real boxes, fullscreen |
| Demo room and splash | Replace demo scene with branded empty upload state; avoid timed loading splash | No claims/results before an upload and real inference |
| Four-mode bottom navigation | Reuse labels, icons, active style | Controls existing ReasoningPanel mode; scene/history persist |
| Result sheet, cards, query field | Adapt existing validated result renderer to Figma sheet styles | Shared scene, natural-language goals, same-scene follow-ups, evidence, uncertainty, OCR cards |
| Object hotspots | Use existing real box overlay and selectable detection/object entries | Object question prefill only; Gemma labels never receive coordinates |
| Scan animation/status | Indeterminate visual feedback tied to actual request state | Actual engine progress, elapsed time, Cancel, Retry |
| Find/Fix/Improve claims | Remove all prototype outputs | Existing model responses, zero issues/no supported result are valid |
| Help and privacy text | Reuse modal design with accessible native dialog | Explain browser detection/OCR vs local Ollama and production limitation |
| Detection/OCR controls | Style as supporting result cards below the viewfinder | Preserve independent offline workflows, outputs, retry and resource release |

Reuse installed Lucide, React and CSS; no runtime packages or router are needed. Copy the exported stylesheet locally, remove remote imports, and add scoped integration overrides. Host the two fonts locally if download succeeds; retain system fallbacks. Do not copy demo data, remote image URLs, cloud-capable voice input or Figma development plugins.

Keep the current lifecycle and service architecture. Extend ReasoningPanel only for external navigation and question prefill; do not replace the reasoning engine. Preserve original test selectors/controls where practical. Mobile may scroll to the supporting browser-engine cards, rather than hide this working functionality behind the prototype's locked viewport.

## D. Validation

1. Record SHA-256 of working services/assets and compare after integration.
2. Build, lint, existing schema/scene tests and preserved Milestone 1 browser regression checks. Implementation note: the suite's two global SVG-rectangle selectors were narrowed to the image overlay so new Figma logo/icon rectangles are not counted as detections; no inference assertions were removed.
3. Existing reasoning error suite; additional desktop/mobile navigation, upload, box alignment, OCR, accessible controls, help, fullscreen handling and cancellation checks.
4. Use saved actual Milestone 2 inference responses only inside automated UI replay tests to check all modes and evidence without repeated slow generations. Clearly label replay as UI validation, not a new model benchmark. No test responses enter production code.
5. Check no external requests, no public proxy, no horizontal overflow, and inspect desktop/mobile screenshots. A new lengthy Gemma benchmark is unnecessary if services and payload logic are unchanged.

## E. Delivery

Document actual checks, visual deviations, deferred camera/voice/save/spatial-guide features, known model limitations and the local Ollama deployment restriction. Prioritize the essential uploaded-image workflow for the 11 PM demo.
