import { fetchDexScreenerTokenPairs } from "../adapters/data/dexscreener";
import type { DexScreenerPairSummary } from "../adapters/data/dexscreener";
import type { Mission } from "../core/types";
import type { SpecialistAgentOptions, SpecialistAgentRun } from "./types";
import { outputWithSource } from "./types";

function taskId(mission: Mission): string {
  return `${mission.id}:market-context`;
}

function fallbackRun(mission: Mission, reason: string, diagnostics: string[]): SpecialistAgentRun {
  return {
    agentKind: "market_context",
    source: "fallback",
    diagnostics,
    output: outputWithSource(
      {
        taskId: taskId(mission),
        summary: `Market context fallback: ${reason}`,
        evidence: diagnostics,
        riskSignals: ["market-data-unavailable"]
      },
      "fallback"
    )
  };
}

function pairName(pair: DexScreenerPairSummary): string {
  const baseSymbol = pair.baseToken?.symbol ?? "base token";
  const quoteSymbol = pair.quoteToken?.symbol ?? "quote token";

  return `${baseSymbol}/${quoteSymbol}`;
}

export async function runMarketContextAgent(
  mission: Mission,
  options: SpecialistAgentOptions = {}
): Promise<SpecialistAgentRun> {
  const result = await fetchDexScreenerTokenPairs(mission.targetAddress, {
    env: options.env,
    fetchFn: options.dexScreener?.fetchFn
  });

  if (result.status === "fallback") {
    return fallbackRun(mission, result.message, [`DexScreener fallback: ${result.reason}`]);
  }

  const topPair = result.topPair;
  const liquidityUsd = topPair.liquidityUsd ?? 0;
  const volume24h = topPair.volume24h ?? 0;
  const priceChange24h = topPair.priceChange24h ?? 0;
  const riskSignals = [
    liquidityUsd < 10_000 ? "thin-liquidity" : undefined,
    volume24h < 1_000 ? "low-24h-volume" : undefined,
    Math.abs(priceChange24h) > 20 ? "high-24h-volatility" : undefined
  ].filter((signal): signal is string => Boolean(signal));

  return {
    agentKind: "market_context",
    source: "real-data",
    diagnostics: [],
    output: outputWithSource(
      {
        taskId: taskId(mission),
        summary: `DexScreener found ${result.pairs.length} Base pair(s); strongest liquidity pair is ${pairName(topPair)} on ${topPair.dexId ?? "unknown DEX"}.`,
        evidence: [
          `DexScreener chain: ${result.chainId}`,
          `Pair: ${pairName(topPair)}`,
          `DEX: ${topPair.dexId ?? "unknown"}`,
          `Pair address: ${topPair.pairAddress ?? "unknown"}`,
          `Price USD: ${topPair.priceUsd ?? "unavailable"}`,
          `Liquidity USD: ${liquidityUsd}`,
          `24h volume USD: ${volume24h}`,
          `24h tx count: ${topPair.txns24h ?? "unavailable"}`,
          `24h price change percent: ${priceChange24h}`
        ],
        riskSignals
      },
      "real-data"
    )
  };
}
