export interface EtherscanContractSummary {
  address: string;
  verified: boolean;
  sourceName?: string;
}

export async function getContractSummaryFromEtherscan(
  _address: string
): Promise<EtherscanContractSummary> {
  // TODO: Research current docs before implementing.
  throw new Error("Etherscan adapter is not implemented.");
}
