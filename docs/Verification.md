# Verification and milestone evidence

Date: 13 November 2026. The supplied milestone PDF is the planning reference; its external submission and account-setup steps are not claimed as completed by code changes.

## Automated evidence

| Check                      | Coverage                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                 | 18 deterministic tests: validation, missing vs zero prices, lifecycle prerequisites, staff/token denial, actual route guards, PDF generation, long/Unicode report rendering, mocked Gemini success/failure, usage estimates, prepared messages                                                                                         |
| `npm run test:integration` | One complete test against real local Auth/Firestore emulators and the HTTP server: anonymous 401, invalid-token 401, non-staff 403, 404/405, invalid input, job create/list/get, Firestore facts, transaction rules, payment/collection, protected PDF, and stored AI usage with mocked provider                                       |
| `npm run test:e2e`         | Two Chrome browser tests: mocked AI draft population and review reset, plus the full workflow: login redirect, staff sign-in, reviewed manual intake, rejected readiness without work, details edit, ready/payment/collection, PDF download, persistence after reload, mobile overflow assertion and logout; no browser runtime errors |
| `npm run build`            | Optimized Next.js build of dashboard, intake, login and all API routes                                                                                                                                                                                                                                                                 |

Gemini is mocked in automated tests so verification never spends API quota or sends real media. Integration tests require seeded emulators and a running app. Test data is fictional and cleaned up. Screenshots are generated under ignored `test-results/`.

## Milestone status

- **M1:** one-pager written and committed before importing application code. Original project provenance and unmeasured target are explicit.
- **M2:** original application imported and extended. Staff labels, validated HTTP lifecycle and Firestore flow are implemented and checked against local emulators. The repository retains dashboard/intake and prepared messages.
- **M3:** all five concepts are implemented. Every job, AI and PDF route uses the staff guard. PDFs use stored facts. AI returns a reviewable draft and records usage metadata in Firestore. Core, integration and browser tests cover the concepts.
- **M4:** local emulator setup, fictional seeding/cleanup, staff provisioning, environment example and five-minute demo are documented. Production build and emulator workflow are verified locally. A reviewer still needs to reproduce setup on their own machine.
- **M5:** concept mapping, this evidence document and `My 10x Solution - Amukelani Mabunda.md` are prepared. Remote public visibility, push/publication and portal submission have not been performed or verified.

## Live checks still required

1. Configure a dedicated Firebase project, manually provision a staff user, grant the staff claim, and exercise the same flow against real Firestore/Auth. Verify access revocation with real tokens.
2. Configure Gemini, confirm model/quota availability, extract fictional media, review its facts, and inspect the resulting `aiUsage` document. Confirm pricing assumptions for that model/account. Automated tests establish handling of provider responses; they do not establish live extraction accuracy or availability.
3. Confirm the GitHub repository is public, push the reviewed commits, and submit its URL plus the overview. No portal submission or live presentation is performed by the app.
4. Measure the 10x target with matched fictional tasks and include correction/reporting time. No benchmark is claimed yet.

## Practical limits

The board shows the latest 200 records. Collected jobs are immutable through the API. Standard PDF fonts replace unsupported characters with `?` (original database values remain unchanged). AI schema/evidence checks cannot establish semantic truth; staff source review is essential. API rate limits cover AI attempts, not provider billing limits. Local emulator credentials and unsigned emulator tokens are strictly for the demo project; cloud configuration must remove emulator host variables. Deny-all client Firestore rules must be applied separately to a real project; the Admin SDK bypasses them and relies on the API staff guard.

## Dependency audit

The final `npm audit --omit=dev` reports zero vulnerabilities. The full development dependency tree reports 11 moderate advisories in Firebase emulator CLI dependencies; those tools are used locally and are excluded from production installs. The lockfile applies a patched `@grpc/grpc-js` 1.14.7 override, including the Firebase client SDK’s otherwise older transitive copy. Recheck advisories when updating dependencies.
