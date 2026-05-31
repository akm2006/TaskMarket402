import type { Address } from "viem";
import { normalizeEvmAddress } from "./base-rpc";

export type EtherscanFallbackReason =
  | "invalid_address"
  | "missing_api_key"
  | "rate_limited"
  | "api_error"
  | "network_error"
  | "malformed_response";

export interface EtherscanTransactionSummary {
  hash: string;
  from: string;
  to: string;
  valueWei: string;
  timeStamp: string;
  isError: boolean;
  methodId?: string;
  functionName?: string;
}

export interface EtherscanTransactionsOk {
  status: "ok";
  address: Address;
  chainId: number;
  transactions: EtherscanTransactionSummary[];
}

export interface EtherscanTransactionsFallback {
  status: "fallback";
  reason: EtherscanFallbackReason;
  message: string;
  address?: string;
  chainId?: number;
}

export type EtherscanTransactionsResult = EtherscanTransactionsOk | EtherscanTransactionsFallback;

export interface EtherscanOptions {
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  chainId?: number;
}

interface EtherscanResponseRecord {
  status?: unknown;
  message?: unknown;
  result?: unknown;
}

const DEFAULT_ETHERSCAN_BASE_URL = "https://api.etherscan.io/v2/api";

function parseChainId(env: Record<string, string | undefined>, override?: number): number {
  if (override) {
    return override;
  }

  const parsed = Number(env.BASE_CHAIN_ID ?? env.NEXT_PUBLIC_CHAIN_ID);

  return Number.isInteger(parsed) ? parsed : 84532;
}

function recordFromUnknown(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function stringField(value: unknown, key: string): string | undefined {
  const field = recordFromUnknown(value)?.[key];

  return typeof field === "string" ? field : undefined;
}

function isRateLimitMessage(value: string): boolean {
  const normalized = value.toLowerCase();

  return normalized.includes("rate") || normalized.includes("limit") || normalized.includes("max rate");
}

function mapTransaction(value: unknown): EtherscanTransactionSummary | undefined {
  const record = recordFromUnknown(value);

  if (!record) {
    return undefined;
  }

  const hash = stringField(record, "hash");
  const from = stringField(record, "from");
  const to = stringField(record, "to") ?? "";
  const valueWei = stringField(record, "value") ?? "0";
  const timeStamp = stringField(record, "timeStamp") ?? "";

  if (!hash || !from) {
    return undefined;
  }

  return {
    hash,
    from,
    to,
    valueWei,
    timeStamp,
    isError: stringField(record, "isError") === "1",
    methodId: stringField(record, "methodId"),
    functionName: stringField(record, "functionName")
  };
}

export async function fetchEtherscanTransactions(
  targetAddress: string,
  options: EtherscanOptions = {}
): Promise<EtherscanTransactionsResult> {
  const address = normalizeEvmAddress(targetAddress);

  if (!address) {
    return {
      status: "fallback",
      reason: "invalid_address",
      message: "Target is not a valid EVM address for explorer lookup.",
      address: targetAddress
    };
  }

  const env = options.env ?? process.env;
  const apiKey = env.ETHERSCAN_API_KEY;
  const chainId = parseChainId(env, options.chainId);

  if (!apiKey) {
    return {
      status: "fallback",
      reason: "missing_api_key",
      message: "ETHERSCAN_API_KEY is not configured; explorer transaction history was skipped.",
      address,
      chainId
    };
  }

  const baseUrl = env.ETHERSCAN_BASE_URL ?? DEFAULT_ETHERSCAN_BASE_URL;
  const url = new URL(baseUrl);
  url.searchParams.set("chainid", String(chainId));
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "txlist");
  url.searchParams.set("address", address);
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "999999999");
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "20");
  url.searchParams.set("sort", "desc");
  url.searchParams.set("apikey", apiKey);

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
        message: "Etherscan V2 request failed with a non-OK HTTP status.",
        address,
        chainId
      };
    }

    const json = (await response.json()) as EtherscanResponseRecord;
    const message = typeof json.message === "string" ? json.message : "";

    if (json.status === "1" && Array.isArray(json.result)) {
      return {
        status: "ok",
        address,
        chainId,
        transactions: json.result.map(mapTransaction).filter((item): item is EtherscanTransactionSummary => Boolean(item))
      };
    }

    if (typeof json.result === "string" && json.result.toLowerCase().includes("no transactions")) {
      return {
        status: "ok",
        address,
        chainId,
        transactions: []
      };
    }

    return {
      status: "fallback",
      reason: isRateLimitMessage(message) || (typeof json.result === "string" && isRateLimitMessage(json.result))
        ? "rate_limited"
        : "api_error",
      message: "Etherscan V2 did not return an accepted transaction list.",
      address,
      chainId
    };
  } catch {
    return {
      status: "fallback",
      reason: "network_error",
      message: "Etherscan V2 request failed before a JSON response was accepted.",
      address,
      chainId
    };
  }
}
