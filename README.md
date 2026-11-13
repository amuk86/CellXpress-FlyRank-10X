# CellXpress — FlyRank 10X

A staff-only repair workspace extending the original **CellXpress Job Agent**, imported from the supplied `cellxpress-job-agent-main (1).zip`. It preserves the Next.js Pages Router dashboard, photo/voice intake, Firebase Admin/Firestore persistence, Gemini integration, paper-ticket layout and prepared WhatsApp links.

The five features are staff sign-in, AI-assisted intake, repair tracking, PDF reports and prepared customer messages. The **10x time saving is a target, not a measured result**. See the [one-pager](docs/M1-One-Pager.md) and [submission overview](My%2010x%20Solution%20-%20Amukelani%20Mabunda.md).

## Run locally without cloud credentials

Requirements: Node.js 24 LTS, npm, and Java 21+ for the Firestore emulator. Ports 3000, 8080, 9099, 4400, 4500 and 9150 must be available. Initial installation and emulator download need internet access.

```bash
npm ci
cp .env.local.example .env.local
npm run emulators
```

Leave the emulators running. In a second terminal:

```bash
npm run seed
npm run dev
```

Open <http://localhost:3000>. Sign in with **staff@cellxpress.example** / **DemoRepair!2026**. These published credentials work only in the local demo emulator; never provision this account in a real Firebase project. The seed script creates four fictional repairs with blank phone numbers so they cannot contact anyone.

The emulator command imports `.emulator-data` when present and exports on graceful Ctrl+C. Stop with Ctrl+C and wait for export before restarting. `npm run seed` resets the four named seed repairs. `npm run seed:clean` removes only those four records and the demo staff account; it retains other jobs and usage logs. All emulator data is ignored by Git. The app requires both emulator hosts on loopback and a `demo-` project, preventing accidental emulator configuration against a cloud project.

Manual intake and reports work without Gemini. Optional AI requires your own API key and a model available to your account. There is no paid-service prerequisite for the local workflow; live AI quotas and availability depend on your account.

## Five-minute demo

1. Sign in and inspect the three dashboard columns and the over-48-hours flag.
2. Select **Create repair job**. Enter a fictional name, device and fault. Enter a fee or leave it unknown. Optionally add a photo or record a voice note (up to one minute), then extract a draft.
3. Check every AI value, missing-field warning and conflict against the source. Correct the form, check the staff review box, then save.
4. On the dashboard, open **Edit details**, record diagnosis and work done, and save. **Mark ready** requires recorded work. Payment remains separate.
5. Download a PDF. Mark payment **Paid** (requires a recorded fee) or explicitly **Waived**, then mark the job **Collected**. Collection is read-only afterward.
6. A ready job with an entered valid number offers **Review WhatsApp message**. It opens a prepared message; staff decide whether to send. Use fictional numbers only and do not send demo messages.
7. Refresh to verify persistence, then sign out. Reopening the dashboard returns you to login.

## Configure real Firebase and optional Gemini

Use a dedicated fictional-demo Firebase project. Enable Email/Password Authentication and create staff users manually in Firebase Console. Create a Firestore database and apply the deny-all [firestore.rules](firestore.rules): clients never access it directly; Admin SDK API routes enforce authorization.

