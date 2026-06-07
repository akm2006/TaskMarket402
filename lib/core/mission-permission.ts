import type { MissionBudgetPolicy, MoneyAmount } from "./types";

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const USDC_DECIMALS = 6;
export const DEFAULT_PERMISSION_PERIOD_SECONDS = 3600;

export type WalletReadinessState = "wallet_not_connected" | "wallet_connected" | "wrong_network";

export type MissionPermissionUiState =
  | WalletReadinessState
  | "permission_requested"
  | "permission_granted"
  | "permission_rejected"
  | "permission_unavailable";

export type MissionPermissionRejectionReason =
  | "invalid_chain"
  | "invalid_budget"
  | "max_per_agent_exceeds_total"
  | "unsupported_token"
  | "missing_expiry"
  | "expired_permission"
  | "invalid_delegate_address";

export interface MissionPermissionRequestShape {
  chainId: number;
  to: `0x${string}`;
  expiry: number;
  permission: {
    type: "erc20-token-periodic";
    isAdjustmentAllowed: false;
    data: {
      tokenAddress: `0x${string}`;
      periodAmount: bigint;
      periodDuration: number;
      justification: string;
    };
  };
}

export interface MissionPermissionRequestSummary {
  missionId: string;
  walletAddress?: `0x${string}`;
  delegateAddress: `0x${string}`;
  chainId: number;
  tokenAddress: `0x${string}`;
  totalBudget: MoneyAmount;
  maxPerAgent: MoneyAmount;
  periodAmountBaseUnits: string;
  periodDurationSeconds: number;
  expiresAt: string;
  permissionType: "erc20-token-periodic";
}

export interface MissionPermissionRequest {
  summary: MissionPermissionRequestSummary;
  requestShape: MissionPermissionRequestShape;
}

export interface MissionPermissionReceipt {
  state: "permission_granted";
  receiptId: string;
  contextHash?: string;
  delegationManagerHash?: string;
  dependencyCount: number;
  walletAddress?: `0x${string}`;
  delegateAddress: `0x${string}`;
  chainId: number;
  tokenAddress: `0x${string}`;
  totalBudget: MoneyAmount;
  maxPerAgent: MoneyAmount;
  permissionType: "erc20-token-periodic";
  periodDurationSeconds: number;
  expiresAt: string;
  grantedAt: string;
}

export type MissionPermissionValidationResult =
  | {
      ok: true;
      value: MissionPermissionRequest;
    }
  | {
      ok: false;
      reason: MissionPermissionRejectionReason;
      message: string;
    };

export interface MissionPermissionMappingOptions {
  delegateAddress: string;
  tokenAddress?: string;
  nowSeconds?: number;
  periodDurationSeconds?: number;
  justification?: string;
  walletAddress?: string;
}

export interface SanitizedReceiptInput {
  rawReceipt: unknown;
  request: MissionPermissionRequest;
  walletAddress?: string;
  grantedAt?: string;
}

const addressPattern = /^0x[a-fA-F0-9]{40}$/;

export function isEvmAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(value && addressPattern.test(value));
}

export function normalizeEvmAddress(value: string): `0x${string}` | null {
  const trimmed = value.trim();

  if (!isEvmAddress(trimmed)) {
    return null;
  }

  return trimmed as `0x${string}`;
}

export function parseDecimalToBaseUnits(value: string, decimals = USDC_DECIMALS): bigint | null {
  const trimmed = value.trim();

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }

  const [whole, fraction = ""] = trimmed.split(".");

  if (fraction.length > decimals) {
    return null;
  }

  const wholeUnits = BigInt(whole) * BigInt(10) ** BigInt(decimals);
  const fractionUnits = BigInt((fraction.padEnd(decimals, "0") || "0").slice(0, decimals));

  return wholeUnits + fractionUnits;
}

