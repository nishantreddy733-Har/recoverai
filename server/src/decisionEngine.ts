import type { Decision, PaymentFailure } from "@recover-ai/shared";

// This interface is the seam where a future LLM/classifier can be added. The
// guardrails remain independent, so model output never directly moves money.
export interface DecisionEngine {
  decide(failure: PaymentFailure): Decision;
}

export class ExplainableDecisionEngine implements DecisionEngine {
  decide(failure: PaymentFailure): Decision {
    switch (failure.failureCode) {
      case "insufficient_funds":
        return {
          diagnosis: "The account temporarily lacks sufficient balance.",
          action: "smart_retry",
          confidence: 0.94,
          retryAfterHours: 48,
          reason: "A delayed retry can recover a temporary balance failure without asking for new card details.",
        };
      case "expired_card":
        return {
          diagnosis: "The stored card has expired.",
          action: "request_payment_update",
          confidence: 0.99,
          reason: "Retries cannot fix expired credentials; the customer must update the payment method.",
        };
      case "temporary_bank_error":
        return {
          diagnosis: "The issuing bank reported a temporary processing error.",
          action: "smart_retry",
          confidence: 0.91,
          retryAfterHours: 24,
          reason: "A single delayed retry is appropriate for a transient issuer error.",
        };
      case "lost_or_stolen_card":
        return {
          diagnosis: "The payment credential is reported lost or stolen.",
          action: "stop",
          confidence: 1,
          reason: "Further automated attempts would be unsafe and must be blocked.",
        };
      default:
        return {
          diagnosis: "The provider response is not specific enough for a safe automated decision.",
          action: "human_review",
          confidence: 0.45,
          reason: "Ambiguous failures are escalated instead of guessing.",
        };
    }
  }
}
