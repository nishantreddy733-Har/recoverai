# Panel defence notes

## Why this problem?

Failed renewals are not all the same. Retrying an insufficient-funds failure can
recover revenue, but retrying a lost card is unsafe. RecoverAI makes a reasoned,
bounded decision and records whether it worked.

## Where is the AI?

The `DecisionEngine` is the intelligence boundary. Day 1 uses an explainable
rules-based baseline because its results are testable and it creates benchmark
behavior. A classifier or LLM can later implement the same interface to interpret
unstructured gateway/customer context. Independent guardrails validate every
proposed action, regardless of which model produced it.

## Why not let an LLM retry payments directly?

Probabilistic model output must not directly trigger financial actions. The model
may diagnose and recommend; deterministic policy enforces confidence thresholds,
attempt limits, cooldowns, and permanent-failure blocks before execution.

## What is real and what is simulated?

The complete orchestration, decisions, guardrails, audit trail, API, UI, and metrics
are real code. Payment retries and outbound messages are explicitly simulated because
the prototype has no merchant credentials or consenting customers.

## Metrics we will report

- Recovered value and recovery rate (recovered / revenue at risk)
- Cases processed, automatic actions, and human escalations
- Decision accuracy on a labeled test set (next milestone)
- Attempts per recovered payment and guardrail violations prevented (next milestone)

## Likely questions

1. **How do you prevent duplicate charges?** Idempotency keys per case/action and a
   persistent action ledger will be added before a real provider integration.
2. **How will this scale?** Webhook ingestion -> durable queue -> stateless workers;
   the MVP keeps these responsibilities separate even though it runs in one service.
3. **Why rules first?** They form a safe benchmark and make failures inspectable.
4. **What happens at low confidence?** The 70% policy threshold forces human review.
5. **How do you prove value?** Run a labeled scenario set and publish both recovered
   value and unresolved/blocked cases, not only successful demos.
