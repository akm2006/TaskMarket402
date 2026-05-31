import { describe, expect, it } from "vitest";
import {
  createDevPaymentSignature,
  createX402PaymentRequired,
  createX402ProtectedResource,
  verifyDevPaymentProof
} from "../lib/adapters/payment/x402-server";
import type { AgentTask } from "../lib/core/types";

const task: AgentTask = {
  id: "risk-report-demo:contract-scanner",
  missionId: "risk-report-demo",
  agentKind: "contract_scanner",
  objective: "Scan contract risk indicators.",
  budget: {
    amount: "0.40",
    currency: "USDC",
    chainId: 84532
  }
};

const resource = createX402ProtectedResource({
  task,
  agentKind: "contract_scanner",
  resourceUrl: "http://localhost:3000/api/agents/contract-scanner",
  description: "Contract scanner specialist output"
});

describe("x402-style development payment adapter", () => {
  it("returns a 402 challenge with a PAYMENT-REQUIRED header when proof is missing", async () => {
    const response = createX402PaymentRequired(resource, {
      env: {},
      reason: "missing_payment_proof"
    });
    const body = (await response.json()) as {
      state: string;
      simulatedSettlement: boolean;
      accepts: unknown[];
    };

    expect(response.status).toBe(402);
    expect(response.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
    expect(body).toMatchObject({
      state: "payment_required",
      simulatedSettlement: true
    });
    expect(body.accepts).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("taskmarket402-dev-payment-proof");
  });

  it("accepts a matching development proof without exposing the proof", () => {
    const env = {
      X402_DEV_MODE: "true",
      X402_DEV_PAYMENT_PROOF: "unit-test-proof"
    };
    const headers = new Headers({
      "PAYMENT-SIGNATURE": createDevPaymentSignature(resource, env)
    });
    const result = verifyDevPaymentProof(headers, resource, env);

    expect(result).toMatchObject({
      ok: true,
      state: "dev_payment_accepted"
    });
    expect(result.ok && result.paymentId).not.toContain("unit-test-proof");
  });

  it("rejects invalid or wrong-resource development proofs safely", () => {
    const env = {
      X402_DEV_MODE: "true",
      X402_DEV_PAYMENT_PROOF: "unit-test-proof"
    };
    const invalid = verifyDevPaymentProof(new Headers({ "PAYMENT-SIGNATURE": "not-base64-json" }), resource, env);
    const wrongResource = createX402ProtectedResource({
      task: {
        ...task,
        id: "risk-report-demo:wallet-behavior",
        agentKind: "wallet_behavior"
      },
      agentKind: "wallet_behavior",
      resourceUrl: "http://localhost:3000/api/agents/wallet-behavior"
    });
    const wrong = verifyDevPaymentProof(
      new Headers({ "PAYMENT-SIGNATURE": createDevPaymentSignature(wrongResource, env) }),
      resource,
      env
    );

    expect(invalid).toMatchObject({
      ok: false,
      reason: "invalid_payment_proof"
    });
    expect(wrong).toMatchObject({
      ok: false,
      reason: "wrong_resource"
    });
  });
});
