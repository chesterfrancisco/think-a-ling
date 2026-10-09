# Offline, accounts, accessibility and risk review

Updated 2026-10-10. This is the current status; earlier milestone reports describe earlier builds.

## What is implemented and tested

- Explicit offline preparation, followed by a full page reload with browser networking disabled. Actual detection, English OCR, keyword lookup, recall practice, photo editing and device saves work afterward. This is a service-worker app cache, not a claim that a first visit works without internet or that PWA installation is implemented.
- Real SmolVLM image interpretation and a follow-up executed after an offline reload with its separate model cache prepared. The image run took 39.36 seconds on this laptop. Execution passed; reliable answer quality did not. It described a wooden desk, then answered that it could be used for anything. The latter is now rejected by a tested output guard. This narrow guard does not solve hallucination.
- Supabase SDK signup, password sign-in, recovery, sign-out, explicit history upload/list/delete and account deletion are implemented. Device saves remain available without login. There is no pretend account stored in localStorage; Supabase manages authentication tokens. Passwords are never saved by app code.
- Owner applied `supabase/migrations/202610090001_discoveries.sql` to project `think-a-ling` (`pyduoijdrfhjxsoseqgu`). Live probes confirm email signup is enabled, confirmation is required, and anonymous history reads/account deletion are denied. The production UI submitted one invalid login to the real provider, displayed its rejection, exited loading and handled offline retry.
- Successful signup/sign-in/upload/list/delete UI wiring passed with **simulated Supabase HTTP responses**. This does not establish email delivery, successful real-user login, cross-device sync or isolation between two real users. Complete the acceptance procedure below before declaring those verified.
- Crop, rotate, flip, brightness/contrast, preview/reset/apply; edits stay on-device. Applying produces a new image and clears old answers/tags before rescanning. Original files are unchanged. Edited long edge is capped at 2048 pixels; enhancement cannot recover missing detail.
- Ling 404 and render-error fallbacks, a skip link, native dialogs, keyboard-operable controls, labelled icons, larger reading text, stronger contrast and animation controls. Preferences persist locally and OS reduced-motion is respected. Axe found **zero violations** on the tested home, account, OCR/recall and photo-editor screens. This is not full WCAG certification, a screen-reader audit or a substitute for testing with disabled users.
- Desktop heading fits on one line; it wraps on phones. Ling stays centered at narrow widths. Voice icon appears only after a scene analysis; its tooltip describes it. Red cancel/error, green success and yellow warnings also use explanatory text.

## Account setup and acceptance

Local `.env.local` has the owner's public URL/publishable key and is gitignored. Vercel needs the same two variables under **Settings → Environment Variables → Production**, followed by a redeploy:

```dotenv
VITE_SUPABASE_URL=https://pyduoijdrfhjxsoseqgu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your public publishable key>
```

Never put a secret/service-role key in a `VITE_` variable. The build rejects privileged or malformed account keys before bundling. Public keys identify the project; database RLS controls access.

In Supabase Authentication → URL Configuration, set Site URL to `https://think-a-ling.vercel.app/`; allow that exact redirect plus `http://localhost:5173/` and `http://127.0.0.1:4173/` for local testing. Email callbacks return to `/`; no additional SPA route is required. Open confirmation/recovery links in the browser that started the flow because this app uses PKCE. After confirming, password sign-in can be used on another device. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

Check Authentication → Email/SMTP configuration before a public launch. Supabase's default email service is intended for testing and restricts recipients; arbitrary public signup needs a configured mail provider. SMTP, delivery, rate limits and CAPTCHA settings have not been inspected with administrator access here. Do not disable email confirmation merely to hide delivery problems. See [Supabase email delivery requirements](https://supabase.com/docs/guides/auth/auth-smtp).

