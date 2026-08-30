export const failureCodes = [
  "insufficient_funds",
  "expired_card",
  "temporary_bank_error",
  "lost_or_stolen_card",
  "unknown",
] as const;

export type FailureCode = (typeof failureCodes)[number];
export type RecoveryAction =
  | "smart_retry"
  | "request_payment_update"
  | "send_reminder"
  | "human_review"
  | "stop";

export type PaymentFailure = {
  id: string;
  subscriptionId: string;
  customerName: string;
  amount: number;
  currency: "INR";
  failureCode: FailureCode;
  failedAt: string;
  previousAttempts: number;
  lastAttemptAt?: string;
};

export type Decision = {
  diagnosis: string;
  action: RecoveryAction;
  confidence: number;
  reason: string;
  retryAfterHours?: number;
};

export type RecoveryCase = PaymentFailure & {
  status: "pending" | "actioned" | "recovered" | "stopped" | "review";
  decision?: Decision;
  recoveredAmount: number;
};

export type AuditEvent = {
  id: string;
  caseId: string;
  at: string;
  type: "failure_received" | "decision_made" | "action_executed" | "outcome_recorded";
  message: string;
};

export type Metrics = {
  totalAtRisk: number;
  recoveredRevenue: number;
  recoveryRate: number;
  casesProcessed: number;
  automaticActions: number;
  escalations: number;
};

export type BatchResult = {
  processed: number;
  recovered: number;
  recoveredRevenue: number;
  actioned: number;
  stopped: number;
  escalated: number;
};

export type RazorpayIntegrationStatus = {
  mode: "test-ready";
  signatureVerification: boolean;
  idempotencyLedger: boolean;
  acceptedEvents: number;
  webhookSecretConfigured: boolean;
};

export type EvaluationReport = {
  dataset: string;
  totalScenarios: number;
  correctDecisions: number;
  decisionAccuracy: number;
  unsafeAutomationCount: number;
  actionBreakdown: Record<RecoveryAction, number>;
  exceptions: Array<{ scenario: string; expected: RecoveryAction; actual: RecoveryAction }>;
};
