import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRazorpayTestOrder, detectRazorpayKeyMode, mapRazorpayFailureCode, recoveryCaseFromWebhook, verifyRazorpaySignature, verifyRazorpayTestConnection } from "../src/razorpay.js";

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

  it("accepts only Test Mode key identifiers", () => {
    expect(detectRazorpayKeyMode("rzp_test_example")).toBe("test");
    expect(detectRazorpayKeyMode("rzp_live_example")).toBe("live");
    expect(detectRazorpayKeyMode(undefined)).toBe("missing");
  });

  it("verifies Test Mode credentials without exposing secrets", async () => {
    const request = (async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: expect.stringMatching(/^Basic /) });
      return new Response(JSON.stringify({ entity: "collection", count: 0, items: [] }), { status: 200 });
    }) as typeof fetch;
    const result = await verifyRazorpayTestConnection("rzp_test_example", "private_secret", request);
    expect(result).toMatchObject({ ok: true, message: "Connected to Razorpay Test Mode" });
    expect(JSON.stringify(result)).not.toContain("private_secret");
  });

  it("blocks Live Mode credentials", async () => {
    const request = (async () => new Response(null, { status: 200 })) as typeof fetch;
    await expect(verifyRazorpayTestConnection("rzp_live_example", "secret", request)).resolves.toMatchObject({ ok: false, message: "Only Razorpay Test Mode keys are allowed" });
  });

  it("creates a Test Mode order without returning the key secret", async () => {
    const request = (async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      return new Response(JSON.stringify({ id: "order_test", amount: 49900, currency: "INR" }), { status: 200 });
    }) as typeof fetch;
    const order = await createRazorpayTestOrder("rzp_test_example", "private_secret", request);
    expect(order).toEqual({ id: "order_test", amount: 49900, currency: "INR", keyId: "rzp_test_example" });
    expect(JSON.stringify(order)).not.toContain("private_secret");
  });
});
