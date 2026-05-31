import { describe, expect, it } from "vitest";
import type { AgentOutput, Mission } from "../lib/core/types";
import { createAiProvider, planMission, resolveAiProviderId } from "../lib/adapters/ai/provider";

const mission: Mission = {
  id: "provider-test",
  title: "Wallet / Token Risk Report",
  targetAddress: "0x0000000000000000000000000000000000000001",
  status: "planned",
  createdAt: "2026-05-31T00:00:00.000Z",
  budgetPolicy: {
    missionId: "provider-test",
    totalBudget: {
      amount: "3.00",
      currency: "USDC",
      chainId: 84532
    },
    maxPerAgent: {
      amount: "0.50",
      currency: "USDC",
      chainId: 84532
    },
    expiresAt: "2026-05-31T01:00:00.000Z",
    allowedPaymentProtocol: "x402"
  }
};

const output: AgentOutput = {
  taskId: "provider-test:contract-scanner",
  summary: "Mock output.",
  evidence: ["Mock evidence"],
  riskSignals: ["mock-risk"]
};

describe("AI provider selection", () => {
  it("defaults to Venice when AI_PROVIDER is unset or invalid", () => {
    expect(resolveAiProviderId({})).toBe("venice");
    expect(resolveAiProviderId({ AI_PROVIDER: "unknown" })).toBe("venice");
    expect(createAiProvider({ env: {} }).id).toBe("venice");
  });

  it("selects Gemini and mock providers through server-only env", () => {
    expect(resolveAiProviderId({ AI_PROVIDER: "gemini" })).toBe("gemini");
    expect(createAiProvider({ env: { AI_PROVIDER: "gemini" } }).id).toBe("gemini");
    expect(resolveAiProviderId({ AI_PROVIDER: "mock" })).toBe("mock");
    expect(createAiProvider({ env: { AI_PROVIDER: "mock" } }).id).toBe("mock");
  });

  it("runs deterministic mock provider without external AI keys", async () => {
    const result = await planMission(mission, {
      env: {
        AI_PROVIDER: "mock"
      }
    });
    const provider = createAiProvider({
      env: {
        AI_PROVIDER: "mock"
      }
    });
    const verification = await provider.verifyAgentOutput(output);

    expect(result.provider).toBe("mock");
    expect(result.tasks).toHaveLength(3);
    expect(verification).toMatchObject({
      provider: "mock",
      mode: "fallback",
      state: "completed",
      requiresHumanReview: true
    });
  });
});
