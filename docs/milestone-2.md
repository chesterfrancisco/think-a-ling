# Milestone 2 — shared visual intelligence and intent engine

Think-a-ling! — **Your world has possibilities. Just point and discover.**

## Local workflow

1. Start Ollama with the installed `gemma3:4b` model at http://127.0.0.1:11434.
2. Run `npm run dev` and open http://localhost:5173/.
3. Upload an image and click **Build shared scene**. This runs missing MediaPipe/OCR analysis, then one real Gemma image request. Detection/OCR results already available for that image are reused.
4. Select Explore, Find, Fix or Improve and enter what you want to accomplish. Click **Ask scene**.
5. Ask follow-ups or switch experiences. These requests use the same scene and recent conversation, without rerunning OCR, detection or Gemma image analysis.
6. Use **Reanalyze image** when you explicitly want to refresh visual analysis; it resets the scene conversation. Uploading another image starts a new scene.

Examples of goals (not canned answers):

- Workspace: “Help me use this desk for focused study.”
- Find: “Which of those objects can help me write notes?”
- Product label: “Explain the visible warnings on this label.”
- Study: “Make two flashcards strictly from the recognized notes.”
- Potential problems: “Which issues are visible, and what should I check?”

This is one scene pipeline and one intent engine. The four experiences guide the response focus; they do not maintain separate scene copies or separate applications.

## Shared scene and evidence

The original image and original MediaPipe bounding boxes stay in the existing preview.

- MediaPipe objects retain the exact returned pixel coordinates and confidence. These values are never inferred by Gemma.
- Gemma-only objects have no bounding box or confidence field. Matching object names from different engines are not automatically treated as the same physical object.
- OCR retains its original recognized text. Up to 4000 characters and 30 nonempty lines become evidence for reasoning.
- Gemma contributes a scene description, objects, possible purposes/affordances, visible issues when supported, and observed/inferred relationships.
- Every evidence entry retains its source and whether it is observed or inferred. “Observed” still means a model/detector/OCR observation, not independent verification.
- Partial detector/OCR failure is explicit in scene uncertainty. No replacement detections or text are generated.
- Goal responses distinguish model-described observations from inferred actions. Suggestions, issues and cards must cite evidence IDs actually present in the scene.
- Observations and visible issues may cite only evidence marked observed; suggestions may also cite inferred evidence.
- Study cards must cite OCR evidence; the schema disallows cards when no OCR evidence exists. A separate check matches each answer to a normalized phrase in actual OCR text. It corrects mismatched citation IDs for display and withholds unmatched cards, with an explicit notice. Original model JSON is retained unchanged. Text matching does not verify that a question and answer are semantically correct.
- Zero issues, no matching objects/actions and requests for more evidence are valid outcomes.
- Unrecognized object references from Gemma produce consistency warnings. No object or coordinate is invented to repair them.

Evidence references and uncertainties are visible beside results. The full shared scene and original schema-validated response JSON (before study citation verification) are available in disclosure panels for testing.

## Architecture

| File | Role |
| --- | --- |
| `src/types/scene.ts` | Reusable SceneAnalysis, VisualObject, OCRText, Evidence, UserIntent, ActionSuggestion, IntentResponse and SceneTurn contracts |
| `src/services/sceneAnalysis.ts` | Coordinates existing detection/OCR services, reuses available results, handles cancellation/disposal and performs one Gemma image pass |
| `src/services/scene.ts` | Combines outputs with explicit provenance; preserves original image metadata and real boxes without matching Gemma labels to them |
| `src/services/reasoning.ts` | Image-analysis schema, runtime validation, scene extraction prompt and consistency warnings |
| `src/services/intent.ts` | Goal-aware prompts and evidence-constrained response schema; workspace, label, study and check guidance use the same engine |
| `src/services/intentEngine.ts` | Answers a goal/follow-up from the cached scene and recent turns, without an image payload |
| `src/services/ollama.ts` | Shared local /api/chat transport, real base64 image preparation, cancellation, timeout, completion checks and error reporting |
| `src/components/ReasoningPanel.tsx` | Shared scene lifecycle, four experiences, goal input, follow-ups, evidence, study cards, errors and retry |
| `vite.config.ts` | Development-only loopback proxy and request guard; no production/preview proxy |

