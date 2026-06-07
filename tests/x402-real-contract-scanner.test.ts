import { describe, expect, it } from "vitest";
import {
  payContractScannerWithX402,
  paySpecialistAgentWithX402,
  resolveAgentBuyerConfig,
  resolveContractScannerBuyerConfig
} from "../lib/adapters/payment/x402-client";
import type { SpecialistAgentRun } from "../lib/agents";
import type { SpecialistAgentKind } from "../lib/agents/types";
import { phaseOneDemoSnapshot } from "../lib/core/phase-one-demo";
import { runPaidSpecialistAgentsWithDevPayment } from "../lib/runtime/paid-agent-flow";

const validEnv = {
  X402_CONTRACT_SCANNER_MODE: "real",
  X402_BUYER_PRIVATE_KEY: `0x${"1".repeat(64)}`,
  X402_PAY_TO_ADDRESS: "0x000000000000000000000000000000000000dEaD",
  X402_SETTLEMENT_NETWORK: "eip155:84532",
  X402_FACILITATOR_URL: "https://x402.org/facilitator",
  X402_CONTRACT_SCANNER_URL: "http://localhost:3000/api/agents/contract-scanner",
  X402_CONTRACT_SCANNER_PRICE_USD: "$0.001",
  X402_WALLET_BEHAVIOR_MODE: "real",
  X402_WALLET_BEHAVIOR_URL: "http://localhost:3000/api/agents/wallet-behavior",
  X402_WALLET_BEHAVIOR_PRICE_USD: "$0.001",
  X402_MARKET_CONTEXT_MODE: "real",
  X402_MARKET_CONTEXT_URL: "http://localhost:3000/api/agents/market-context",
  X402_MARKET_CONTEXT_PRICE_USD: "$0.001",
  X402_DEV_MODE: "true",
  X402_DEV_PAYMENT_PROOF: "unit-test-proof"
};

const specialistRuns: Record<SpecialistAgentKind, SpecialistAgentRun> = {
  contract_scanner: {
    agentKind: "contract_scanner",
    source: "fallback",
    diagnostics: ["Mocked real x402 specialist output."],
    output: {
      taskId: "risk-report-demo:contract-scanner",
      summary: "Mocked Contract Scanner output after x402 settlement.",
      evidence: ["Output source: fallback", "Mocked x402 settlement accepted."],
      riskSignals: ["mocked-real-x402"]
    }
  },
  wallet_behavior: {
    agentKind: "wallet_behavior",
    source: "fallback",
    diagnostics: ["Mocked real x402 wallet output."],
    output: {
      taskId: "risk-report-demo:wallet-behavior",
      summary: "Mocked Wallet Behavior output after x402 settlement.",
      evidence: ["Output source: fallback", "Mocked x402 settlement accepted."],
      riskSignals: ["mocked-real-x402"]
    }
  },
  market_context: {
    agentKind: "market_context",
    source: "fallback",
    diagnostics: ["Mocked real x402 market output."],
    output: {
      taskId: "risk-report-demo:market-context",
      summary: "Mocked Market Context output after x402 settlement.",
      evidence: ["Output source: fallback", "Mocked x402 settlement accepted."],
      riskSignals: ["mocked-real-x402"]
    }
  }
};

function settledResult(body: unknown) {
  return {
    kind: "success",
    response: new Response(JSON.stringify(body), { status: 200 }),
    body,
    settleResponse: {
      success: true,
      transaction: "0xabc123",
      network: "eip155:84532",
      amount: "1000"
    }
  } as const;
}

