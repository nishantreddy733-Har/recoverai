import { createHmac, timingSafeEqual } from "node:crypto";
import type { FailureCode, RecoveryCase } from "@recover-ai/shared";

export type RazorpayWebhook = {
  event: string;
  created_at?: number;
  payload?: { payment?: { entity?: Record<string, unknown> } };
};

export type RazorpayConnectionResult = { ok: boolean; message: string; checkedAt: string };
export type RazorpayTestOrder = { id: string; amount: number; currency: string; keyId: string };

export function detectRazorpayKeyMode(keyId: string | undefined): "test" | "live" | "unknown" | "missing" {
  if (!keyId) return "missing";
  if (keyId.startsWith("rzp_test_")) return "test";
  if (keyId.startsWith("rzp_live_")) return "live";
  return "unknown";
}

export async function verifyRazorpayTestConnection(
  keyId: string | undefined,
  keySecret: string | undefined,
  request: typeof fetch = fetch,
): Promise<RazorpayConnectionResult> {
  const checkedAt = new Date().toISOString();
  if (!keyId || !keySecret) return { ok: false, message: "Test API keys are not configured", checkedAt };
  if (detectRazorpayKeyMode(keyId) !== "test") return { ok: false, message: "Only Razorpay Test Mode keys are allowed", checkedAt };
  try {
    const response = await request("https://api.razorpay.com/v1/payments?count=1", {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, Accept: "application/json" },
      signal: AbortSignal.timeout(7_000),
    });
    if (response.ok) return { ok: true, message: "Connected to Razorpay Test Mode", checkedAt };
    if (response.status === 401) return { ok: false, message: "Razorpay rejected the Test API credentials", checkedAt };
    return { ok: false, message: `Razorpay connection failed with status ${response.status}`, checkedAt };
  } catch {
    return { ok: false, message: "Razorpay could not be reached from this server", checkedAt };
  }
}

export async function createRazorpayTestOrder(
  keyId: string | undefined,
  keySecret: string | undefined,
  request: typeof fetch = fetch,
): Promise<RazorpayTestOrder> {
  if (!keyId || !keySecret) throw new Error("Test API keys are not configured");
  if (detectRazorpayKeyMode(keyId) !== "test") throw new Error("Only Razorpay Test Mode keys are allowed");
  const amount = 49900;
  const response = await request("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency: "INR", receipt: `recoverai_${Date.now()}`, notes: { subscription_id: `sub_checkout_${Date.now()}`, customer_name: "RecoverAI Test Customer" } }),
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) throw new Error(response.status === 401 ? "Razorpay rejected the Test API credentials" : `Razorpay order creation failed with status ${response.status}`);
  const order = await response.json() as { id?: unknown; amount?: unknown; currency?: unknown };
  if (typeof order.id !== "string") throw new Error("Razorpay returned an invalid order");
  return { id: order.id, amount: Number(order.amount ?? amount), currency: String(order.currency ?? "INR"), keyId };
}

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