In `.env.local`, remove `FIREBASE_AUTH_EMULATOR_HOST` and `FIRESTORE_EMULATOR_HOST`, set `NEXT_PUBLIC_USE_EMULATORS=false`, and replace the public Firebase fields with your web app configuration. Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` from a service account. Keep escaped `\n` characters in a quoted private key. Never put service account credentials in a `NEXT_PUBLIC_` variable or commit the downloaded JSON.

Grant an existing user the server-verified staff claim:

```bash
npm run staff:grant -- FIREBASE_USER_UID
# To revoke (also revokes refresh tokens):
npm run staff:grant -- FIREBASE_USER_UID --revoke
```

Users must sign out and back in after a grant. The server checks ID tokens with revocation checking and requires `staff === true`. Merely creating a Firebase account does not grant staff access. Add your hosting domain to Firebase Auth’s authorized domains if you deploy. Rebuild after changing public configuration because Next.js embeds it in client assets.

Set `GEMINI_API_KEY` on the server and optionally change `GEMINI_MODEL` (default `gemini-3.6-flash`). Confirm model and quota availability in your account. Set `GEMINI_INPUT_USD_PER_MILLION`, `GEMINI_OUTPUT_USD_PER_MILLION` and `GEMINI_PRICING_NOTE` only after checking your selected model/tier. Blank rates produce **unknown cost**, not a claim that calls are free. A documented free tier can be represented with explicit zero rates and a note naming that assumption.

AI returns schema-validated facts, evidence summaries, confidence scores and conflict warnings. Schema validation cannot prove the truth of the model’s evidence; staff must inspect the source. The service sends media to Gemini but does not persist or log raw media. `aiUsage` records successful provider responses, including rejected model output: model, timestamp, staff UID, provider token counts when supplied, outcome and explicit pricing assumptions. Estimates include input, candidate and reported thinking tokens; they exclude caching discounts, taxes and other charges. Provider/network failures without usage metadata do not assert token use or cost. A shared Firestore quota permits five extraction attempts per staff user per minute. Run `npm run usage` with the configured server credentials to inspect the latest ten metadata records (or inspect `aiUsage` in the Firebase Console for a cloud project).

Official references: [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth), [Gemini models](https://ai.google.dev/gemini-api/docs/models), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), [pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Verification

```bash
npm test
npm run build
```

Core tests are deterministic and mock Gemini; they require no cloud credentials. For HTTP integration and browser tests, start emulators, seed, and run the app in another terminal first:

```bash
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

To use installed Chrome instead of a downloaded browser: `CHROME_PATH=/path/to/chrome npm run test:e2e`. Tests use local emulators, create fictional records, and clean up their test jobs. Browser screenshots and failure traces go to ignored `test-results/`. Do not run these tests against real customer data. Use `npm run build` then `npm start` for the production server; do not run builds against the same `.next` directory as an active development server.

## Five backend concepts mapped to code

| Concept        | Implementation                                                | Evidence                                                                                                      |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| HTTP API       | `pages/api/jobs/`, `lib/validation.js`, `lib/errors.js`       | Required fields, strict numeric fees, 400/401/403/404/405/409 errors and transactional lifecycle checks       |
| Database       | `lib/firebaseAdmin.js`, `lib/jobs.js`                         | Firestore jobs, server timestamps, transactional updates; integration reads records through API and Admin SDK |
| Authentication | `pages/login.js`, `components/AuthProvider.js`, `lib/auth.js` | Firebase Email/Password; verified tokens and staff claim on every job/AI/PDF route                            |
| Reporting      | `pages/api/jobs/[id]/report.js`, `lib/report.js`              | Protected multi-page PDF using stored facts, explicit missing data and separate payment/collection states     |
| LLM            | `pages/api/extract.js`, `lib/gemini.js`, `lib/extraction.js`  | Media validation, schema output validation, mandatory review, shared quota and Firestore usage log            |

API summary: `GET/POST /api/jobs`, `GET /api/jobs/:id`, `PATCH /api/jobs/:id/status` (status, payment, fee, diagnosis or work done), `GET /api/jobs/:id/report`, `POST /api/extract`. All require `Authorization: Bearer <Firebase ID token>`. Lists return the latest 200 jobs. PDF timestamps are UTC. Standard PDF fonts replace unsupported Unicode characters with `?`; the original stored values remain intact.

See [verification and milestone evidence](docs/Verification.md). Live Firebase/Gemini checks, public repository publication and portal submission remain external steps. No payments integration, public registration, customer portal or automatic message sending is included.
