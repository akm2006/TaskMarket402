import { describe, expect, it, vi } from "vitest";
import type { AgentOutput, Mission } from "../lib/core/types";
import {
  planMissionWithVenice,
  synthesizeFinalReportWithVenice,
  verifyAgentOutputWithVenice,
  type VeniceChatClient
} from "../lib/adapters/ai/venice";

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

function mockClient(content: string | null): VeniceChatClient {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content
              }
            }
          ]
        })
      }
    }
  };
}

describe("Venice adapter", () => {
  it("maps a valid Venice mission-plan response into policy-checked agent tasks", async () => {
    const client = mockClient(
      JSON.stringify({
        rationale: "Split the risk report across bounded specialist tasks.",
        assumptions: ["Use the existing mission cap."],
        tasks: [
          {
            agentKind: "contract_scanner",
            objective: "Scan contract risk indicators.",
            budgetAmount: "0.40"
          },
          {
            agentKind: "wallet_behavior",
            objective: "Review wallet transfer behavior.",
            budgetAmount: "0.35"
          }
        ]
      })
    );

    const result = await planMissionWithVenice(mission, {
      env: { VENICE_API_KEY: "test-key" },
      client
    });

    expect(result.mode).toBe("live");
    expect(result.state).toBe("completed");
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0]).toMatchObject({
      id: "test-mission:contract-scanner",
      missionId: mission.id,
      agentKind: "contract_scanner",
      budget: {
        amount: "0.40",
        currency: "USDC",
        chainId: 84532
      }
    });
    expect(client.chat.completions.create).toHaveBeenCalledOnce();
  });

  it("parses valid verification and final-report responses", async () => {
    const verificationClient = mockClient(
      JSON.stringify({
        verified: true,
        confidence: "medium",
        notes: ["Evidence supports the stated risk."],
        riskSignals: ["owner-privilege"],
        requiresHumanReview: true
      })
    );
    const reportClient = mockClient(
      JSON.stringify({
        title: "Wallet / Token Risk Report",
        summary: "The target has medium risk because privileged upgrade controls remain unresolved.",
        riskLevel: "medium",
        sections: [
          {
            heading: "Contract Risk",
            body: "The contract scanner found upgrade and owner privilege signals."
          }
        ],
        recommendations: ["Verify owner controls before proceeding."],
        verificationSummary: "One specialist output was accepted with medium confidence."
      })
    );

    const verification = await verifyAgentOutputWithVenice(output, {
      env: { VENICE_API_KEY: "test-key" },
      client: verificationClient
    });
    const report = await synthesizeFinalReportWithVenice([output], {
      env: { VENICE_API_KEY: "test-key" },
      client: reportClient
    });

    expect(verification).toMatchObject({
      mode: "live",
      state: "completed",
      verified: true,
      confidence: "medium"
    });
    expect(report.report).toMatchObject({
      status: "synthesized",
      riskLevel: "medium",
      title: "Wallet / Token Risk Report"
    });
  });

  it("returns a fallback report for malformed Venice JSON", async () => {
    const client = mockClient("{not valid json");

    const result = await synthesizeFinalReportWithVenice([output], {
      env: { VENICE_API_KEY: "test-key" },
      client
    });

    expect(result.mode).toBe("fallback");
    expect(result.state).toBe("invalid_response");
    expect(result.report.status).toBe("fallback");
    expect(result.notes[0]).toContain("not valid JSON");
  });

  it("does not call Venice when VENICE_API_KEY is missing", async () => {
    const client = mockClient(
      JSON.stringify({
        verified: true,
        confidence: "high",
        notes: [],
        riskSignals: [],
        requiresHumanReview: false
      })
    );

    const result = await verifyAgentOutputWithVenice(output, {
      env: {},
      client
    });

    expect(result.mode).toBe("fallback");
    expect(result.state).toBe("skipped_missing_api_key");
    expect(result.verified).toBe(false);
    expect(result.requiresHumanReview).toBe(true);
    expect(client.chat.completions.create).not.toHaveBeenCalled();
  });

  it("keeps Venice request failures sanitized with provider diagnostics", async () => {
    const error = Object.assign(new Error("Insufficient balance to complete request."), {
      status: 402
    });
    const client: VeniceChatClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(error)
        }
      }
    };

    const result = await verifyAgentOutputWithVenice(output, {
      env: { VENICE_API_KEY: "test-key" },
      client
    });

    expect(result).toMatchObject({
      mode: "fallback",
      state: "request_failed"
    });
    expect(result.notes[0]).toBe("Venice request failed; see sanitized diagnostic fields.");
    expect(result.diagnostic).toMatchObject({
      statusCode: 402,
      providerCategory: "credits_billing"
    });
  });
});
