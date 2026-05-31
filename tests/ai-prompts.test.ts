import { describe, expect, it } from "vitest";
import type { AgentOutput, Mission } from "../lib/core/types";
import {
  TASKMARKET_AI_REASONING_INSTRUCTION,
  buildAgentOutputVerificationPromptPayload,
  buildFinalReportSynthesisPromptPayload,
  buildMissionPlanPromptPayload,
  stringifyAiPromptPayload
} from "../lib/adapters/ai/prompts";

const mission: Mission = {
  id: "prompt-test",
  title: "Wallet / Token Risk Report",
  targetAddress: "0x0000000000000000000000000000000000000001",
  status: "planned",
  createdAt: "2026-05-31T00:00:00.000Z",
  budgetPolicy: {
    missionId: "prompt-test",
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
  taskId: "prompt-test:contract-scanner",
  summary: "Proxy-like upgrade surface found with owner privilege uncertainty.",
  evidence: ["Upgradeable proxy marker", "Owner role present"],
  riskSignals: ["upgradeable-contract", "owner-privilege"]
};

const forbiddenProviderPersonaTerms = [
  "development/testing AI provider",
  "Do not present yourself as Venice",
  "present yourself as Venice",
  "Gemini dev provider",
  "Venice output"
];

function promptText(value: unknown): string {
  return stringifyAiPromptPayload(value);
}

describe("provider-neutral AI prompts", () => {
  it("uses the same TaskMarket402 reasoning role across planning, verification, and synthesis", () => {
    const prompts = [
      promptText(buildMissionPlanPromptPayload(mission)),
      promptText(buildAgentOutputVerificationPromptPayload(output)),
      promptText(buildFinalReportSynthesisPromptPayload([output]))
    ];

    for (const prompt of prompts) {
      expect(prompt).toContain(TASKMARKET_AI_REASONING_INSTRUCTION);
      expect(prompt).toContain("Return JSON only");
      expect(prompt).not.toContain("development/testing AI provider");
      expect(prompt).not.toContain("Do not present yourself as Venice");
    }
  });

  it("keeps provider identity out of task prompts", () => {
    const joinedPrompts = [
      promptText(buildMissionPlanPromptPayload(mission)),
      promptText(buildAgentOutputVerificationPromptPayload(output)),
      promptText(buildFinalReportSynthesisPromptPayload([output]))
    ].join("\n");

    for (const forbiddenTerm of forbiddenProviderPersonaTerms) {
      expect(joinedPrompts).not.toContain(forbiddenTerm);
    }
  });

  it("keeps core policy authority explicit in task instructions", () => {
    const planPrompt = promptText(buildMissionPlanPromptPayload(mission));
    const verificationPrompt = promptText(buildAgentOutputVerificationPromptPayload(output));

    expect(planPrompt).toContain("Do not define or override payment policy");
    expect(planPrompt).toContain("maxPerAgent");
    expect(verificationPrompt).toContain("Do not approve payments or change policy");
  });
});
