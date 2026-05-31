import type { Mission } from "../core/types";
import { runContractScannerAgent } from "./contract-scanner";
import { runMarketContextAgent } from "./market-context";
import type { SpecialistAgentOptions, SpecialistAgentRun } from "./types";
import { outputWithSource } from "./types";
import { runWalletBehaviorAgent } from "./wallet-behavior";

function unexpectedFallback(mission: Mission, agentKind: SpecialistAgentRun["agentKind"]): SpecialistAgentRun {
  return {
    agentKind,
    source: "fallback",
    diagnostics: ["Unhandled specialist-agent error was converted into a fallback output."],
    output: outputWithSource(
      {
        taskId: `${mission.id}:${agentKind.replace("_", "-")}`,
        summary: `${agentKind.replace("_", " ")} fallback: unhandled agent error.`,
        evidence: ["Unhandled specialist-agent error was converted into a fallback output."],
        riskSignals: ["agent-runtime-fallback"]
      },
      "fallback"
    )
  };
}

async function safeRun(
  mission: Mission,
  agentKind: SpecialistAgentRun["agentKind"],
  run: () => Promise<SpecialistAgentRun>
): Promise<SpecialistAgentRun> {
  try {
    return await run();
  } catch {
    return unexpectedFallback(mission, agentKind);
  }
}

export async function runSpecialistAgents(
  mission: Mission,
  options: SpecialistAgentOptions = {}
): Promise<SpecialistAgentRun[]> {
  return Promise.all([
    safeRun(mission, "contract_scanner", () => runContractScannerAgent(mission, options)),
    safeRun(mission, "wallet_behavior", () => runWalletBehaviorAgent(mission, options)),
    safeRun(mission, "market_context", () => runMarketContextAgent(mission, options))
  ]);
}

export async function runSpecialistAgentByKind(
  mission: Mission,
  agentKind: SpecialistAgentRun["agentKind"],
  options: SpecialistAgentOptions = {}
): Promise<SpecialistAgentRun> {
  if (agentKind === "contract_scanner") {
    return safeRun(mission, agentKind, () => runContractScannerAgent(mission, options));
  }

  if (agentKind === "wallet_behavior") {
    return safeRun(mission, agentKind, () => runWalletBehaviorAgent(mission, options));
  }

  return safeRun(mission, agentKind, () => runMarketContextAgent(mission, options));
}

export type { SpecialistAgentOptions, SpecialistAgentRun, SpecialistOutputSource } from "./types";
