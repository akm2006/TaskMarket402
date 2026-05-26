import type { MissionBudgetPolicy } from "../../core/types";

export interface MetaMaskPermissionReceipt {
  permissionId: string;
  accountAddress: string;
  chainId: number;
}

export async function requestMissionBudgetPermission(
  _policy: MissionBudgetPolicy
): Promise<MetaMaskPermissionReceipt> {
  // TODO: Research current docs before implementing.
  throw new Error("MetaMask mission budget permission adapter is not implemented.");
}
