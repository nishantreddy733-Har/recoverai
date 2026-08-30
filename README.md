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

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:3001`.

## Demo walkthrough

1. Click **Send test failure** to ingest a signed Razorpay-style event.
2. Inspect the new case's diagnosis, confidence, policy checks and audit timeline.
3. Click **Run recovery** to execute its bounded simulated action.
4. Click **Reset batch**, then **Run pending batch** to measure the 50-case outcome.
5. Review the separate held-out evaluation for accuracy and unsafe automation.

The queue includes status filters, search and progressive loading so the complete
batch remains usable during a short panel demonstration.

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
