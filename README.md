# RecoverAI

> Razorpay AI Buildathon · Track 03 — AI Revenue Recovery

RecoverAI is a bounded revenue-recovery agent for failed subscription renewals.
It receives a failed payment, diagnoses the failure, chooses a safe next action,
simulates execution, and records the complete decision trail.

## The one-sentence problem

Subscription businesses lose recoverable revenue when renewal failures are handled
with generic retries instead of failure-aware, limited, and auditable interventions.

## MVP closed loop

`failure -> diagnosis -> policy decision -> guarded action -> outcome -> audit + metrics`

The MVP deliberately simulates payment retries and customer messages. No real charge
or message is sent. An external provider can later replace the simulator behind the
same action-executor interface.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Git

No Razorpay account or credentials are required for the local synthetic demo.

## Clone and run

```bash
git clone <PUBLIC_REPOSITORY_URL>
cd revenue-recovery-ai
npm install
npm run build
npm test
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:3001`.

The public repository URL is intentionally a placeholder until the prepared local Git
repository is published. On Windows PowerShell, the commands are the same.

### Environment setup

Copy `.env.example` to `.env` and replace the development webhook secret before
connecting an external webhook. The local dashboard demo works without this step and
uses a clearly identified development-only fallback secret.

Never commit `.env`, a Razorpay key secret, or a production webhook secret.

## Available commands

| Command | Purpose |
|---|---|
| `npm install` | Install all workspace dependencies |
| `npm run dev` | Run the React dashboard and Express API |
| `npm run build` | Compile all packages and create the production web build |
| `npm test` | Run decision, evaluation and webhook-security tests |

## Workspace structure

```text
revenue-recovery-ai/
├── shared/   # Domain contracts used by browser and server
├── server/   # API, decisions, guardrails, webhooks, storage and tests
├── web/      # React operator dashboard
├── ARCHITECTURE.md
├── PANEL_NOTES.md
└── SUBMISSION_DRAFT.md
```

## Demo walkthrough

1. Click **Send test failure** to ingest a signed Razorpay-style event.
2. Inspect the new case's diagnosis, confidence, policy checks and audit timeline.
3. Click **Run recovery** to execute its bounded simulated action.
4. Click **Reset batch**, then **Run pending batch** to measure the 50-case outcome.
5. Review the separate held-out evaluation for accuracy and unsafe automation.

The queue includes status filters, search and progressive loading so the complete
batch remains usable during a short panel demonstration.

### Return to a clean demonstration

Click **Reset batch** to restore 50 pending synthetic cases, clear accepted webhook
event IDs and return recovered revenue to zero. Runtime state is stored locally in
`server/data/recovery-store.json`; this generated file is excluded from Git.

## Verified results

| Evidence | Result |
|---|---:|
| Synthetic recovery cases | 50 |
| Simulated recovered payments | 22 |
| Simulated revenue restored | ₹46,378 |
| Human escalations | 11 |
| Safely stopped cases | 8 |
| Held-out labelled scenarios | 40 |
| Exact-action accuracy | 100% |
| Unsafe automations | 0 |
| Automated tests | 10 passing |

All customers, payments, recovered revenue and evaluation labels are synthetic. The
application never presents simulated money as production revenue.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Panel defence notes](PANEL_NOTES.md)
- [Submission draft](SUBMISSION_DRAFT.md)

## Safety rules

- Never retry permanent failures such as a lost/stolen card.
- Never exceed two automatic attempts for the same subscription.
- Keep at least 24 hours between retries.
- Low-confidence diagnoses are escalated for human review.
- Every recommendation and execution is logged with its reason.

## API surface

| Method and path | Purpose |
|---|---|
| `GET /api/cases` | List recovery cases |
| `GET /api/cases/:id/audit` | Read one case's audit timeline |
| `POST /api/cases/:id/process` | Process one pending case |
| `POST /api/cases/process-batch` | Process every pending case |
| `POST /api/cases/reset` | Restore the synthetic demonstration batch |
| `GET /api/metrics` | Read recovery metrics |
| `GET /api/evaluation` | Read held-out decision-quality results |
| `POST /api/webhooks/razorpay` | Receive a signed Razorpay-style webhook |
| `POST /api/demo/razorpay-failure` | Generate a safe local signed test event |

## Razorpay Test Mode status

Razorpay Test Mode is **not connected yet**. No Razorpay API key ID, API key secret or
merchant credential was obtained for this repository.

The current integration implements the server-side `payment.failed` webhook contract:
raw-body HMAC-SHA256 signature validation, provider-field normalization and persistent
event-ID idempotency. The dashboard's **Send test failure** control exercises that same
code using a locally generated signed event.

To validate genuine Razorpay Test Mode delivery:

1. The Razorpay account Owner or Admin enables Test Mode and generates Test API keys
   from **Account & Settings → API Keys**. Keep the key secret outside source control.
2. Deploy RecoverAI to a public HTTPS address.
3. Set `RAZORPAY_WEBHOOK_SECRET` in the hosted server environment.
4. In Razorpay Test Mode, add `https://<host>/api/webhooks/razorpay` as a webhook,
   choose the same webhook secret and subscribe to `payment.failed`.
5. Use a separate Razorpay Test Mode checkout/order flow to trigger a test failure.
6. Confirm the accepted event creates exactly one case and that replaying the same
   event ID does not create a duplicate.

The current project does not create Razorpay orders or payments, so Test API keys are
not consumed by the code yet. They should be added only when an outbound Razorpay API
adapter is implemented. Test Mode still uses simulated payments—no real money moves.

Official references:

- [Generate Razorpay Test Mode API keys](https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/)
- [Understand Test and Live modes](https://razorpay.com/docs/payments/dashboard/test-live-modes/)
- [Validate and test Razorpay webhooks](https://razorpay.com/docs/webhooks/validate-test/)

## Day 1 architecture

- `shared`: domain contracts used by both client and API.
- `server`: in-memory repository, decision engine, guardrails, executor, metrics API.
- `web`: operator dashboard showing failures, recommendations, outcomes, and KPIs.

Day 1 began with an in-memory repository to prove the vertical slice. Day 2 replaces
that temporary boundary with a durable local store and a reproducible evaluation batch.

## Day 2 evaluation batch

RecoverAI now persists cases and audit events to a local JSON store and seeds a
50-case synthetic evaluation batch. Operators can process every pending case in one
bounded run, inspect the batch outcome, restart the server without losing results,
and reset the demonstration dataset for another reproducible run.

## Day 3 Razorpay webhook boundary

The API exposes a Razorpay-compatible `payment.failed` webhook endpoint. It validates
the HMAC-SHA256 signature against the unmodified request body, maps provider failure
details into RecoverAI's domain model, and records each `x-razorpay-event-id` in the
persistent idempotency ledger so duplicate deliveries cannot create duplicate cases.
The development fallback secret is test-only; real test-mode delivery uses the
`RAZORPAY_WEBHOOK_SECRET` environment variable.

The dashboard's **Send test failure** control creates a signed local event and routes
it through the same verification and ingestion path. It is a safe demo fixture, not
a replacement for Razorpay test-mode delivery.

## Day 4 decision evaluation

A separate 40-scenario labelled synthetic set evaluates exact recommended-action
accuracy and unsafe automation. It includes retry-limit and cooldown boundary cases,
and reports every mismatch rather than hiding exceptions. This benchmark is separate
from the 50-case business-value batch, so recovery metrics and decision-quality metrics
remain distinct.
