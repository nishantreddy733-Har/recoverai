import type { Decision, PaymentFailure } from "@recover-ai/shared";

const MAX_AUTOMATIC_ATTEMPTS = 2;
const MIN_RETRY_GAP_HOURS = 24;

export function applyGuardrails(failure: PaymentFailure, proposed: Decision): Decision {
  if (proposed.confidence < 0.7) {
    return { ...proposed, action: "human_review", reason: `${proposed.reason} Confidence is below the 70% automation threshold.` };
  }

  if (proposed.action !== "smart_retry") return proposed;

  if (failure.previousAttempts >= MAX_AUTOMATIC_ATTEMPTS) {
    return { ...proposed, action: "human_review", reason: "Automatic retry limit reached; a person must review the case." };
  }

  if (failure.lastAttemptAt) {
    const elapsedHours = (Date.now() - new Date(failure.lastAttemptAt).getTime()) / 3_600_000;
    if (elapsedHours < MIN_RETRY_GAP_HOURS) {
      return { ...proposed, action: "stop", reason: "Retry blocked because the previous attempt was less than 24 hours ago." };
    }
  }

  return proposed;
}
