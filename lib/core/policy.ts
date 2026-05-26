import type { AgentTask, MissionBudgetPolicy, MoneyAmount } from "./types";

function parseAmount(value: MoneyAmount): number {
  return Number.parseFloat(value.amount);
}

export function isSubBudgetAllowed(policy: MissionBudgetPolicy, budget: MoneyAmount): boolean {
  return (
    budget.currency === policy.totalBudget.currency &&
    budget.chainId === policy.totalBudget.chainId &&
    parseAmount(budget) <= parseAmount(policy.maxPerAgent)
  );
}

export function validateTaskBudgets(policy: MissionBudgetPolicy, tasks: AgentTask[]): boolean {
  const total = tasks.reduce((sum, task) => sum + parseAmount(task.budget), 0);

  return (
    total <= parseAmount(policy.totalBudget) &&
    tasks.every((task) => isSubBudgetAllowed(policy, task.budget))
  );
}
