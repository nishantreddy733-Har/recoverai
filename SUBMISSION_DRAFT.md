# RecoverAI — Razorpay AI Buildathon Submission Draft

## Track

AI Revenue Recovery

## One-line pitch

RecoverAI is a bounded, explainable agent that diagnoses failed subscription renewals,
chooses a safe intervention, executes a simulated recovery workflow, and records every
decision and outcome for audit.

## Problem

Subscription payment failures are not interchangeable. A temporary balance failure may
benefit from a delayed retry, while an expired or stolen card must follow a different path.
Generic retry logic loses recoverable revenue and can create unsafe customer experiences.

## Solution

RecoverAI closes the loop from failure detection to measurable outcome:

1. Accept a signed Razorpay-style `payment.failed` event.
2. Map provider context into a normalized failure diagnosis.
3. Recommend a recovery action with a confidence score and explanation.
4. Apply deterministic confidence, attempt-limit, cooldown and permanent-failure guardrails.
5. Simulate the approved action without moving real money or contacting customers.
6. Persist the case, outcome, revenue metrics and complete audit trail.

## Meaningful use of AI

The `DecisionEngine` interface is the intelligence boundary. The current submission uses
an explainable rules-based baseline so behaviour is testable and measurable. A learned
classifier or LLM can later implement the same interface for unstructured provider and
customer context. Model recommendations never bypass deterministic financial guardrails.

## Verified evidence

- 50-case synthetic recovery batch processed end to end.
- 22 simulated payments recovered, restoring ₹46,378.
- 11 cases escalated for human review.
- 8 unsafe cases stopped.
- 40/40 exact actions on a separate labelled synthetic evaluation set.
- 0 unsafe automations on lost, stolen or ambiguous scenarios.
- Valid signed webhook accepted, duplicate ignored, forged signature rejected.
- 10 automated tests passing.

## Safety and reliability

- Raw-body HMAC-SHA256 Razorpay webhook verification.
- Persistent idempotency ledger keyed by the Razorpay event ID.
- Maximum two automatic retry attempts.
- Minimum 24-hour retry gap.
- Automation requires at least 70% decision confidence.
- Lost or stolen payment credentials are never retried.
- Unknown failures are escalated instead of guessed.
- Every failure, decision, action and outcome is auditable.

## Architecture

```text
Razorpay-style webhook
        |
        v
Signature verification -> Event idempotency ledger
        |
        v
Normalized recovery case -> Explainable decision engine
        |                              |
        |                              v
        |                    Deterministic guardrails
        |                              |
        v                              v
Persistent store <- Simulated executor -> Outcome metrics
        |
        v
React operator dashboard + case explanation + audit timeline
```

## Technology

- React and TypeScript operator dashboard
- Express and TypeScript API
- Shared TypeScript domain contracts
- Durable local JSON prototype store
- Vitest automated evaluation and safety tests

## Honest limitations

- Recovery actions and customer messages are simulated.
- Evaluation and recovery batches use synthetic data.
- The intelligence layer is currently a rules baseline, not a trained model.
- The local JSON store must be replaced with a transactional database for production.
- Real Razorpay test-mode credentials and public webhook hosting are not connected yet.
- Production execution also needs a durable queue, observability and customer consent policy.

## Five-minute demonstration outline

1. Explain why generic retries are unsafe.
2. Send a signed Razorpay test failure and show the new case.
3. Run its recovery and explain the diagnosis, confidence and guardrails.
4. Show the audit timeline and duplicate-event protection.
5. Run the 50-case batch and show measured recovered money and exceptions.
6. Show the held-out decision evaluation and state the limitations honestly.

## Submission fields still required

- Candidate name and contact details
- Public repository URL
- Hosted demonstration URL
- Five-minute video URL
- Final architecture image or PDF
- Any application-form-specific short answers
