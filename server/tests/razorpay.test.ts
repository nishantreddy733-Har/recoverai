import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapRazorpayFailureCode, recoveryCaseFromWebhook, verifyRazorpaySignature } from "../src/razorpay.js";

describe("Razorpay webhook adapter", () => {
  it("verifies the raw body HMAC signature", () => {
    const body = Buffer.from('{"event":"payment.failed"}');
    const secret = "test_secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyRazorpaySignature(body, signature, secret)).toBe(true);
    expect(verifyRazorpaySignature(body, "invalid", secret)).toBe(false);
  });

  it("maps common provider failures into recovery diagnoses", () => {
    expect(mapRazorpayFailureCode("BAD_REQUEST", "insufficient balance")).toBe("insufficient_funds");
    expect(mapRazorpayFailureCode("BAD_REQUEST", "card expired")).toBe("expired_card");
    expect(mapRazorpayFailureCode("SERVER_ERROR", "gateway unavailable")).toBe("temporary_bank_error");
  });

  it("converts a failed payment event into a recovery case", () => {
    const item = recoveryCaseFromWebhook({
      event: "payment.failed", created_at: 1_700_000_000,
      payload: { payment: { entity: { id: "pay_demo", amount: 149900, currency: "INR", error_description: "insufficient balance", notes: { subscription_id: "sub_demo", customer_name: "Demo" } } } },
    });
    expect(item).toMatchObject({ id: "rzp_pay_demo", amount: 1499, subscriptionId: "sub_demo", failureCode: "insufficient_funds", status: "pending" });
  });

  it("ignores unrelated webhook events", () => {
    expect(recoveryCaseFromWebhook({ event: "payment.captured" })).toBeNull();
  });
});
