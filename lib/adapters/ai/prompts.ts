import type { AgentOutput, Mission } from "../../core/types";

export const TASKMARKET_AI_REASONING_INSTRUCTION = "You are the AI reasoning layer for TaskMarket402.";

export const ALLOWED_SPECIALIST_AGENTS = ["contract_scanner", "wallet_behavior", "market_context"] as const;

export function stringifyAiPromptPayload(payload: unknown): string {
  return JSON.stringify(payload);
}

export function buildMissionPlanPromptPayload(mission: Mission) {
  return {
    instruction:
      `${TASKMARKET_AI_REASONING_INSTRUCTION} Return JSON only. Use only the allowed specialist agents. Respect maxPerAgent for every task. Do not define or override payment policy.`,
    rules: [
      "Return one JSON object only, with no markdown and no prose.",
      "budgetAmount must be a quoted decimal string, not a number.",
      "Use 1 to 3 specialist tasks.",
      "Use only allowedSpecialistAgents values for agentKind.",
      "Keep every budgetAmount less than or equal to maxPerAgent.",
      "Core policy is authoritative; do not approve, modify, or bypass payment policy."
    ],
    allowedSpecialistAgents: ALLOWED_SPECIALIST_AGENTS,
    expectedShape: {
      rationale: "string",
      assumptions: ["string"],
      tasks: [
        {
          agentKind: "contract_scanner | wallet_behavior | market_context",
          objective: "string",
          budgetAmount: "decimal string in USDC"
        }
      ]
    },
    exampleOutput: {
      rationale: "Split the report into bounded specialist work.",
      assumptions: ["Specialist outputs must be verified before use."],
      tasks: [
        {
          agentKind: "contract_scanner",
          objective: "Scan contract risk indicators.",
          budgetAmount: "0.40"
        }
      ]
    },
    mission: {
      id: mission.id,
      title: mission.title,
      targetAddress: mission.targetAddress,
      totalBudget: mission.budgetPolicy.totalBudget.amount,
      maxPerAgent: mission.budgetPolicy.maxPerAgent.amount,
      currency: mission.budgetPolicy.totalBudget.currency,
      chainId: mission.budgetPolicy.totalBudget.chainId
    }
  };
}

export function buildAgentOutputVerificationPromptPayload(output: AgentOutput) {
  return {
    instruction:
      `${TASKMARKET_AI_REASONING_INSTRUCTION} Return JSON only. Evaluate specialist output quality, coherence, evidence, and uncertainty. Do not approve payments or change policy.`,
    rules: [
      "Return one JSON object only, with no markdown and no prose.",
      "Evaluate whether the specialist output is coherent and evidence-backed.",
      "Preserve uncertainty when evidence is incomplete.",
      "Do not approve payments, release funds, change budget policy, or override core policy."
    ],
    expectedShape: {
      verified: "boolean",
      confidence: "low | medium | high | unknown",
      notes: ["string"],
      riskSignals: ["string"],
      requiresHumanReview: "boolean"
    },
    output
  };
}

export function buildFinalReportSynthesisPromptPayload(outputs: AgentOutput[]) {
  return {
    instruction:
      `${TASKMARKET_AI_REASONING_INSTRUCTION} Return JSON only. Synthesize a final Wallet / Token Risk Report from the provided specialist outputs only. Preserve uncertainty and do not invent chain or payment facts.`,
    rules: [
      "Return one JSON object only, with no markdown and no prose.",
      "Use only the provided specialist outputs as source material.",
      "Preserve uncertainty when specialist evidence is incomplete.",
      "Do not invent chain facts, payment facts, wallet permissions, relayer status, or sponsor integration status."
    ],
    expectedShape: {
      title: "string",
      summary: "string",
      riskLevel: "low | medium | high | unknown",
      sections: [{ heading: "string", body: "string" }],
      recommendations: ["string"],
      verificationSummary: "string"
    },
    outputs
  };
}
