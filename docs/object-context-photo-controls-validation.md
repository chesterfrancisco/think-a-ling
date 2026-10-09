# Object conversations, Ling introduction and photo controls

9 October 2026.

## Implemented

- The first story screen is now **Hi, I’m Ling!**, with a waving Ling and an explanation of think-a-ling. The four existing scenario screens follow it. The browser/runtime sentence below the story and the dashboard's “Private by design” navbar badge were removed. Privacy/help and public deployment limitations remain accessible elsewhere. Introduction preference is now `think-a-ling-story-v3`, so returning visitors see the new introduction once.
- Fixed the object-switching bug: the chat previously displayed the latest turn from the entire scene, even when a different hotspot was selected. Visible answers and history now use the exact scene object ID, resolved from the original detector name **and measured box**, not just a matching name. Whole-photo questions have their own history. Returning to the original object restores its saved response without another model call.
- Manually edited questions carry the selected `objectId` to the intent engine. The prompt limits context to that object, excludes other-object conversation history and retains the person privacy boundary. Unknown object IDs are rejected before inference. The full shared scene is still available as evidence; no second image pass is needed for another object.
- Switching objects cancels an active question and ignores late results. If the initial image analysis is still running, that shared work can finish, but the previous object's queued follow-up is suppressed. Cached answers are stored against the request's originating object, not whichever object is selected when it finishes.
- Object cards display actual MediaPipe **model confidence**, with an explicit note that this is not measured accuracy and objects may be missed or misidentified. For corrected labels, the confidence remains attached to the original AI guess. No percentage is invented for Gemma or user-provided names.
- The eye button hides/shows green boxes and hotspots in captured/uploaded photos and the live camera. Stored detections and coordinates are unchanged; toggling does not trigger inference.
- Expand now fullscreens the **photo stage only**. The complete image retains its aspect ratio, overlays are hidden, and a Close control exits. Browsers without the Fullscreen API get a full-window photo dialog with Escape/Close support.
- Analysis shows **percentage of completed steps**, not an estimated time/token percentage. With object detection and OCR complete, image understanding shows **67% (2/3)** while waiting for Gemma. Questions show **50% (1/2)** for saved-context-ready, followed by **100% of answer steps complete** after the response is received and schema-validated. The explanation states that steps take different amounts of time. No timer advances the percentage, and cancellation/error does not mark an unfinished answer complete. Existing actual Tesseract recognition progress is preserved.
- A dismissible **HERE'S THE PICTURE** ready notice appears after scene creation. Tapping it focuses and scrolls to the summary below the photo. It does not move the page while the user is typing, and label corrections do not reannounce the same scene.

## Validation

- `npm run build`: passed; all 17 local assets verified. JS 465.74 kB / gzip 144.27 kB, CSS 82.76 kB / gzip 17.39 kB.
- `npm run lint`: passed, no warnings.
- `npm run test`: **34 passed**. New checks verify object-specific vs whole-scene history isolation and that an unfinished model step cannot count as 100%.
- `validate-object-context`: passed with actual MediaPipe/OCR and recorded Gemma HTTP replay. Verified hide/show with unchanged boxes, native picture-only fullscreen, preserved aspect ratio, API-unavailable dialog fallback, Escape/Close, actual confidence display, summary navigation, same-label and different-label object switching, manual question IDs, cancellation, restored original answers and no repeated image request for object follow-ups. A separate image request held during object switching finished once without sending the previous object's queued question. Five HTTP requests total: two image requests for two separately selected images and three text-only requests. Zero external requests/page errors.
- `validate-ling-story-navigation`: passed for the new intro plus four scenarios, tap gate, navigation, remembered preference/replay, reduced-motion, mode scrolling, suggestions and 1280/390/320px layouts.
- `validate-ling-refinement` and `validate-discovery-reuse`: passed for correction/undo, exact boxes, scene reuse, history reset and responsive cards.
- `validate-milestone1`: passed on the production build with real detection/OCR, cold external-network-blocked startup, warmed full-browser-offline inference, coordinate mapping, missing-asset recovery and worker cleanup.
- `validate-milestone3`: passed for all modes, follow-up history, cancellation, errors/retry and responsive layouts.
- `validate-camera`: passed on Chrome 153 and Edge 154 using file-backed camera input and real MediaPipe/getUserMedia. Capture, source switching, throttling and track cleanup retained. No live-video Gemma calls. Capture API error handling uses an intentional HTTP failure in this suite; this is not a new physical-camera or live Gemma accuracy test.
- `git diff --check`: passed (Windows line-ending notices only).

The UI regression uses actual dog/cat detections, including two same-named dogs with different boxes. The reported door/person example was not newly photographed or benchmarked. Recorded Gemma replies test conversation routing, not new model answer quality. No new live Gemma inference or latency benchmark was run. Model misclassification, missing detector categories, slow local reasoning and semantic evidence-citation limitations remain; this change fixes state/routing and presentation, not those model limitations. A public site still cannot use the developer's localhost Ollama.

Key files: `App.tsx`, `ReasoningPanel.tsx`, `ObjectCard.tsx`, `ImagePreview.tsx`, `LiveCamera.tsx`, `AnalysisProgress.tsx`, `LingStory.tsx`, `LingStoryArt.tsx`, their styles, `types/scene.ts`, `services/intent.ts`, `intentEngine.ts`, `analysisProgress.ts`, and the updated story preference. Inference models, local assets, OCR and detector services were preserved.

Artifacts: `test-results/validate-object-context.json`, `ling-story-hello.png`, `picture-only-fullscreen.png`, `selected-object-clean-chat.png` and the existing regression reports. All illustrative/model-replay screenshots are UI evidence, not new accuracy measurements.
