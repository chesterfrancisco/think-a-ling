# Test image provenance

- `portrait.jpg`: public Google MediaPipe sample asset, downloaded for Milestone 3.2 single-person hotspot checks: https://storage.googleapis.com/mediapipe-assets/portrait.jpg. Test input only; predictions always come from the local detector.

- `study-notes.png`: locally rendered printed study input. Text: `STUDY NOTES`, `Photosynthesis uses light to make food.`, `Plants take in carbon dioxide and release oxygen.`, `Chlorophyll gives leaves their green color.` Generated with System.Drawing. All OCR, explanation and card outputs are actual local inference.
- `product-label.png`: locally rendered fictional surface-cleaner label with explicit warnings about children, bleach and ventilation. Used to test reading and explaining only visible warnings; it is not a real product or medical label.

- `desk.jpg`: supplied in the workspace before this task; preserved unchanged. Returned no detections at the configured 35% threshold.
- `cats-and-dogs.jpg`: downloaded from Google's MediaPipe sample assets: https://storage.googleapis.com/mediapipe-assets/cats_and_dogs.jpg. Used only as an inference fixture, not application content. Four real animal detections were observed.
- `ocr-test.png`: generated locally using Windows System.Drawing with black Arial text on a white 1200 × 360 canvas. Contents: `THING A LING LOCAL AI`, `Read this text without internet.`, `Invoice 12345 Total 250.00`. This is test input; recognized output always comes from Tesseract.
- `blank.png`: locally generated white 1200 × 360 PNG for empty-result checks.

See `docs/milestone-1-validation.md` for actual output. Test fixtures are not copied into the production app.
