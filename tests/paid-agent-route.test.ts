import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/agents/[agentKind]/route";
import { createDevPaymentSignature } from "../lib/adapters/payment/x402-server";
import type { SpecialistAgentKind } from "../lib/agents/types";
import { phaseOneDemoSnapshot } from "../lib/core/phase-one-demo";
import { createPaidAgentResource, specialistAgentSlug } from "../lib/runtime/paid-agent-flow";

const originalDevProof = process.env.X402_DEV_PAYMENT_PROOF;
const originalDevMode = process.env.X402_DEV_MODE;
const originalContractScannerMode = process.env.X402_CONTRACT_SCANNER_MODE;
const originalWalletBehaviorMode = process.env.X402_WALLET_BEHAVIOR_MODE;
const originalMarketContextMode = process.env.X402_MARKET_CONTEXT_MODE;
const originalNetwork = process.env.X402_SETTLEMENT_NETWORK;
const originalPayTo = process.env.X402_PAY_TO_ADDRESS;

const agentKinds: SpecialistAgentKind[] = ["contract_scanner", "wallet_behavior", "market_context"];

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

  if (originalContractScannerMode === undefined) {
    delete process.env.X402_CONTRACT_SCANNER_MODE;
  } else {
    process.env.X402_CONTRACT_SCANNER_MODE = originalContractScannerMode;
  }

  if (originalWalletBehaviorMode === undefined) {
    delete process.env.X402_WALLET_BEHAVIOR_MODE;
  } else {
    process.env.X402_WALLET_BEHAVIOR_MODE = originalWalletBehaviorMode;
  }

  if (originalMarketContextMode === undefined) {
    delete process.env.X402_MARKET_CONTEXT_MODE;
  } else {
    process.env.X402_MARKET_CONTEXT_MODE = originalMarketContextMode;
  }

  if (originalNetwork === undefined) {
    delete process.env.X402_SETTLEMENT_NETWORK;
  } else {
    process.env.X402_SETTLEMENT_NETWORK = originalNetwork;
  }

  if (originalPayTo === undefined) {
    delete process.env.X402_PAY_TO_ADDRESS;
  } else {
    process.env.X402_PAY_TO_ADDRESS = originalPayTo;
  }
});

describe("paid specialist-agent API route", () => {
  it("returns an x402-style 402 challenge without payment proof for each specialist", async () => {
    process.env.X402_DEV_PAYMENT_PROOF = "route-test-proof";
    process.env.X402_DEV_MODE = "true";
    process.env.X402_CONTRACT_SCANNER_MODE = "simulated";
    process.env.X402_WALLET_BEHAVIOR_MODE = "simulated";
    process.env.X402_MARKET_CONTEXT_MODE = "simulated";

    for (const agentKind of agentKinds) {
      const slug = specialistAgentSlug(agentKind);
      const response = await POST(
        new Request(`http://localhost:3000/api/agents/${slug}`, {
          method: "POST"
        }),
        routeContext(slug)
      );
      const body = (await response.json()) as { state: string; simulatedSettlement: boolean };

      expect(response.status).toBe(402);
      expect(response.headers.get("PAYMENT-REQUIRED")).toBeTruthy();
      expect(body).toMatchObject({
        state: "payment_required",
        simulatedSettlement: true
      });
    }
  });

  it("returns a safe 402 response for invalid development proof", async () => {
    process.env.X402_DEV_PAYMENT_PROOF = "route-test-proof";
    process.env.X402_DEV_MODE = "true";
    process.env.X402_CONTRACT_SCANNER_MODE = "simulated";
    process.env.X402_WALLET_BEHAVIOR_MODE = "simulated";
    process.env.X402_MARKET_CONTEXT_MODE = "simulated";

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

  it("returns typed specialist output when development proof is accepted for each specialist", async () => {
    process.env.X402_DEV_PAYMENT_PROOF = "route-test-proof";
    process.env.X402_DEV_MODE = "true";
    process.env.X402_CONTRACT_SCANNER_MODE = "simulated";
    process.env.X402_WALLET_BEHAVIOR_MODE = "simulated";
    process.env.X402_MARKET_CONTEXT_MODE = "simulated";

    for (const agentKind of agentKinds) {
      const slug = specialistAgentSlug(agentKind);
      const url = `http://localhost:3000/api/agents/${slug}`;
      const resource = createPaidAgentResource(phaseOneDemoSnapshot, agentKind, url);
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
        routeContext(slug)
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
        agentKind,
        source: "fallback"
      });
    }
  });

  it("returns sanitized unavailable state when a real x402 agent config is missing", async () => {
    process.env.X402_WALLET_BEHAVIOR_MODE = "real";
    process.env.X402_SETTLEMENT_NETWORK = "eip155:84532";
    delete process.env.X402_PAY_TO_ADDRESS;

    const response = await POST(
      new Request("http://localhost:3000/api/agents/wallet-behavior", {
        method: "POST"
      }),
      routeContext("wallet-behavior")
    );
    const body = (await response.json()) as {
      source: string;
      phase: string;
      agentKind: string;
      payment: { state: string; settlement: string; missing: string[] };
    };

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      source: "paid_agent_endpoint",
      phase: "phase-8-real-x402-all-agents",
      agentKind: "wallet_behavior",
      payment: {
        state: "real_x402_unavailable",
        settlement: "unavailable",
        missing: ["X402_PAY_TO_ADDRESS"]
      }
    });
  });
});
