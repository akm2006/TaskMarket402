import { readBaseAddressSnapshot } from "../adapters/data/base-rpc";
import type { Mission } from "../core/types";
import type { SpecialistAgentOptions, SpecialistAgentRun } from "./types";
import { outputWithSource } from "./types";

function taskId(mission: Mission): string {
  return `${mission.id}:contract-scanner`;
}

function fallbackRun(mission: Mission, reason: string, diagnostics: string[]): SpecialistAgentRun {
  return {
    agentKind: "contract_scanner",
    source: "fallback",
    diagnostics,
    output: outputWithSource(
      {
        taskId: taskId(mission),
        summary: `Contract scanner fallback: ${reason}`,
        evidence: diagnostics,
        riskSignals: ["contract-data-unavailable"]
      },
      "fallback"
    )
  };
}

export async function runContractScannerAgent(
  mission: Mission,
  options: SpecialistAgentOptions = {}
): Promise<SpecialistAgentRun> {
  const snapshot = await readBaseAddressSnapshot(mission.targetAddress, {
    env: options.env,
    client: options.baseRpc?.client
  });

  if (snapshot.status === "fallback") {
    return fallbackRun(mission, snapshot.message, [`Base RPC fallback: ${snapshot.reason}`]);
  }

  const riskSignals = [
    snapshot.isContract ? "contract-bytecode-present" : "no-contract-bytecode",
    snapshot.codeSizeBytes > 24_000 ? "large-bytecode" : undefined,
    snapshot.transactionCount === 0 ? "no-outgoing-transactions" : undefined
  ].filter((signal): signal is string => Boolean(signal));
  const subject = snapshot.isContract ? "contract" : "EOA or address without bytecode";

  return {
    agentKind: "contract_scanner",
    source: "real-data",
    diagnostics: [],
    output: outputWithSource(
      {
        taskId: taskId(mission),
        summary: `Base RPC read found ${subject} on ${snapshot.chainName}; code size is ${snapshot.codeSizeBytes} bytes.`,
        evidence: [
          `Address: ${snapshot.address}`,
          `Chain: ${snapshot.chainName} (${snapshot.chainId})`,
          `Bytecode present: ${snapshot.isContract ? "yes" : "no"}`,
          `Code size: ${snapshot.codeSizeBytes} bytes`,
          `Native balance: ${snapshot.nativeBalanceEth} ETH`,
          `Outgoing transaction count: ${snapshot.transactionCount}`,
          `RPC source: ${snapshot.rpcUrlSource}`
        ],
        riskSignals
      },
      "real-data"
    )
  };
}
