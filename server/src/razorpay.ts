import { createHmac, timingSafeEqual } from "node:crypto";
import type { FailureCode, RecoveryCase } from "@recover-ai/shared";

export type RazorpayWebhook = {
  event: string;
  created_at?: number;
  payload?: { payment?: { entity?: Record<string, unknown> } };
};

export function verifyRazorpaySignature(rawBody: Buffer, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}

export function mapRazorpayFailureCode(errorCode: unknown, description: unknown): FailureCode {
  const value = `${String(errorCode ?? "")} ${String(description ?? "")}`.toLowerCase();
  if (value.includes("insufficient") || value.includes("balance")) return "insufficient_funds";
  if (value.includes("expired")) return "expired_card";
  if (value.includes("lost") || value.includes("stolen")) return "lost_or_stolen_card";
  if (value.includes("server") || value.includes("gateway") || value.includes("temporar") || value.includes("timeout")) return "temporary_bank_error";
  return "unknown";
}

export function recoveryCaseFromWebhook(event: RazorpayWebhook): RecoveryCase | null {
  if (event.event !== "payment.failed") return null;
  const payment = event.payload?.payment?.entity;
  if (!payment || typeof payment.id !== "string" || typeof payment.amount !== "number") return null;
  const notes = typeof payment.notes === "object" && payment.notes ? payment.notes as Record<string, unknown> : {};
  return {
    id: `rzp_${payment.id}`,
    subscriptionId: String(payment.subscription_id ?? notes.subscription_id ?? "unlinked_subscription"),
    customerName: String(notes.customer_name ?? payment.email ?? "Razorpay customer"),
    amount: payment.amount / 100,
    currency: "INR",
    failureCode: mapRazorpayFailureCode(payment.error_code, payment.error_description),
    failedAt: new Date((event.created_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    previousAttempts: Number(notes.previous_attempts ?? 0),
    status: "pending",
    recoveredAmount: 0,
  };
}
