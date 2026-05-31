import { createInitialAgentPlan } from "../../core/agent-orchestrator";
import type { AgentOutput, Mission } from "../../core/types";
import type { AiFinalReportResult, AiPlanResult, AiProviderClient, AiVerificationResult } from "./provider-types";

const MOCK_MODEL = "deterministic-mock";

export function planMissionWithMock(mission: Mission): AiPlanResult {
  return {
    provider: "mock",
    providerRole: "deterministic_mock",
    mode: "fallback",
    state: "completed",
    model: MOCK_MODEL,
    tasks: createInitialAgentPlan(mission),
    rationale: "Deterministic local mock plan used for development fallback.",
    notes: ["No external AI provider was called."]
  };
}

export function verifyAgentOutputWithMock(output: AgentOutput): AiVerificationResult {
  return {
    provider: "mock",
    providerRole: "deterministic_mock",
    mode: "fallback",
    state: "completed",
    model: MOCK_MODEL,
    verified: false,
    confidence: "unknown",
    notes: ["Deterministic mock verification is not live AI verification."],
    riskSignals: output.riskSignals,
    requiresHumanReview: true
  };
}

export function synthesizeFinalReportWithMock(outputs: AgentOutput[]): AiFinalReportResult {
  return {
    provider: "mock",
    providerRole: "deterministic_mock",
    mode: "fallback",
    state: "completed",
    model: MOCK_MODEL,
    report: {
      title: "Wallet / Token Risk Report",
      status: "fallback",
      summary: "Deterministic mock report used for development fallback. No external AI provider was called.",
      riskLevel: "unknown",
      sections: outputs.map((output) => ({
        heading: output.taskId,
        body: `${output.summary} Evidence count: ${output.evidence.length}.`
      })),
      recommendations: ["Use Venice for final sponsor verification, or Gemini only for development/testing."],
      verificationSummary: "Mock provider does not perform live verification."
    },
    notes: ["No external AI provider was called."]
  };
}

export const mockAiProvider: AiProviderClient = {
  id: "mock",
  role: "deterministic_mock",
  async planMission(mission) {
    return planMissionWithMock(mission);
  },
  async verifyAgentOutput(output) {
    return verifyAgentOutputWithMock(output);
  },
  async synthesizeFinalReport(outputs) {
    return synthesizeFinalReportWithMock(outputs);
  }
};
