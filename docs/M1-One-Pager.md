# CellXpress — FlyRank 10x one-pager

This project began as a university assignment to find a business and solve one of its problems using an AI agent. The chosen business was an electronics repair shop at my university that used a handwritten book to record customers and required parts. The original agent listened to the technician and turned the repair details into a job record.

## People and intended improvement

CellXpress technicians and counter staff need a staff-only repair operations workspace. This project extends the original **CellXpress Job Agent** supplied in `cellxpress-job-agent-main (1).zip`; it preserves its Next.js dashboard, photo/voice intake, Firestore storage and prepared WhatsApp links.

**Practical value:** the shop has one operator and a low volume of customers, so the time-efficiency improvement over handwriting is modest. The main benefit is information that is easier to organize, find and update, with less reliance on a physical book that could be lost or damaged. A tenfold speed improvement remains an ambition, not a measured result. Future evaluation should assess record retrieval and management as well as timing the same fictional jobs manually and in the application, including review/correction and report creation.

## Five concepts and five product features

| Backend concept    | Implementation / product behavior                                    |
| ------------------ | -------------------------------------------------------------------- |
| HTTP API endpoints | Validated intake, retrieval and safe lifecycle updates               |
| Database           | Persistent repair jobs in Firebase Firestore                         |
| Authentication     | Firebase staff sign-in and server verification of authorized staff   |
| Reporting          | Downloadable PDF reports derived only from stored job facts          |
| LLM integration    | Gemini photo/voice extraction, schema checks and usage/cost metadata |

Product scope: staff login, AI-assisted intake, job dashboard/tracking, PDF reports, and prepared customer messages. Staff must review extracted facts before saving. Repair progress, payment and collection are recorded separately.

## Boundaries and delivery

No payments integration, public registration, customer portal or automatic WhatsApp sending. Use fictional customers and tooling that can run without paid accounts or a credit card. Secrets stay outside Git. Follow M1 definition → M2 walking skeleton → M3 concepts in sequence → M4 reproducible setup → M5 submission documentation. External account setup and any public submission remain separately verifiable steps.
