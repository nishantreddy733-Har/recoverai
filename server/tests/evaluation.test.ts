import { describe, expect, it } from "vitest";
import type { Decision } from "@recover-ai/shared";
import { ExplainableDecisionEngine, type DecisionEngine } from "../src/decisionEngine.js";
import { evaluateDecisionEngine } from "../src/evaluation.js";

describe("held-out decision evaluation", () => {
  it("meets the labelled baseline without unsafe automation", () => {
    const report = evaluateDecisionEngine(new ExplainableDecisionEngine());
    expect(report.totalScenarios).toBe(40);
    expect(report.decisionAccuracy).toBe(1);
    expect(report.unsafeAutomationCount).toBe(0);
    expect(report.exceptions).toEqual([]);
  });

  it("honestly reports a weak engine's mistakes", () => {
    const unsafeEngine: DecisionEngine = { decide: (): Decision => ({ diagnosis: "guess", action: "smart_retry", confidence: 1, reason: "unsafe test engine" }) };
    const report = evaluateDecisionEngine(unsafeEngine);
    expect(report.decisionAccuracy).toBeLessThan(1);
    expect(report.unsafeAutomationCount).toBeGreaterThan(0);
    expect(report.exceptions.length).toBeGreaterThan(0);
  });
});
