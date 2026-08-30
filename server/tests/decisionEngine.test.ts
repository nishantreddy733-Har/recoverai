import { describe, expect, it } from "vitest";
import type { PaymentFailure } from "@recover-ai/shared";
import { ExplainableDecisionEngine } from "../src/decisionEngine.js";
import { applyGuardrails } from "../src/guardrails.js";

const base: PaymentFailure = { id: "f1", subscriptionId: "s1", customerName: "Test", amount: 999, currency: "INR", failureCode: "insufficient_funds", failedAt: "2026-08-29T00:00:00Z", previousAttempts: 0 };
const engine = new ExplainableDecisionEngine();

describe("bounded decisions", () => {
  it("delays a retry for insufficient funds", () => {
    expect(applyGuardrails(base, engine.decide(base)).action).toBe("smart_retry");
  });
  it("never retries a lost or stolen card", () => {
    const failure = { ...base, failureCode: "lost_or_stolen_card" as const };
    expect(applyGuardrails(failure, engine.decide(failure)).action).toBe("stop");
  });
  it("escalates after the retry limit", () => {
    const failure = { ...base, previousAttempts: 2 };
    expect(applyGuardrails(failure, engine.decide(failure)).action).toBe("human_review");
  });
  it("escalates unknown low-confidence failures", () => {
    const failure = { ...base, failureCode: "unknown" as const };
    expect(applyGuardrails(failure, engine.decide(failure)).action).toBe("human_review");
  });
});
