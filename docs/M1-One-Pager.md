# CellXpress — FlyRank 10x one-pager

Repair-shop staff capture device details, customer requests and prices across voice notes and handwritten records. Re-entering those facts takes time and makes it difficult to see what is repaired, paid and ready for collection. Creating a consistent repair report adds another repetitive task.

## People and intended improvement

CellXpress technicians and counter staff need a staff-only repair operations workspace. This project extends the original **CellXpress Job Agent** supplied in `cellxpress-job-agent-main (1).zip`; it preserves its Next.js dashboard, photo/voice intake, Firestore storage and prepared WhatsApp links.

**Target, not a measured result:** reduce capture and documentation time from several minutes to under a minute with AI-assisted intake and generated reports. To evaluate a 10x improvement, time the same fictional jobs manually and in the application, include review/correction and report creation, and compare median elapsed times. Record failures as well as successes; no speed claim is proven yet.

## Five concepts and five product features

| Backend concept | Implementation / product behavior |
| --- | --- |
| HTTP API endpoints | Validated intake, retrieval and safe lifecycle updates |
| Database | Persistent repair jobs in Firebase Firestore |
| Authentication | Firebase staff sign-in and server verification of authorized staff |
| Reporting | Downloadable PDF reports derived only from stored job facts |
| LLM integration | Gemini photo/voice extraction, schema checks and usage/cost metadata |

Product scope: staff login, AI-assisted intake, job dashboard/tracking, PDF reports, and prepared customer messages. Staff must review extracted facts before saving. Repair progress, payment and collection are recorded separately.

## Boundaries and delivery

No payments integration, public registration, customer portal or automatic WhatsApp sending. Use fictional customers and tooling that can run without paid accounts or a credit card. Secrets stay outside Git. Follow M1 definition → M2 walking skeleton → M3 concepts in sequence → M4 reproducible setup → M5 submission documentation. External account setup and any public submission remain separately verifiable steps.
