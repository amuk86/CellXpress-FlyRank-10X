# My 10x Solution - Amukelani Mabunda

## Problem and intended improvement

Repair-shop staff need to capture customer/device details, keep track of repairs, distinguish payment from collection, and produce a useful job report. Re-entering details from photos, voice notes and paper records creates avoidable work. CellXpress aims to reduce capture and documentation from several minutes to under a minute through AI-assisted intake and generated reports.

**The 10x improvement is a target, not a measured claim.** Evaluation should time the same fictional jobs manually and with the application, including corrections and report generation, and compare median times. No benchmark result is claimed in this submission.

## Implementation

This project extends the original CellXpress Job Agent supplied as a ZIP; it is not a replacement application. The original Next.js Pages Router dashboard, intake workflow, Firebase Admin/Firestore persistence, Gemini extraction and prepared WhatsApp links remain the foundation. The interface now identifies itself as a staff repair workspace.

The scope has five features: staff sign-in, AI-assisted intake, repair tracking, PDF reports and prepared customer messages. Staff manually review all captured facts. Repair completion does not imply payment: jobs move from in progress to ready for pickup to collected, with payment recorded separately. Work done is required before readiness, and payment must be recorded as paid or waived before collection.

## Five backend concepts

1. **HTTP endpoints:** Next.js API routes create/list/retrieve jobs, validate updates and return clear errors. Invalid input, missing jobs and illegal lifecycle changes are rejected.
2. **Database:** Firebase Firestore stores reviewed repair facts and timestamps. Transactions validate updates against the latest record, preventing concurrent requests from bypassing lifecycle rules.
3. **Authentication:** Firebase Email/Password signs in manually provisioned staff. Every Firebase Authentication account has staff access, with no separate custom claim required. Every protected API verifies an ID token and checks for revocation.
4. **Reporting:** A protected endpoint generates a downloadable PDF from a stored job, including customer/device, fault, diagnosis, work, fee, payment, progress and timestamps. Missing fields remain explicit; no diagnosis or price is invented.
5. **LLM integration:** Gemini receives a photo and/or voice note behind the API. Structured output and server validation reject malformed facts. Missing and conflicting information is flagged, staff review is mandatory, and Firestore records usage with model, time, available tokens and explicitly configured cost assumptions. Raw media and keys are not logged.

## Running and demonstrating

Use Node.js 24, npm and Java 21+. Run `npm ci`, copy `.env.local.example` to `.env.local`, and start `npm run emulators`. In a second terminal run `npm run seed` then `npm run dev`. Open localhost:3000 and use the local-only demo credentials in README. The local path needs no cloud credentials; optional live Gemini extraction requires your own key and available quota.

Demo: sign in → create a fictional repair → review facts → inspect dashboard → record work done → mark ready → download PDF → record payment → mark collected → sign out. WhatsApp links prepare a message for staff to review; they never send automatically.

Run `npm test` and `npm run build`. With emulators and the app running, run `npm run test:integration` and `npm run test:e2e` (install Playwright Chromium first). Evidence and practical limitations are in `docs/Verification.md`.

## Delivery boundaries

Only fictional seed/test customers are used. Secrets and emulator data are excluded from Git. There is no customer portal, payment processing or public staff registration. Publication of the public GitHub repository, live-provider verification and portal submission must still be completed and confirmed separately. The repository URL plus this overview form the submission; the ZIP is only the original source reference.