export function missionPolicyToPermissionRequest(
  policy: MissionBudgetPolicy,
  options: MissionPermissionMappingOptions
): MissionPermissionValidationResult {
  const tokenAddress = normalizeEvmAddress(options.tokenAddress ?? BASE_SEPOLIA_USDC_ADDRESS);
  const delegateAddress = normalizeEvmAddress(options.delegateAddress);
  const walletAddress = options.walletAddress ? normalizeEvmAddress(options.walletAddress) : undefined;
  const periodDurationSeconds = options.periodDurationSeconds ?? DEFAULT_PERMISSION_PERIOD_SECONDS;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const expirySeconds = Math.floor(new Date(policy.expiresAt).getTime() / 1000);
  const totalBudgetBaseUnits = parseDecimalToBaseUnits(policy.totalBudget.amount);
  const maxPerAgentBaseUnits = parseDecimalToBaseUnits(policy.maxPerAgent.amount);

  if (policy.totalBudget.chainId !== BASE_SEPOLIA_CHAIN_ID || policy.maxPerAgent.chainId !== BASE_SEPOLIA_CHAIN_ID) {
    return {
      ok: false,
      reason: "invalid_chain",
      message: "Mission permissions are currently limited to Base Sepolia."
    };
  }

  if (policy.totalBudget.currency !== "USDC" || policy.maxPerAgent.currency !== "USDC" || !tokenAddress) {
    return {
      ok: false,
      reason: "unsupported_token",
      message: "Mission permissions currently support Base Sepolia USDC only."
    };
  }

  if (
    !totalBudgetBaseUnits ||
    totalBudgetBaseUnits <= BigInt(0) ||
    !maxPerAgentBaseUnits ||
    maxPerAgentBaseUnits <= BigInt(0)
  ) {
    return {
      ok: false,
      reason: "invalid_budget",
      message: "Mission budget and max per-agent budget must be positive USDC amounts."
    };
  }

  if (maxPerAgentBaseUnits > totalBudgetBaseUnits) {
    return {
      ok: false,
      reason: "max_per_agent_exceeds_total",
      message: "Max per-agent budget cannot exceed the total mission budget."
    };
  }

  if (!Number.isFinite(expirySeconds)) {
    return {
      ok: false,
      reason: "missing_expiry",
      message: "Mission permission requires a valid expiry timestamp."
    };
  }

  if (expirySeconds <= nowSeconds) {
    return {
      ok: false,
      reason: "expired_permission",
      message: "Mission permission expiry must be in the future."
    };
  }

  if (!delegateAddress) {
    return {
      ok: false,
      reason: "invalid_delegate_address",
      message: "Mission permission requires a valid delegate or session account address."
    };
  }

  const requestShape: MissionPermissionRequestShape = {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    to: delegateAddress,
    expiry: expirySeconds,
    permission: {
      type: "erc20-token-periodic",
      isAdjustmentAllowed: false,
      data: {
        tokenAddress,
        periodAmount: totalBudgetBaseUnits,
        periodDuration: periodDurationSeconds,
        justification:
          options.justification ??
          `TaskMarket402 mission budget ${policy.missionId}: spend up to ${policy.totalBudget.amount} USDC within scoped mission policy.`
      }
    }
  };

  return {
    ok: true,
    value: {
      requestShape,
      summary: {
        missionId: policy.missionId,
        walletAddress: walletAddress ?? undefined,
        delegateAddress,
        chainId: BASE_SEPOLIA_CHAIN_ID,
        tokenAddress,
        totalBudget: policy.totalBudget,
        maxPerAgent: policy.maxPerAgent,
        periodAmountBaseUnits: totalBudgetBaseUnits.toString(),
        periodDurationSeconds,
        expiresAt: new Date(expirySeconds * 1000).toISOString(),
        permissionType: "erc20-token-periodic"
      }
    }
  };
}

export function sanitizeMissionPermissionReceipt({
  rawReceipt,
  request,
  walletAddress,
  grantedAt
}: SanitizedReceiptInput): MissionPermissionReceipt {
  const rawRecord = isRecord(rawReceipt) ? rawReceipt : {};
  const context = rawRecord.context;
  const delegationManager = rawRecord.delegationManager;
  const dependencies = Array.isArray(rawRecord.dependencies) ? rawRecord.dependencies : [];
  const normalizedWalletAddress = walletAddress ? normalizeEvmAddress(walletAddress) : undefined;

  return {
    state: "permission_granted",
    receiptId: createRedactedHash({
      context,
      delegationManager,
      delegateAddress: request.summary.delegateAddress,
      walletAddress: normalizedWalletAddress,
      chainId: request.summary.chainId,
      expiresAt: request.summary.expiresAt
    }),
    contextHash: context ? createRedactedHash(context) : undefined,
    delegationManagerHash: delegationManager ? createRedactedHash(delegationManager) : undefined,
    dependencyCount: dependencies.length,
    walletAddress: normalizedWalletAddress ?? request.summary.walletAddress,
    delegateAddress: request.summary.delegateAddress,
    chainId: request.summary.chainId,
    tokenAddress: request.summary.tokenAddress,
    totalBudget: request.summary.totalBudget,
    maxPerAgent: request.summary.maxPerAgent,
    permissionType: request.summary.permissionType,
    periodDurationSeconds: request.summary.periodDurationSeconds,
    expiresAt: request.summary.expiresAt,
    grantedAt: grantedAt ?? new Date().toISOString()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createRedactedHash(value: unknown): string {
  const serialized = JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)) ?? "";
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `tm_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
