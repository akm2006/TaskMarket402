import type { AgentTask, Mission } from "./types";
import { validateTaskBudgets } from "./policy";

export function createInitialAgentPlan(mission: Mission): AgentTask[] {
  const base = {
    missionId: mission.id,
    budget: {
      currency: mission.budgetPolicy.totalBudget.currency,
      chainId: mission.budgetPolicy.totalBudget.chainId
    }
  } as const;

  const tasks: AgentTask[] = [
    {
      ...base,
      id: `${mission.id}:contract-scanner`,
      agentKind: "contract_scanner",
      budget: { ...base.budget, amount: "0.40" },
      objective: "Scan contract and token risk indicators."
    },
    {
      ...base,
      id: `${mission.id}:wallet-behavior`,
      agentKind: "wallet_behavior",
      budget: { ...base.budget, amount: "0.35" },
      objective: "Analyze wallet behavior and transfer patterns."
    },
    {
      ...base,
      id: `${mission.id}:market-context`,
      agentKind: "market_context",
      budget: { ...base.budget, amount: "0.25" },
      objective: "Summarize market context and liquidity signals."
    }
  ];

  if (!validateTaskBudgets(mission.budgetPolicy, tasks)) {
    throw new Error("Initial agent plan exceeds mission budget policy.");
  }

  return tasks;
}