The migration is intended to run once. It creates the history table with RLS, authenticated owner-only SELECT/INSERT/DELETE, a 100-record quota, a 200 KB payload limit and an authenticated function that deletes only the caller's account and cascades its history. There is no shared public history or update endpoint. Device history is separate (50 records, approximately four million JSON characters). Sync is manual, requires internet and does not silently queue uploads.

Real-user acceptance procedure:

1. In a regular browser, create account A with an email you control; confirm it and sign in. Check the reset-password flow separately.
2. Read the example study notes; explicitly Save this. In Saved, expand Choose device discoveries to sync and sync that note. Refresh account history.
3. On another device/browser, sign in to A and refresh account history. Confirm the same content/evidence appears without uploading a photo. Keep on this device makes an explicit local copy.
4. Create account B independently. Confirm it cannot list A's records. Using B's authenticated API client, attempt SELECT, DELETE and INSERT against A's owner ID; reads/deletes must affect no records and insert must fail. This is the required positive/two-user RLS test, not replaced by the anonymous checks.
5. Sign out while a history request is pending; A's results must not appear for B. Test expiry and loss of internet, then retry. Local saves must remain available.
6. Delete a synced test discovery and confirm the account copy disappears on the other device after refresh; its local copies remain. With a disposable account, test explicit account deletion and denial of subsequent access.

No valid user password, access token, email delivery or authenticated cross-device transaction was available to the agent. The app is connected locally, but those checks remain unverified. Production environment settings are configured. Commit `9e4df8e` was deployed to https://think-a-ling.vercel.app/ and its hosted smoke passed: configured account form, actual OCR, hash-verified offline pack, full offline reload with a new image and HTTP 404 fallback. This does not replace successful real-user account acceptance.

## A focused two-minute demonstration

Target user: **a student revisiting short printed English notes with unreliable connectivity**. Product category: **Personal assistants / Productivity**, demonstrated through an **Education** task. Computer vision is the enabling technology; privacy is a benefit. Accessibility is a design consideration, not a claim that this is a validated assistive-navigation product.

While online, build/deploy and choose **Use Think-a-ling offline → Prepare for offline**. Wait for ready (about 75 MiB, app/detection/OCR/fonts/example). Optional SmolVLM needs another approximately 374 MB and compatible WebGPU hardware. Prepare and verify both before the demo if you plan to use model reasoning. Keep a typed-input route available; do not depend on experimental speech.

1. Turn browser networking off and reload the page.
2. Open **First time? Try a study task → Try example study notes**. This loads an original example input, then runs real OCR; it does not replay a prepared answer.
3. Choose **Read text**; search `Photosynthesis`. Compare the returned line to the image.
4. Choose **Practice recall from these lines**; reveal the exact recognized text. These are verbatim recall cues, explicitly not generated explanations or fact verification.
5. Save the useful practice, reload and revisit **Saved** without reanalyzing. Show the preserved uncertainty. Reconnect only when demonstrating explicit account sync.

For richer reasoning use a specific English question, compare it with evidence and show an honest retry/limitation when the model is wrong. Gemma's existing structured recommendations and eligible Ling Steps remain in the local development app; SmolVLM does not fabricate equivalent structured evidence. A larger feature count does not substitute for this end-to-end useful task.

## Languages and mode selection

| Capability | Current support and limitation |
| --- | --- |
| Typed goals | Unicode input, up to 500 characters, one focused question at a time. Accepting characters does not establish language accuracy. |
| English answers | Primary tested path, still fallible. OCR retrieval is verbatim; generated answers are explicitly inferred. |
| Filipino/Tagalog answers | User-selectable language instruction, experimental. No representative native-language quality benchmark passed in this change. |
| Cebuano/Bisaya, Arabic, Korean | Not validated or promised. Prefer an English rephrasing and compare any model output to the original evidence. |
| Text reading | English Tesseract language data only. Latin-script words may appear, but accurate Tagalog/Cebuano OCR is not established; Arabic/Korean OCR packs are not installed. |
| Local speech | English browser speech pack only where supported. Simulated controls pass. Earlier real generated-audio tests returned no-speech/timeout; physical-mic accuracy, Tagalog and offline speech are unverified. No remote fallback. |
| Interface | English labels; this is not a fully translated multilingual UI. |

