import type { Address } from "viem";
import { normalizeEvmAddress } from "./base-rpc";

export type DexScreenerFallbackReason =
  | "invalid_address"
  | "no_pairs"
  | "rate_limited"
  | "api_error"
  | "network_error"
  | "malformed_response";

export interface DexScreenerToken {
  address?: string;
  name?: string;
  symbol?: string;
}

export interface DexScreenerPairSummary {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  url?: string;
  baseToken?: DexScreenerToken;
  quoteToken?: DexScreenerToken;
  priceUsd?: string;
  liquidityUsd?: number;
  volume24h?: number;
  txns24h?: number;
  priceChange24h?: number;
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

export interface DexScreenerPairsOk {
  status: "ok";
  address: Address;
  chainId: string;
  pairs: DexScreenerPairSummary[];
  topPair: DexScreenerPairSummary;
}

export interface DexScreenerPairsFallback {
  status: "fallback";
  reason: DexScreenerFallbackReason;
  message: string;
  address?: string;
  chainId?: string;
}

export type DexScreenerPairsResult = DexScreenerPairsOk | DexScreenerPairsFallback;

export interface DexScreenerOptions {
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
}

const DEFAULT_DEXSCREENER_BASE_URL = "https://api.dexscreener.com";

function recordFromUnknown(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function nestedNumber(value: unknown, outerKey: string, key: string): number | undefined {
  const field = recordFromUnknown(recordFromUnknown(value)?.[outerKey])?.[key];

  return typeof field === "number" ? field : undefined;
}

function stringField(value: unknown, key: string): string | undefined {
  const field = recordFromUnknown(value)?.[key];

  return typeof field === "string" ? field : undefined;
}

function numberField(value: unknown, key: string): number | undefined {
  const field = recordFromUnknown(value)?.[key];

  return typeof field === "number" ? field : undefined;
}

function tokenField(value: unknown, key: string): DexScreenerToken | undefined {
  const token = recordFromUnknown(recordFromUnknown(value)?.[key]);

  if (!token) {
    return undefined;
  }

  return {
    address: stringField(token, "address"),
    name: stringField(token, "name"),
    symbol: stringField(token, "symbol")
  };
}

function txns24h(value: unknown): number | undefined {
  const h24 = recordFromUnknown(recordFromUnknown(value)?.txns)?.h24;
  const buys = numberField(h24, "buys") ?? 0;
  const sells = numberField(h24, "sells") ?? 0;

  return buys || sells ? buys + sells : undefined;
}

function mapPair(value: unknown): DexScreenerPairSummary | undefined {
  const record = recordFromUnknown(value);

  if (!record) {
    return undefined;
  }

  return {
    chainId: stringField(record, "chainId"),
    dexId: stringField(record, "dexId"),
    pairAddress: stringField(record, "pairAddress"),
    url: stringField(record, "url"),
    baseToken: tokenField(record, "baseToken"),
    quoteToken: tokenField(record, "quoteToken"),
    priceUsd: stringField(record, "priceUsd"),
    liquidityUsd: nestedNumber(record, "liquidity", "usd"),
    volume24h: nestedNumber(record, "volume", "h24"),
    txns24h: txns24h(record),
    priceChange24h: nestedNumber(record, "priceChange", "h24"),
    fdv: numberField(record, "fdv"),
    marketCap: numberField(record, "marketCap"),
    pairCreatedAt: numberField(record, "pairCreatedAt")
  };
}

function byLiquidityDesc(a: DexScreenerPairSummary, b: DexScreenerPairSummary): number {
  return (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0);
}

export async function fetchDexScreenerTokenPairs(
  targetAddress: string,
  options: DexScreenerOptions = {}
): Promise<DexScreenerPairsResult> {
  const address = normalizeEvmAddress(targetAddress);

  if (!address) {
    return {
      status: "fallback",
      reason: "invalid_address",
      message: "Target is not a valid EVM token address for DexScreener lookup.",
      address: targetAddress
    };
  }

  const env = options.env ?? process.env;
  const baseUrl = env.DEXSCREENER_BASE_URL ?? DEFAULT_DEXSCREENER_BASE_URL;
  const chainId = env.DEXSCREENER_CHAIN_ID ?? "base";
  const url = new URL(`/token-pairs/v1/${encodeURIComponent(chainId)}/${address}`, baseUrl);

  try {
    const response = await (options.fetchFn ?? fetch)(url, {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return {
        status: "fallback",
        reason: response.status === 429 ? "rate_limited" : "api_error",
        message: "DexScreener request failed with a non-OK HTTP status.",
        address,
        chainId
      };
    }

    const json = await response.json();

    if (!Array.isArray(json)) {
      return {
        status: "fallback",
        reason: "malformed_response",
        message: "DexScreener token-pairs response was not an array.",
        address,
        chainId
      };
    }

    const pairs = json.map(mapPair).filter((pair): pair is DexScreenerPairSummary => Boolean(pair)).sort(byLiquidityDesc);

    if (pairs.length === 0) {
      return {
        status: "fallback",
        reason: "no_pairs",
        message: "DexScreener returned no token pairs for the target.",
        address,
        chainId
      };
    }

    return {
      status: "ok",
      address,
      chainId,
      pairs,
      topPair: pairs[0]
    };
  } catch {
    return {
      status: "fallback",
      reason: "network_error",
      message: "DexScreener request failed before a JSON response was accepted.",
      address,
      chainId
    };
  }
}
