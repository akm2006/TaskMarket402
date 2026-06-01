import { x402Client, x402HTTPClient, type x402PaymentResult } from "@x402/core/client";
import type { Network, SettleResponse } from "@x402/core/types";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";
import type { SpecialistAgentRun } from "../../agents";
import type { AgentTask } from "../../core/types";
import {
  contractScannerX402Mode,
  createDevPaymentSignature,
  DEFAULT_X402_BASE_SEPOLIA_NETWORK,
  DEFAULT_X402_CONTRACT_SCANNER_PRICE,
  X402_PAYMENT_SIGNATURE_HEADER,
  type X402ProtectedResource
} from "./x402-server";

export interface X402PaymentChallenge {
  resourceUrl: string;
  resourceId?: string;
  amount: string;
  currency: string;
  network: string;
}

export interface X402PaymentResult {
  paymentId: string;
  status: "prepared" | "submitted" | "settled" | "failed";
  mode: "dev";
  simulatedSettlement: true;
}

export interface X402DevPaymentProof {
  header: typeof X402_PAYMENT_SIGNATURE_HEADER;
  value: string;
  mode: "dev";
  simulatedSettlement: true;
}

export type RealX402PaymentState = "real_x402_paid" | "real_x402_failed" | "real_x402_unavailable";
export type RealX402FailureCategory =
  | "configuration"
  | "payment_required"
  | "settlement"
  | "request"
  | "invalid_response"
  | "unknown";

export interface X402ContractScannerBuyerConfig {
  privateKey: `0x${string}`;
  url: string;
  network: Network;
  price: string;
  rpcUrl?: string;
}

export type X402ContractScannerBuyerConfigResult =
  | {
      ok: true;
      mode: "real";
      config: X402ContractScannerBuyerConfig;
      buyerAddress: `0x${string}`;
    }
  | {
      ok: false;
      mode: "real" | "simulated";
      missing: string[];
      invalid: string[];
    };

export interface X402ContractScannerPaymentResult {
  state: RealX402PaymentState;
  responseStatus?: number;
  failureCategory?: RealX402FailureCategory;
  errorClass?: string;
  settlementPresent: boolean;
  transactionPresent: boolean;
  network?: string;
  amount?: string;
  specialistRun?: SpecialistAgentRun;
}

export interface PayContractScannerWithX402Options {
  env?: Record<string, string | undefined>;
  fetchFn?: typeof globalThis.fetch;
  fetchWithPayment?: typeof globalThis.fetch;
  settlementInspector?: (response: Response) => Promise<x402PaymentResult>;
}

export function prepareDevX402PaymentProof(
  resource: X402ProtectedResource,
  env: Record<string, string | undefined> = process.env
): X402DevPaymentProof {
  return {
    header: X402_PAYMENT_SIGNATURE_HEADER,
    value: createDevPaymentSignature(resource, env),
    mode: "dev",
    simulatedSettlement: true
  };
}

function hasValue(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function normalizePrivateKey(value: string | undefined): `0x${string}` | undefined {
  if (!hasValue(value)) {
    return undefined;
  }

  const trimmed = value.trim();
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;

  return /^0x[a-fA-F0-9]{64}$/.test(normalized) ? (normalized as `0x${string}`) : undefined;
}

function priceIsValid(value: string): boolean {
  const trimmed = normalizePrice(value);
  const priceBody = trimmed.charCodeAt(0) === 36 ? trimmed.slice(1) : trimmed;

  return /^[0-9]+(?:\.[0-9]{1,6})?$/.test(priceBody);
}

function normalizePrice(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith("$.")) {
    return `$0${trimmed.slice(1)}`;
  }

  if (trimmed.startsWith(".")) {
    return `$0${trimmed}`;
  }

  return trimmed;
}

function isSpecialistAgentRun(value: unknown): value is SpecialistAgentRun {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const output = record.output as Record<string, unknown> | undefined;

  return (
    (record.agentKind === "contract_scanner" ||
      record.agentKind === "wallet_behavior" ||
      record.agentKind === "market_context") &&
    (record.source === "real-data" || record.source === "fallback" || record.source === "mock") &&
    typeof output?.taskId === "string" &&
    typeof output.summary === "string" &&
    Array.isArray(output.evidence) &&
    Array.isArray(output.riskSignals) &&
    Array.isArray(record.diagnostics)
  );
}

function bodySpecialistRun(body: unknown): SpecialistAgentRun | undefined {
  if (typeof body !== "object" || body === null || !("specialistRun" in body)) {
    return undefined;
  }

  const candidate = (body as { specialistRun?: unknown }).specialistRun;

  return isSpecialistAgentRun(candidate) ? candidate : undefined;
}

function settleInfo(settleResponse: SettleResponse | undefined): {
  settlementPresent: boolean;
  transactionPresent: boolean;
  network?: string;
  amount?: string;
} {
  return {
    settlementPresent: Boolean(settleResponse),
    transactionPresent: Boolean(settleResponse?.transaction),
    network: settleResponse?.network,
    amount: settleResponse?.amount
  };
}

