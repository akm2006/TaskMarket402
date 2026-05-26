import type { Mission, MissionBudgetPolicy } from "./types";

export function createMission(input: {
  id: string;
  title: string;
  targetAddress: string;
  budgetPolicy: MissionBudgetPolicy;
  createdAt: string;
}): Mission {
  return {
    ...input,
    status: "draft"
  };
}
