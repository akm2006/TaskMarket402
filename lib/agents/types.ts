import type { AgentKind, AgentOutput, Mission } from "../core/types";
import type { BaseRpcOptions } from "../adapters/data/base-rpc";
import type { DexScreenerOptions } from "../adapters/data/dexscreener";
import type { EtherscanOptions } from "../adapters/data/etherscan";

export type SpecialistAgentKind = Exclude<AgentKind, "manager">;
export type SpecialistOutputSource = "real-data" | "fallback" | "mock";

export interface SpecialistAgentRun {
  agentKind: SpecialistAgentKind;
  source: SpecialistOutputSource;
  output: AgentOutput;
  diagnostics: string[];
}

export interface SpecialistAgentOptions {
  env?: Record<string, string | undefined>;
  baseRpc?: Omit<BaseRpcOptions, "env">;
  dexScreener?: Omit<DexScreenerOptions, "env">;
  etherscan?: Omit<EtherscanOptions, "env">;
}

export interface SpecialistAgentContext {
  mission: Mission;
  options?: SpecialistAgentOptions;
}

export function outputWithSource(output: AgentOutput, source: SpecialistOutputSource): AgentOutput {
  return {
    ...output,
    evidence: [`Output source: ${source}`, ...output.evidence]
  };
}
