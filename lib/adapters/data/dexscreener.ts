export interface DexScreenerTokenContext {
  address: string;
  liquidityUsd?: number;
  volume24hUsd?: number;
}

export async function getTokenContextFromDexScreener(
  _address: string
): Promise<DexScreenerTokenContext> {
  // TODO: Research current docs before implementing.
  throw new Error("DexScreener adapter is not implemented.");
}