Explore is useful for explaining an observed item; Find needs a user goal and potentially relevant recorded objects; Fix needs a concern or evidence worth checking; Improve offers an optional better use. Modes are ranked using recorded context and intent, not silently removed based on a fallible guess. For crowded wiring, Fix/Improve can be prominent; Find could still be relevant if the user wants to locate a switch or label. A photo cannot certify electrical safety, infer hidden damage or prove overload. User-added tags and corrected labels remain unverified annotations, not fresh detector measurements.

## Risk register and mitigation

This lists the material risks identified in review, not every possible future bug.

| Risk / consequence | Mitigation implemented | Remaining procedure / limit |
| --- | --- | --- |
| Invented model details or useless advice | Inferred labels, evidence separation, blank-input check, format/repetition/blanket-answer rejection, conservative safety/identity responses | Inspect outputs for the demo task. These checks are incomplete; do not claim an accuracy rate. |
| Missing people/objects or wrong count | Real boxes/confidence preserved; manual missing tags clearly distinguished | Never present detector count as complete. Confidence is not accuracy. |
| OCR misreads, wrong digits or label instructions | Verbatim text, source comparison, crop/rotate/contrast and retry | English printed text only; verify important details manually. |
| Image/OCR prompt injection | Quoted OCR treated as data, bounded prompt context; generated text cannot execute app actions | Model may still follow malicious text. No autonomous real-world actions or trusted recommendations. |
| Old object's answer appears for a new object | Scene/object IDs, separate response keys, cancellation and late-result checks | Existing isolation tests retained; switching images clears context. |
| Manual tag treated as measured/verified | Separate annotation provenance; no borrowed confidence or generated boxes | User labels can be incorrect; do not retrain/invent evidence. |
| Unsupported or looping model output | Bounded generation, explicit errors, retry hints, cancel terminates worker | Safeguards do not ensure useful content. Use direct text tools when reasoning is weak. |
| Slow GPU/CPU, memory pressure or device loss | Optional model, WebGPU check, worker, deadlines and cancel; detection/OCR continue independently | Phone hardware and all browsers untested. Cold inference may take tens of seconds. |
| Estimated progress mistaken for real completion | Estimated label remains; 100% only after answer ready; requested plain waiting copy | No true model-token completion percentage is available. |
| Damaged/oversized photo or extreme crop | MIME/decode/20 MiB/25 MP validation; crop bounds and edited size cap | JPEG/PNG/WebP/BMP supported; HEIC/PDF are not. Editing may reduce OCR detail. |
| Callback from cancelled edit/inference | Active/generation guards discard late responses | Retake/new-photo paths reset the analysis. |
| Incorrect compressed OCR cache bytes | Verify both exact source gzip hash and exact known decompressed hash | Fix confirmed by full offline OCR after a preview server decompressed the language file. |
| Partial download or stale build cache | Build-version cache, SHA-256 checks, completion marker only after all files, resumable retry/cancel | New deployments need a new offline pack. Close old tabs before adopting an update; test the final deployed build. |
| Quota, eviction or cleared browser storage | Friendly storage errors; readiness check verifies expected cache entries; explicit saved-copy semantics | Offline availability is not permanent. Check before demo; clearing site data loses device saves/models/preferences. |
| No signal on first ever visit | Clear preparation requirement; prepared pack can reload offline | Assets cannot be downloaded without a connection. Service-worker-disabled/private modes may fail. |
| Sign-in/sync unavailable offline | Device features do not require login; network timeout and reconnect message | No offline account creation or queued automatic sync. |
| Cross-account data disclosure | Database owner RLS, no anon grants, no service key, per-user UI state, late-response guard | Anonymous-denial checks passed; two real users still need the acceptance test. |
| Public credential or privilege mistake | Only publishable/anon keys allowed; build fails on service-role/secret keys; env ignored | Never commit real privileged credentials. Rotate immediately if exposed elsewhere. |
| Signup email or recovery fails | Real provider responses, PKCE, no fake login, password reset UI | Set exact redirects and public SMTP; verify delivery, expiration and rate limits. |
| Account abuse or storage growth | 100 saves/owner, payload bound, authenticated operations, provider auth limits | Configure production mail and anti-abuse controls; CAPTCHA integration not included. |
| Untrusted saved HTML | React renders text; validates saved payload shape and length | Do not add raw HTML rendering. Saved claims retain original caveats. |
| Shared-device privacy | Explicit local saves/sync, no photo persistence, logout clears account view | Anyone with the browser profile can read local saves. Sign-out intentionally does not erase them. |
| Misleading “private/offline” promise | Help distinguishes local AI, hosting requests, explicit cloud text sync and required initial downloads | Synced text may be sensitive; it goes to Supabase on explicit action. |
| Inaccessible controls or distracting motion | Labels/tooltips/focus/skip link, keyboard controls, reduced motion, reading preferences, status words | Run manual screen-reader and disabled-user usability sessions; automated audits are incomplete. |
| Missing page/crash strands the user | Ling 404, Back link, React render-error boundary, static `404.html` | Asset 404s stay errors; hosting needs the built fallback deployed. |
| Two Vite servers overwrite the dependency cache | Account test server uses `node_modules/.vite-account-tests`; localhost was restarted and Tesseract is explicitly prebundled | Confirmed development failures were a stale dependency 504 and a first-photo optimizer reload; both were corrected and the browser regression then passed. Use `node scripts/serve-account-test.mjs` for account simulation. |
| Large initial JS bundle | AI model download remains optional, fonts local, explicit offline pack | Configured auth adds SDK size; build reports a >500 KB chunk warning. Further splitting is a performance opportunity, not a passing mobile-speed claim. |