function createConfiguredX402Client(config: X402ContractScannerBuyerConfig): x402Client {
  const signer = privateKeyToAccount(config.privateKey);
  const client = new x402Client();

  registerExactEvmScheme(
    client,
    config.rpcUrl
      ? {
          signer,
          networks: [config.network],
          schemeOptions: {
            rpcUrl: config.rpcUrl
          }
        }
      : {
          signer,
          networks: [config.network]
        }
  );

  return client;
}

export function resolveContractScannerBuyerConfig(
  env: Record<string, string | undefined> = process.env
): X402ContractScannerBuyerConfigResult {
  const mode = contractScannerX402Mode(env);

  if (mode !== "real") {
    return {
      ok: false,
      mode,
      missing: [],
      invalid: []
    };
  }

  const missing: string[] = [];
  const invalid: string[] = [];
  const privateKey = normalizePrivateKey(env.X402_BUYER_PRIVATE_KEY);
  const url = env.X402_CONTRACT_SCANNER_URL?.trim();
  const network = env.X402_SETTLEMENT_NETWORK?.trim();
  const price = normalizePrice(env.X402_CONTRACT_SCANNER_PRICE_USD || DEFAULT_X402_CONTRACT_SCANNER_PRICE);

  if (!hasValue(env.X402_BUYER_PRIVATE_KEY)) {
    missing.push("X402_BUYER_PRIVATE_KEY");
  } else if (!privateKey) {
    invalid.push("X402_BUYER_PRIVATE_KEY");
  }

  if (!hasValue(url)) {
    missing.push("X402_CONTRACT_SCANNER_URL");
  } else {
    try {
      new URL(url);
    } catch {
      invalid.push("X402_CONTRACT_SCANNER_URL");
    }
  }

  if (!hasValue(network)) {
    missing.push("X402_SETTLEMENT_NETWORK");
  } else if (network !== DEFAULT_X402_BASE_SEPOLIA_NETWORK) {
    invalid.push("X402_SETTLEMENT_NETWORK");
  }

  if (!priceIsValid(price)) {
    invalid.push("X402_CONTRACT_SCANNER_PRICE_USD");
  }

  if (missing.length > 0 || invalid.length > 0 || !privateKey || !url || !network) {
    return {
      ok: false,
      mode,
      missing,
      invalid
    };
  }

  return {
    ok: true,
    mode,
    config: {
      privateKey,
      url,
      network: network as Network,
      price,
      rpcUrl: env.BASE_RPC_URL?.trim() || undefined
    },
    buyerAddress: privateKeyToAccount(privateKey).address
  };
}

export async function payContractScannerWithX402(
  payload: {
    targetAddress: string;
  },
  options: PayContractScannerWithX402Options = {}
): Promise<X402ContractScannerPaymentResult> {
  const env = options.env ?? process.env;
  const configResult = resolveContractScannerBuyerConfig(env);

  if (!configResult.ok) {
    return {
      state: "real_x402_unavailable",
      failureCategory: "configuration",
      settlementPresent: false,
      transactionPresent: false
    };
  }

  try {
    const client = createConfiguredX402Client(configResult.config);
    const paidFetch =
      options.fetchWithPayment ??
      wrapFetchWithPayment(options.fetchFn ?? globalThis.fetch, client);
    const response = await paidFetch(configResult.config.url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        targetAddress: payload.targetAddress
      })
    });
    const responseStatus = response.status;
    const inspected = options.settlementInspector
      ? await options.settlementInspector(response)
      : await new x402HTTPClient(client).processResponse(response);

    if (inspected.kind === "success") {
      const specialistRun = bodySpecialistRun(inspected.body);

      if (!specialistRun) {
        return {
          state: "real_x402_failed",
          responseStatus,
          failureCategory: "invalid_response",
          ...settleInfo(inspected.settleResponse)
        };
      }

      return {
        state: "real_x402_paid",
        responseStatus,
        specialistRun,
        ...settleInfo(inspected.settleResponse)
      };
    }

    if (inspected.kind === "settle_failed") {
      return {
        state: "real_x402_failed",
        responseStatus,
        failureCategory: "settlement",
        ...settleInfo(inspected.settleResponse)
      };
    }

    if (inspected.kind === "payment_required") {
      return {
        state: "real_x402_failed",
        responseStatus,
        failureCategory: "payment_required",
        settlementPresent: false,
        transactionPresent: false
      };
    }

    if (inspected.kind === "error") {
      return {
        state: "real_x402_failed",
        responseStatus,
        failureCategory: "request",
        settlementPresent: false,
        transactionPresent: false
      };
    }

    return {
      state: "real_x402_failed",
      responseStatus,
      failureCategory: "invalid_response",
      settlementPresent: false,
      transactionPresent: false
    };
  } catch (error) {
    return {
      state: "real_x402_failed",
      failureCategory: "request",
      errorClass: error instanceof Error ? error.name : "UnknownError",
      settlementPresent: false,
      transactionPresent: false
    };
  }
}

export async function payX402Challenge(
  task: AgentTask,
  challenge: X402PaymentChallenge
): Promise<X402PaymentResult> {
  return {
    paymentId: `dev_${(challenge.resourceId ?? `${task.missionId}:${task.id}`).replace(/[^a-zA-Z0-9]/g, "_")}`,
    status: "prepared",
    mode: "dev",
    simulatedSettlement: true
  };
}
