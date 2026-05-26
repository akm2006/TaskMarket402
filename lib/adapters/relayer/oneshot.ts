export interface OneShotRelayRequest {
  encodedPayload: string;
  chainId: number;
}

export interface OneShotRelayStatus {
  relayId: string;
  status: "submitted" | "pending" | "confirmed" | "failed";
  transactionHash?: string;
}

export async function relayWithOneShot(_request: OneShotRelayRequest): Promise<OneShotRelayStatus> {
  // TODO: Research current docs before implementing.
  throw new Error("1Shot relayer adapter is not implemented.");
}

export async function getOneShotRelayStatus(_relayId: string): Promise<OneShotRelayStatus> {
  // TODO: Research current docs before implementing.
  throw new Error("1Shot relay status adapter is not implemented.");
}
