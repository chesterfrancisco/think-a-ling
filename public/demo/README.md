# Example inputs

These are sample pictures, not recorded model answers. Selecting one opens the normal detection/OCR flow and prepares an editable question. Optional reasoning still requires the user to enable a local model and select Analyze.

- `plant.png`, `landmark.png`, `food.png`, `animal.png`: original AI-generated mock photographs created for this project on 2026-10-10 using OpenAI image generation during development. They depict a potted plant, the Eiffel Tower, a pasta dish, and a dog. No species, ingredients, location or other answer is injected into runtime scene evidence.
- `study-notes.png`: synthetic English study-note input rendered for this project. Tesseract reads the actual pixels each time; no transcript or answer is substituted.

All five inputs ship with the app and are included in its opt-in, hash-verified offline pack. Runtime inference and users' photos remain local; generating these development assets does not add a cloud inference service to the app.