The Milestone 1 object detection, OCR, image loading, asset services, original image preview, assets and regression script were not rewritten. App.tsx connects successful scene-building detection/OCR results back into their original UI.

No runtime npm dependency was added.

## Local transport and deployment

`Browser → same-origin /local-ollama/api/chat → Vite development proxy → 127.0.0.1:11434/api/chat → gemma3:4b`

The first request includes actual uploaded pixels encoded as JPEG, at most 1280 pixels on the longest edge. This does not alter the original preview image. Subsequent requests contain structured scene data and recent conversation, with **no images field**.

The proxy target is fixed to loopback. It permits only POST /api/chat, checks incoming connection/Host/Origin and an application-specific header, and rejects public/LAN Vite binding. It closes the upstream request when the browser cancels or disconnects. Keep Ollama's listener local; do not tunnel this proxy publicly or set wildcard Ollama origins.

`preview.proxy` is explicitly empty. Shared reasoning is disabled in production builds; detection/OCR remain functional. A publicly deployed website cannot automatically reach the developer's localhost Ollama. This milestone is **local browser plus local Ollama**, not fully browser-local visual reasoning. A future packaged local companion or desktop distribution requires a separate design.

The existing same-origin connection CSP remains in effect, including external MediaPipe telemetry blocking. No cloud fallback, external image upload, or new telemetry is configured. The app retains scenes/results in memory only.

## Lifecycle, limits and failure handling

- Loading messages distinguish detection, OCR, scene extraction and intent reasoning. Every Ollama request has a 180-second timeout; initial browser-engine setup adds its own time.
- Cancel stops waiting and closes the request. Switching experiences cancels an in-flight intent while retaining the scene. New images clear the scene/history. Retry preserves available detection/OCR or the completed scene.
- The scene panel is disabled in production builds and explains the local service requirement.
- Images: existing JPEG/PNG/WebP/BMP, 20 MiB / 25 megapixel limits remain.
- Context: image calls use 4096 tokens; text-only goal calls use 8192. Up to 12 turns remain visible in memory; the latest three turns belonging to the same scene are summarized into the next prompt. Long purposes/answers/suggestion history are capped.
- The original OCR text stays visible even when the reasoning excerpt is capped.
- The local model may remain resident for fifteen minutes (updated in Milestone 3.1; previously five). **Release AI resources** releases the original browser engines; it does not unload Ollama or erase the cached scene.
- Follow-ups cannot inspect image details omitted from the shared scene. They should request more evidence rather than pretend a new image inspection occurred.
- JSON validation verifies structure, field sizes and evidence references, not factual truth or whether a citation actually supports a claim. Study answers receive an additional OCR-text match, but other claims and citations are not independently verified. Models can hallucinate descriptions, relationships, purposes, issues and explanations.
- Label guidance is restricted in the prompt to visible information and warnings; it is not a medical suitability, diagnosis or dosing tool. FIX never certifies safety or excludes hidden damage.
- Installed dependencies, assets and model require initial online setup. With local servers running, internet is not needed for inference. Browser-wide DevTools Offline also blocks localhost, so it prevents new Ollama requests while previously initialized Milestone 1 inference can still run.
- This remains an uploaded-image MVP. Camera input, Figma Make integration and the Milestone 3 redesign are not implemented.

## Validation commands

```powershell
npm run build
npm run lint
npm run test:reasoning
```

Browser suites export a function accepting a Playwright Page. An optional runner uses an existing Playwright installation and installed Chrome; it does not add a dependency:

```powershell
node scripts/run-browser-check.mjs validate-milestone1 <absolute-path-to-playwright/index.mjs>
node scripts/run-browser-check.mjs validate-milestone2 <absolute-path-to-playwright/index.mjs>
node scripts/run-browser-check.mjs validate-shared-scenarios <absolute-path-to-playwright/index.mjs>
node scripts/run-browser-check.mjs validate-reasoning-failures <absolute-path-to-playwright/index.mjs>
```

Start development on :5173 and production preview on :4173 before these checks. Reports and screenshots are written to ignored `test-results/`. Only the failure suite injects error responses; functional model tests use real local inference.

See [measured validation results](milestone-2-validation.md). References: [Ollama chat API](https://docs.ollama.com/api/chat), [structured output and vision](https://docs.ollama.com/capabilities/structured-outputs), [Vite proxy configuration](https://vite.dev/config/server-options).
