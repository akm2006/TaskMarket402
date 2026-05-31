import { describe, expect, it, vi } from "vitest";
import type { BaseRpcReadClient } from "../lib/adapters/data/base-rpc";
import { fetchDexScreenerTokenPairs } from "../lib/adapters/data/dexscreener";
import { fetchEtherscanTransactions } from "../lib/adapters/data/etherscan";
import { runContractScannerAgent } from "../lib/agents/contract-scanner";
import { runMarketContextAgent } from "../lib/agents/market-context";
import { runWalletBehaviorAgent } from "../lib/agents/wallet-behavior";
import type { Mission } from "../lib/core/types";

const validAddress = "0x0000000000000000000000000000000000000001";

const mission: Mission = {
  id: "agent-test",
  title: "Wallet / Token Risk Report",
  targetAddress: validAddress,
  status: "planned",
  createdAt: "2026-05-31T00:00:00.000Z",
  budgetPolicy: {
    missionId: "agent-test",
    totalBudget: {
      amount: "3.00",
      currency: "USDC",
      chainId: 84532
    },
    maxPerAgent: {
      amount: "0.50",
      currency: "USDC",
      chainId: 84532
    },
    expiresAt: "2026-05-31T01:00:00.000Z",
    allowedPaymentProtocol: "x402"
  }
};

function baseClient(overrides: Partial<BaseRpcReadClient> = {}): BaseRpcReadClient {
  return {
    getCode: vi.fn().mockResolvedValue("0x12345678"),
    getBalance: vi.fn().mockResolvedValue(BigInt("1000000000000000000")),
    getTransactionCount: vi.fn().mockResolvedValue(7),
    ...overrides
  };
}

describe("real-data specialist agents", () => {
  it("handles a valid address with Base RPC contract data", async () => {
    const result = await runContractScannerAgent(mission, {
      env: { BASE_CHAIN_ID: "84532" },
      baseRpc: {
        client: baseClient()
      }
    });

    expect(result.source).toBe("real-data");
    expect(result.output.evidence[0]).toBe("Output source: real-data");
    expect(result.output.summary).toContain("code size is 4 bytes");
    expect(result.output.riskSignals).toContain("contract-bytecode-present");
  });

  it("returns fallback for invalid EVM addresses without calling RPC", async () => {
    const client = baseClient();
    const result = await runContractScannerAgent(
      {
        ...mission,
        targetAddress: "not-an-address"
      },
      {
        baseRpc: {
          client
        }
      }
    );

    expect(result.source).toBe("fallback");
    expect(result.output.riskSignals).toContain("contract-data-unavailable");
    expect(client.getCode).not.toHaveBeenCalled();
  });

  it("keeps wallet behavior real-data with explicit explorer missing-key fallback evidence", async () => {
    const result = await runWalletBehaviorAgent(mission, {
      env: { BASE_CHAIN_ID: "84532" },
      baseRpc: {
        client: baseClient()
      }
    });

    expect(result.source).toBe("real-data");
    expect(result.diagnostics[0]).toContain("Explorer fallback: missing_api_key");
    expect(result.output.riskSignals).toContain("explorer-missing_api_key");
  });

  it("returns missing API key fallback from Etherscan adapter directly", async () => {
    const result = await fetchEtherscanTransactions(validAddress, {
      env: { BASE_CHAIN_ID: "8453" }
    });

    expect(result).toMatchObject({
      status: "fallback",
      reason: "missing_api_key",
      chainId: 8453
    });
  });

  it("returns DexScreener no-pair fallback for empty token-pairs response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const adapterResult = await fetchDexScreenerTokenPairs(validAddress, {
      env: { DEXSCREENER_CHAIN_ID: "base" },
      fetchFn
    });
    const agentResult = await runMarketContextAgent(mission, {
      env: { DEXSCREENER_CHAIN_ID: "base" },
      dexScreener: {
        fetchFn
      }
    });

    expect(adapterResult).toMatchObject({
      status: "fallback",
      reason: "no_pairs"
    });
    expect(agentResult.source).toBe("fallback");
    expect(agentResult.output.riskSignals).toContain("market-data-unavailable");
  });

  it("maps DexScreener pair data into a real-data market output", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            chainId: "base",
            dexId: "uniswap",
            pairAddress: "0x0000000000000000000000000000000000000002",
            baseToken: { symbol: "TKN", address: validAddress },
            quoteToken: { symbol: "WETH" },
            priceUsd: "1.23",
            liquidity: { usd: 25_000 },
            volume: { h24: 5_000 },
            txns: { h24: { buys: 6, sells: 4 } },
            priceChange: { h24: 3 }
          }
        ]),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    const result = await runMarketContextAgent(mission, {
      dexScreener: {
        fetchFn
      }
    });

    expect(result.source).toBe("real-data");
    expect(result.output.summary).toContain("TKN/WETH");
    expect(result.output.evidence).toContain("Liquidity USD: 25000");
  });
});