describe("real x402 Contract Scanner adapter boundary", () => {
  it("validates real-mode buyer config without printing secret values", () => {
    const result = resolveContractScannerBuyerConfig(validEnv);

    expect(result.ok).toBe(true);
    expect(result.ok && result.buyerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("validates real-mode buyer config for each specialist agent", () => {
    for (const agentKind of ["contract_scanner", "wallet_behavior", "market_context"] as SpecialistAgentKind[]) {
      const result = resolveAgentBuyerConfig(agentKind, validEnv);

      expect(result.ok).toBe(true);
      expect(result.ok && result.config.agentKind).toBe(agentKind);
      expect(result.ok && result.buyerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }
  });

  it("falls back safely when the buyer key is missing", () => {
    const result = resolveContractScannerBuyerConfig({
      ...validEnv,
      X402_BUYER_PRIVATE_KEY: ""
    });

    expect(result).toMatchObject({
      ok: false,
      mode: "real",
      missing: ["X402_BUYER_PRIVATE_KEY"]
    });
  });

  it("falls back safely when a real agent route URL is missing", () => {
    const result = resolveAgentBuyerConfig("wallet_behavior", {
      ...validEnv,
      X402_WALLET_BEHAVIOR_URL: ""
    });

    expect(result).toMatchObject({
      ok: false,
      mode: "real",
      missing: ["X402_WALLET_BEHAVIOR_URL"]
    });
  });

  it("parses a valid settled Contract Scanner response into the internal schema", async () => {
    const result = await payContractScannerWithX402(
      {
        targetAddress: phaseOneDemoSnapshot.mission.targetAddress
      },
      {
        env: validEnv,
        fetchWithPayment: async () =>
          new Response(JSON.stringify({ specialistRun: specialistRuns.contract_scanner }), { status: 200 }),
        settlementInspector: async () => settledResult({ specialistRun: specialistRuns.contract_scanner })
      }
    );

    expect(result).toMatchObject({
      state: "real_x402_paid",
      responseStatus: 200,
      settlementPresent: true,
      transactionPresent: true,
      specialistRun: {
        agentKind: "contract_scanner"
      }
    });
  });

  it("parses valid settled Wallet Behavior and Market Context responses into the same schema", async () => {
    for (const agentKind of ["wallet_behavior", "market_context"] as SpecialistAgentKind[]) {
      const result = await paySpecialistAgentWithX402(
        agentKind,
        {
          targetAddress: phaseOneDemoSnapshot.mission.targetAddress
        },
        {
          env: validEnv,
          fetchWithPayment: async () =>
            new Response(JSON.stringify({ specialistRun: specialistRuns[agentKind] }), { status: 200 }),
          settlementInspector: async () => settledResult({ specialistRun: specialistRuns[agentKind] })
        }
      );

      expect(result).toMatchObject({
        agentKind,
        state: "real_x402_paid",
        responseStatus: 200,
        settlementPresent: true,
        transactionPresent: true,
        specialistRun: {
          agentKind
        }
      });
    }
  });

  it("returns a sanitized malformed-response fallback", async () => {
    const result = await payContractScannerWithX402(
      {
        targetAddress: phaseOneDemoSnapshot.mission.targetAddress
      },
      {
        env: validEnv,
        fetchWithPayment: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
        settlementInspector: async () => settledResult({ ok: true })
      }
    );

    expect(result).toMatchObject({
      state: "real_x402_failed",
      failureCategory: "invalid_response",
      settlementPresent: true,
      transactionPresent: true
    });
    expect(JSON.stringify(result)).not.toContain(validEnv.X402_BUYER_PRIVATE_KEY);
  });

  it("returns a sanitized request failure when facilitator or route calls fail", async () => {
    const result = await payContractScannerWithX402(
      {
        targetAddress: phaseOneDemoSnapshot.mission.targetAddress
      },
      {
        env: validEnv,
        fetchWithPayment: async () => {
          throw new TypeError("network unavailable");
        }
      }
    );

    expect(result).toMatchObject({
      state: "real_x402_failed",
      failureCategory: "request",
      errorClass: "TypeError"
    });
    expect(JSON.stringify(result)).not.toContain("network unavailable");
  });

  it("maps settlement or insufficient-funds failures into a sanitized settlement fallback", async () => {
    const result = await payContractScannerWithX402(
      {
        targetAddress: phaseOneDemoSnapshot.mission.targetAddress
      },
      {
        env: validEnv,
        fetchWithPayment: async () => new Response(JSON.stringify({ error: "payment failed" }), { status: 402 }),
        settlementInspector: async () =>
          ({
            kind: "settle_failed",
            response: new Response("{}", { status: 402 }),
            body: {},
            settleResponse: {
              success: false,
              errorReason: "insufficient_funds",
              errorMessage: "not returned to client",
              transaction: "",
              network: "eip155:84532"
            }
          }) as const
      }
    );

    expect(result).toMatchObject({
      state: "real_x402_failed",
      responseStatus: 402,
      failureCategory: "settlement",
      settlementPresent: true,
      transactionPresent: false
    });
    expect(JSON.stringify(result)).not.toContain("insufficient_funds");
  });
});

describe("paid-agent runtime with multi-agent real x402 paths", () => {
  it("uses real x402 for all configured specialist agents", async () => {
    const result = await runPaidSpecialistAgentsWithDevPayment(phaseOneDemoSnapshot, {
      env: validEnv,
      now: () => "2026-06-01T00:00:00.000Z",
      x402Buyer: async (agentKind) => ({
        agentKind,
        state: "real_x402_paid",
        responseStatus: 200,
        settlementPresent: true,
        transactionPresent: true,
        specialistRun: specialistRuns[agentKind]
      })
    });

    expect(result.flow).toBe("x402_real_agents");
    expect(result.runs).toHaveLength(3);
    expect(result.paymentEvents.filter((event) => event.type === "real_x402_paid")).toHaveLength(3);
    expect(result.paymentEvents.filter((event) => event.type === "dev_payment_accepted")).toHaveLength(0);
    expect(result.paymentEvents.filter((event) => event.type === "real_x402_paid").every((event) => !event.simulatedSettlement)).toBe(true);
  });

  it("falls back visibly to the simulated path when a real x402 agent is unavailable", async () => {
    const result = await runPaidSpecialistAgentsWithDevPayment(phaseOneDemoSnapshot, {
      env: validEnv,
      now: () => "2026-06-01T00:00:00.000Z",
      x402Buyer: async (agentKind) => ({
        agentKind,
        state: "real_x402_unavailable",
        failureCategory: "configuration",
        settlementPresent: false,
        transactionPresent: false
      })
    });

    expect(result.flow).toBe("x402_real_agents");
    expect(result.runs).toHaveLength(3);
    expect(result.paymentEvents.filter((event) => event.type === "real_x402_unavailable")).toHaveLength(3);
    expect(result.paymentEvents.filter((event) => event.type === "simulated_payment_used")).toHaveLength(3);
    expect(result.paymentEvents.filter((event) => event.type === "simulated_payment_used").every((event) => event.simulatedSettlement)).toBe(true);
  });
});
