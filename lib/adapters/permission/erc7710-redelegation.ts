import type { AgentTask } from "../../core/types";

export interface RedelegationRequest {
  permissionId: string;
  task: AgentTask;
}

export interface RedelegationResult {
  delegationId: string;
  encodedPayload: string;
}

export async function createErc7710Redelegation(
  _request: RedelegationRequest
): Promise<RedelegationResult> {
  // TODO: Research current docs before implementing.
  throw new Error("ERC-7710 redelegation adapter is not implemented.");
}
