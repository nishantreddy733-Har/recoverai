import cors from "cors";
import express from "express";
import { createHmac, randomUUID } from "node:crypto";
import type { BatchResult, Metrics, RazorpayIntegrationStatus, RecoveryAction, RecoveryCase } from "@recover-ai/shared";
import { ExplainableDecisionEngine } from "./decisionEngine.js";
import { applyGuardrails } from "./guardrails.js";
import { addAudit, auditEvents, cases, hasProcessedEvent, persistStore, processedEventIds, recordProcessedEvent, resetStore } from "./store.js";
import { recoveryCaseFromWebhook, verifyRazorpaySignature, type RazorpayWebhook } from "./razorpay.js";
import { evaluateDecisionEngine } from "./evaluation.js";

const app = express();
const engine = new ExplainableDecisionEngine();
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "recoverai_test_webhook_secret_32_chars";
app.use(cors());

function ingestRazorpayWebhook(rawBody: Buffer, signature: string, eventId: string) {
  if (!signature || !eventId || !verifyRazorpaySignature(rawBody, signature, webhookSecret)) {
    return { code: 400, body: { error: "Invalid Razorpay webhook signature or event id" } };
  }
  if (hasProcessedEvent(eventId)) return { code: 200, body: { status: "duplicate_ignored" } };

  let event: RazorpayWebhook;
  try { event = JSON.parse(rawBody.toString("utf8")) as RazorpayWebhook; }
  catch { return { code: 400, body: { error: "Invalid JSON payload" } }; }

  const item = recoveryCaseFromWebhook(event);
  if (!item) return { code: 202, body: { status: "event_ignored" } };
  if (!cases.some((candidate) => candidate.id === item.id)) {
    cases.unshift(item);
    addAudit(item.id, "failure_received", `Razorpay payment failed: ${item.failureCode}`);
  }
  recordProcessedEvent(eventId);
  return { code: 200, body: { status: "accepted", caseId: item.id } };
}

app.post("/api/webhooks/razorpay", express.raw({ type: "application/json" }), (req, res) => {
  const result = ingestRazorpayWebhook(Buffer.isBuffer(req.body) ? req.body : Buffer.from(""), req.header("x-razorpay-signature") ?? "", req.header("x-razorpay-event-id") ?? "");
  return res.status(result.code).json(result.body);
});

app.use(express.json());

app.get("/api/cases", (_req, res) => res.json(cases));
app.get("/api/cases/:id/audit", (req, res) => res.json(auditEvents.filter((event) => event.caseId === req.params.id)));
app.get("/api/integrations/razorpay", (_req, res) => {
  const status: RazorpayIntegrationStatus = {
    mode: "test-ready", signatureVerification: true, idempotencyLedger: true,
    acceptedEvents: processedEventIds.length,
    webhookSecretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  };
  res.json(status);
});
app.get("/api/evaluation", (_req, res) => res.json(evaluateDecisionEngine(engine)));

app.post("/api/demo/razorpay-failure", (_req, res) => {
  const token = Date.now().toString(36);
  const payload: RazorpayWebhook = { event: "payment.failed", created_at: Math.floor(Date.now() / 1000), payload: { payment: { entity: {
    id: `pay_demo_${token}`, amount: 149900, currency: "INR", error_code: "BAD_REQUEST_PAYMENT_FAILED",
    error_description: "insufficient balance", notes: { subscription_id: `sub_demo_${token}`, customer_name: "Razorpay Test Customer" },
  } } } };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const result = ingestRazorpayWebhook(rawBody, signature, `evt_demo_${randomUUID()}`);
  return res.status(result.code).json(result.body);
});

function processRecoveryCase(item: RecoveryCase) {
  const decision = applyGuardrails(item, engine.decide(item));
  item.decision = decision;
  addAudit(item.id, "decision_made", `${decision.action}: ${decision.reason}`);

  // Safe demo executor: outcomes are deterministic and clearly labeled simulated.
  const successfulActions: RecoveryAction[] = ["smart_retry", "request_payment_update"];
  const recovered = successfulActions.includes(decision.action) && item.failureCode !== "expired_card";
  item.status = recovered ? "recovered" : decision.action === "human_review" ? "review" : decision.action === "stop" ? "stopped" : "actioned";
  item.recoveredAmount = recovered ? item.amount : 0;
  addAudit(item.id, "action_executed", `Simulated action: ${decision.action}`);
  addAudit(item.id, "outcome_recorded", recovered ? `Recovered ₹${item.amount}` : `No immediate recovery; status=${item.status}`);
  persistStore();
  return item;
}

app.post("/api/cases/:id/process", (req, res) => {
  const item = cases.find((candidate) => candidate.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Case not found" });
  if (item.status !== "pending") return res.status(409).json({ error: "Case was already processed" });
  processRecoveryCase(item);
  return res.json(item);
});

app.post("/api/cases/process-batch", (_req, res) => {
  const pending = cases.filter((item) => item.status === "pending");
  pending.forEach(processRecoveryCase);
  const result: BatchResult = {
    processed: pending.length,
    recovered: pending.filter((item) => item.status === "recovered").length,
    recoveredRevenue: pending.reduce((sum, item) => sum + item.recoveredAmount, 0),
    actioned: pending.filter((item) => item.status === "actioned").length,
    stopped: pending.filter((item) => item.status === "stopped").length,
    escalated: pending.filter((item) => item.status === "review").length,
  };
  res.json(result);
});

app.post("/api/cases/reset", (_req, res) => {
  resetStore();
  res.json({ cases: cases.length, status: "reset" });
});

app.get("/api/metrics", (_req, res) => {
  const totalAtRisk = cases.reduce((sum, item) => sum + item.amount, 0);
  const recoveredRevenue = cases.reduce((sum, item) => sum + item.recoveredAmount, 0);
  const metrics: Metrics = {
    totalAtRisk, recoveredRevenue,
    recoveryRate: totalAtRisk ? recoveredRevenue / totalAtRisk : 0,
    casesProcessed: cases.filter((item) => item.status !== "pending").length,
    automaticActions: cases.filter((item) => item.decision && !["human_review", "stop"].includes(item.decision.action)).length,
    escalations: cases.filter((item) => item.status === "review").length,
  };
  res.json(metrics);
});

app.listen(3001, () => console.log("RecoverAI API listening on http://localhost:3001"));
