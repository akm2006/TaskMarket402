import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/agents/[agentKind]/route";
import { createDevPaymentSignature } from "../lib/adapters/payment/x402-server";
import { phaseOneDemoSnapshot } from "../lib/core/phase-one-demo";
import { createPaidAgentResource } from "../lib/runtime/paid-agent-flow";

const originalDevProof = process.env.X402_DEV_PAYMENT_PROOF;
const originalDevMode = process.env.X402_DEV_MODE;

function routeContext(agentKind = "contract-scanner") {
  return {
    params: Promise.resolve({
      agentKind
    })
  };
}

afterEach(() => {
  if (originalDevProof === undefined) {
    delete process.env.X402_DEV_PAYMENT_PROOF;
  } else {
    process.env.X402_DEV_PAYMENT_PROOF = originalDevProof;
  }

  if (originalDevMode === undefined) {
    delete process.env.X402_DEV_MODE;
  } else {
    process.env.X402_DEV_MODE = originalDevMode;
  }
});

describe("paid specialist-agent API route", () => {
  it("returns an x402-style 402 challenge without payment proof", async () => {
    process.env.X402_DEV_PAYMENT_PROOF = "route-test-proof";
    process.env.X402_DEV_MODE = "true";

    const response = await POST(
      new Request("http://localhost:3000/api/agents/contract-scanner", {
        method: "POST"
      }),
      routeContext()
    );
    const body = (await response.json()) as { state: string; simulatedSettlement: boolean };

    expect(response.status).toBe(402);
    expect(response.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
    expect(body).toMatchObject({
      state: "payment_required",
      simulatedSettlement: true
    });
  });

  it("returns a safe 402 response for invalid development proof", async () => {
    process.env.X402_DEV_PAYMENT_PROOF = "route-test-proof";
    process.env.X402_DEV_MODE = "true";

    const response = await POST(
      new Request("http://localhost:3000/api/agents/contract-scanner", {
        method: "POST",
        headers: {
          "PAYMENT-SIGNATURE": "invalid-proof"
        }
      }),
      routeContext()
    );
    const bodyText = await response.text();

    expect(response.status).toBe(402);
    expect(bodyText).toContain("payment_required");
    expect(bodyText).not.toContain("route-test-proof");
  });

  it("returns typed specialist output when development proof is accepted", async () => {
    process.env.X402_DEV_PAYMENT_PROOF = "route-test-proof";
    process.env.X402_DEV_MODE = "true";

    const url = "http://localhost:3000/api/agents/contract-scanner";
    const resource = createPaidAgentResource(phaseOneDemoSnapshot, "contract_scanner", url);
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PAYMENT-SIGNATURE": createDevPaymentSignature(resource, process.env)
        },
        body: JSON.stringify({
          targetAddress: "not-an-address"
        })
      }),
      routeContext()
    );
    const body = (await response.json()) as {
      source: string;
      simulatedSettlement: boolean;
      payment: { state: string; settlement: string };
      specialistRun: { agentKind: string; source: string; output: { summary: string } };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("PAYMENT-RESPONSE")).toBeTruthy();
    expect(body).toMatchObject({
      source: "paid_agent_endpoint",
      simulatedSettlement: true,
      payment: {
        state: "dev_payment_accepted",
        settlement: "simulated"
      }
    });
    expect(body.specialistRun).toMatchObject({
      agentKind: "contract_scanner",
      source: "fallback"
    });
    expect(body.specialistRun.output.summary).toContain("Contract scanner fallback");
  });
});
