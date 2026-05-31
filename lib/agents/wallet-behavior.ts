import { readBaseAddressSnapshot } from "../adapters/data/base-rpc";
import { fetchEtherscanTransactions, type EtherscanTransactionsResult } from "../adapters/data/etherscan";
import type { Mission } from "../core/types";
import type { SpecialistAgentOptions, SpecialistAgentRun } from "./types";
import { outputWithSource } from "./types";

function taskId(mission: Mission): string {
  return `${mission.id}:wallet-behavior`;
}

function fallbackRun(mission: Mission, reason: string, diagnostics: string[]): SpecialistAgentRun {
  return {
    agentKind: "wallet_behavior",
    source: "fallback",
    diagnostics,
    output: outputWithSource(
      {
        taskId: taskId(mission),
        summary: `Wallet behavior fallback: ${reason}`,
        evidence: diagnostics,
        riskSignals: ["wallet-data-unavailable"]
      },
      "fallback"
    )
  };
}

function uniqueCounterpartyCount(transactions: EtherscanTransactionsResult): number | undefined {
  if (transactions.status !== "ok") {
    return undefined;
  }

  const counterparties = new Set<string>();

  for (const transaction of transactions.transactions) {
    if (transaction.from) {
      counterparties.add(transaction.from.toLowerCase());
    }

    if (transaction.to) {
      counterparties.add(transaction.to.toLowerCase());
    }
  }

  return counterparties.size;
}

function failedTransactionCount(transactions: EtherscanTransactionsResult): number | undefined {
  if (transactions.status !== "ok") {
    return undefined;
  }

  return transactions.transactions.filter((transaction) => transaction.isError).length;
}

export async function runWalletBehaviorAgent(
  mission: Mission,
  options: SpecialistAgentOptions = {}
): Promise<SpecialistAgentRun> {
  const baseSnapshot = await readBaseAddressSnapshot(mission.targetAddress, {
    env: options.env,
    client: options.baseRpc?.client
  });
  const explorer = await fetchEtherscanTransactions(mission.targetAddress, {
    env: options.env,
    fetchFn: options.etherscan?.fetchFn,
    chainId: options.etherscan?.chainId
  });

  if (baseSnapshot.status === "fallback") {
    return fallbackRun(mission, baseSnapshot.message, [
      `Base RPC fallback: ${baseSnapshot.reason}`,
      explorer.status === "fallback" ? `Explorer fallback: ${explorer.reason}` : "Explorer returned data but RPC baseline failed"
    ]);
  }

  const counterpartyCount = uniqueCounterpartyCount(explorer);
  const failedCount = failedTransactionCount(explorer);
  const explorerEvidence =
    explorer.status === "ok"
      ? [
          `Recent explorer transactions: ${explorer.transactions.length}`,
          `Recent failed transactions: ${failedCount ?? 0}`,
          `Recent unique counterparties: ${counterpartyCount ?? 0}`
        ]
      : [`Explorer fallback: ${explorer.reason}`];
  const riskSignals = [
    baseSnapshot.transactionCount === 0 ? "inactive-address" : undefined,
    baseSnapshot.nativeBalanceEth === "0" ? "zero-native-balance" : undefined,
    explorer.status === "fallback" ? `explorer-${explorer.reason}` : undefined,
    typeof failedCount === "number" && failedCount > 0 ? "recent-failed-transactions" : undefined,
    typeof counterpartyCount === "number" && counterpartyCount <= 1 && baseSnapshot.transactionCount > 1
      ? "low-counterparty-diversity"
      : undefined
  ].filter((signal): signal is string => Boolean(signal));

  return {
    agentKind: "wallet_behavior",
    source: "real-data",
    diagnostics: explorer.status === "fallback" ? [`Explorer fallback: ${explorer.reason}`] : [],
    output: outputWithSource(
      {
        taskId: taskId(mission),
        summary: `Base RPC read found ${baseSnapshot.transactionCount} outgoing transactions and ${baseSnapshot.nativeBalanceEth} ETH native balance.`,
        evidence: [
          `Address: ${baseSnapshot.address}`,
          `Chain: ${baseSnapshot.chainName} (${baseSnapshot.chainId})`,
          `Native balance: ${baseSnapshot.nativeBalanceEth} ETH`,
          `Outgoing transaction count: ${baseSnapshot.transactionCount}`,
          ...explorerEvidence
        ],
        riskSignals
      },
      "real-data"
    )
  };
}
