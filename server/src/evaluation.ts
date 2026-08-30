import type { EvaluationReport, PaymentFailure, RecoveryAction } from "@recover-ai/shared";
import type { DecisionEngine } from "./decisionEngine.js";
import { applyGuardrails } from "./guardrails.js";

type LabeledScenario = { name: string; failure: PaymentFailure; expected: RecoveryAction };

const base = (id: string): PaymentFailure => ({
  id, subscriptionId: `eval_sub_${id}`, customerName: "Held-out synthetic customer",
  amount: 1499, currency: "INR", failureCode: "insufficient_funds",
  failedAt: "2026-08-28T10:00:00.000Z", previousAttempts: 0,
});

export function createHeldOutScenarios(): LabeledScenario[] {
  const templates: Array<Omit<LabeledScenario, "name">> = [
    { failure: { ...base("funds"), failureCode: "insufficient_funds" }, expected: "smart_retry" },
    { failure: { ...base("funds_limit"), failureCode: "insufficient_funds", previousAttempts: 2 }, expected: "human_review" },
    { failure: { ...base("funds_cooldown"), failureCode: "insufficient_funds", lastAttemptAt: new Date(Date.now() - 3_600_000).toISOString() }, expected: "stop" },
    { failure: { ...base("expired"), failureCode: "expired_card" }, expected: "request_payment_update" },
    { failure: { ...base("bank"), failureCode: "temporary_bank_error" }, expected: "smart_retry" },
    { failure: { ...base("bank_limit"), failureCode: "temporary_bank_error", previousAttempts: 2 }, expected: "human_review" },
    { failure: { ...base("lost"), failureCode: "lost_or_stolen_card" }, expected: "stop" },
    { failure: { ...base("unknown"), failureCode: "unknown" }, expected: "human_review" },
  ];
  return Array.from({ length: 5 }, (_, round) => templates.map((template, index) => ({
    ...template, name: `${template.failure.failureCode} variant ${round + 1}`,
    failure: { ...template.failure, id: `eval_${round}_${index}`, amount: 499 + round * 500 },
  }))).flat();
}

export function evaluateDecisionEngine(engine: DecisionEngine): EvaluationReport {
  const scenarios = createHeldOutScenarios();
  const actionBreakdown: Record<RecoveryAction, number> = { smart_retry: 0, request_payment_update: 0, send_reminder: 0, human_review: 0, stop: 0 };
  const exceptions: EvaluationReport["exceptions"] = [];
  let unsafeAutomationCount = 0;
  for (const scenario of scenarios) {
    const actual = applyGuardrails(scenario.failure, engine.decide(scenario.failure)).action;
    actionBreakdown[actual] += 1;
    if (actual !== scenario.expected) exceptions.push({ scenario: scenario.name, expected: scenario.expected, actual });
    if (["lost_or_stolen_card", "unknown"].includes(scenario.failure.failureCode) && !["stop", "human_review"].includes(actual)) unsafeAutomationCount += 1;
  }
  return {
    dataset: "40 held-out labelled synthetic scenarios",
    totalScenarios: scenarios.length,
    correctDecisions: scenarios.length - exceptions.length,
    decisionAccuracy: (scenarios.length - exceptions.length) / scenarios.length,
    unsafeAutomationCount, actionBreakdown, exceptions,
  };
}
