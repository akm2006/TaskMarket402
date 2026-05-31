import { describe, expect, it, vi } from "vitest";
import type { AgentOutput, Mission } from "../lib/core/types";
import {
  planMissionWithGemini,
  synthesizeFinalReportWithGemini,
  verifyAgentOutputWithGemini,
  type GeminiGenerateClient
} from "../lib/adapters/ai/gemini";

const mission: Mission = {
  id: "test-mission",
  title: "Wallet / Token Risk Report",
  targetAddress: "0x0000000000000000000000000000000000000001",
  status: "planned",
  createdAt: "2026-05-31T00:00:00.000Z",
  budgetPolicy: {
    missionId: "test-mission",
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
  taskId: "test-mission:contract-scanner",
  summary: "Proxy-like upgrade surface found with owner privilege uncertainty.",
  evidence: ["Upgradeable proxy marker", "Owner role present"],
  riskSignals: ["upgradeable-contract", "owner-privilege"]
};

function mockClient(content: string | null): GeminiGenerateClient {
  return {
    generateContent: vi.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                text: content ?? undefined
              }
            ]
          }
        }
      ]
    })
  };
}

describe("Gemini dev adapter", () => {
  it("maps a valid Gemini plan response into policy-checked agent tasks", async () => {
    const client = mockClient(
      JSON.stringify({
        rationale: "Plan across bounded specialist tasks.",
        assumptions: ["Use mission policy cap."],
        tasks: [
          {
            agentKind: "contract_scanner",
            objective: "Scan contract risk indicators.",
            budgetAmount: "0.40"
          }
        ]
      })
    );

    const result = await planMissionWithGemini(mission, {
      env: { GEMINI_API_KEY: "test-key" },
      client
    });

    expect(result).toMatchObject({
      provider: "gemini",
      providerRole: "development_testing",
      mode: "dev",
      state: "completed"
    });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      id: "test-mission:contract-scanner",
      agentKind: "contract_scanner",
      budget: {
        amount: "0.40",
        currency: "USDC",
        chainId: 84532
      }
    });
    expect(client.generateContent).toHaveBeenCalledOnce();
  });

  it("parses valid verification and report responses", async () => {
    const verificationClient = mockClient(
      JSON.stringify({
        verified: true,
        confidence: "medium",
        notes: ["Verification accepted the output."],
        riskSignals: ["owner-privilege"],
        requiresHumanReview: true
      })
    );
    const reportClient = mockClient(
      JSON.stringify({
        title: "Wallet / Token Risk Report",
        summary: "Report synthesis completed.",
        riskLevel: "medium",
        sections: [
          {
            heading: "Contract Risk",
            body: "Owner privilege remains unresolved."
          }
        ],
        recommendations: ["Use Venice for the final sponsor path."],
        verificationSummary: "Structured synthesis validated against the internal schema."
      })
    );

    const verification = await verifyAgentOutputWithGemini(output, {
      env: { GEMINI_API_KEY: "test-key" },
      client: verificationClient
    });
    const report = await synthesizeFinalReportWithGemini([output], {
      env: { GEMINI_API_KEY: "test-key" },
      client: reportClient
    });

    expect(verification).toMatchObject({
      provider: "gemini",
      mode: "dev",
      state: "completed",
      verified: true
    });
    expect(report.report).toMatchObject({
      status: "synthesized",
      riskLevel: "medium"
    });
  });

  it("returns fallback for malformed Gemini JSON", async () => {
    const client = mockClient("{not valid json");

    const result = await synthesizeFinalReportWithGemini([output], {
      env: { GEMINI_API_KEY: "test-key" },
      client
    });

    expect(result).toMatchObject({
      provider: "gemini",
      mode: "fallback",
      state: "invalid_response"
    });
    expect(result.diagnostic?.providerCategory).toBe("structured_output");
  });

  it("does not call Gemini when GEMINI_API_KEY is missing", async () => {
    const client = mockClient(
      JSON.stringify({
        verified: true,
        confidence: "high",
        notes: [],
        riskSignals: [],
        requiresHumanReview: false
      })
    );

    const result = await verifyAgentOutputWithGemini(output, {
      env: {},
      client
    });

    expect(result).toMatchObject({
      provider: "gemini",
      mode: "fallback",
      state: "skipped_missing_api_key",
      verified: false,
      requiresHumanReview: true
    });
    expect(client.generateContent).not.toHaveBeenCalled();
  });
});