## Judging criteria assessment

| Supplied criterion | Evidence and honest gap |
| --- | --- |
| Problem & usefulness — 25% | Student note lookup/recall/save/offline revisit is a concrete task. Actual OCR flow passes; interviews and measured learning benefit remain absent. |
| Local AI — 25% | MediaPipe, Tesseract, optional browser SmolVLM and local Gemma execute locally. Offline reload and real cached browser inference tested. Login/sync are secondary online services. |
| Technical execution — 20% | Build/lint/53 unit tests, production smoke, offline/crop/save regressions, live anonymous-denial and failed-login checks. Successful real-user account sync, device matrix and all fault cases remain unverified. |
| Innovation — 15% | From observation to useful actions, evidence and reusable notes; local inference enables private/offline use. No uniqueness or winning-score claim. |
| Product/demo quality — 15% | Coherent student flow, accessible controls and Ling branding. Must rehearse on the actual presentation device; speech and broad SmolVLM advice should not be the critical path. |

The screenshots allow secondary cloud services while meaningful inference runs locally. The implemented architecture fits that technical direction. Build-time eligibility, disclosure completeness and final scoring are organizer decisions; not all criteria can be certified from code. Disclose MediaPipe/EfficientDet, Tesseract English data, Transformers.js/SmolVLM/ONNX/WebGPU, Ollama/Gemma, browser speech, Supabase, React/Vite/Vercel and AI-assisted development. Do not present rule-based OCR retrieval or recall cues as generative AI.

Local evidence: `test-results/validate-hosted.json`, `validate-resilience.json`, `validate-offline-reasoning.json`, `validate-account-ui.json`, `validate-account-live.json`, `validate-pockets-layout.json`, `validate-voice-controls.json`, `production-smoke.json`, `security-audit.json`. These artifacts are excluded from Git/deployment because they may contain test inputs or temporary session details. See [deployment commands](vercel-deployment.md).
