export interface BaseRpcConfig {
  chainId: number;
  rpcUrl: string;
}

export async function readBaseRpc(_config: BaseRpcConfig, _method: string): Promise<unknown> {
  // TODO: Research current docs before implementing.
  throw new Error("Base RPC adapter is not implemented.");
}
