import { HTTPFacilitatorClient, x402ResourceServer, type RouteConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { SpecialistAgentKind } from "../../agents/types";
import type { AgentTask } from "../../core/types";

export interface X402ProtectedResource {
  task: AgentTask;
  price: string;
  resourceUrl: string;
  resourceId: string;
  agentKind: SpecialistAgentKind;
  description: string;
  mimeType: "application/json";
}

export const X402_PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";
export const X402_PAYMENT_SIGNATURE_HEADER = "PAYMENT-SIGNATURE";
export const X402_PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";
export const X402_LEGACY_PAYMENT_HEADER = "X-PAYMENT";

const DEFAULT_DEV_PROOF = "taskmarket402-dev-payment-proof";
const DEFAULT_SIMULATED_USDC_ASSET = "0x0000000000000000000000000000000000000402";
const DEFAULT_SIMULATED_PAY_TO = "0x000000000000000000000000000000000000dEaD";
export const DEFAULT_X402_FACILITATOR_URL = "https://x402.org/facilitator";
export const DEFAULT_X402_BASE_SEPOLIA_NETWORK = "eip155:84532";
export const DEFAULT_X402_CONTRACT_SCANNER_PRICE = "$0.001";

export type X402DevPaymentFailureReason =
  | "missing_payment_proof"
  | "invalid_payment_proof"
  | "wrong_resource"
  | "dev_mode_disabled";

export interface X402PaymentRequirement {
  scheme: "exact";
  price: string;
  network: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: {
    name: "USDC";
    version: "2";
    resourceId: string;
    phase: "phase-4-dev";
    simulatedSettlement: "true";
  };
}

export interface X402PaymentRequiredPayload {
  x402Version: 2;
  error: string;
  resource: {
    id: string;
    url: string;
    description: string;
    mimeType: "application/json";
  };
  accepts: X402PaymentRequirement[];
  phase: "phase-4-dev";
  simulatedSettlement: true;
}

export interface X402DevPaymentPayload {
  x402Version: 2;
  mode: "dev";
  resourceId: string;
  proof: string;
  phase: "phase-4-dev";
  simulatedSettlement: true;
}

export interface X402DevPaymentAccepted {
  ok: true;
  state: "dev_payment_accepted";
  paymentId: string;
}

export interface X402DevPaymentRejected {
  ok: false;
  state: "payment_required";
  reason: X402DevPaymentFailureReason;
}

export type X402DevPaymentVerification = X402DevPaymentAccepted | X402DevPaymentRejected;

export type X402ContractScannerMode = "simulated" | "real";

export interface X402ContractScannerSellerConfig {
  facilitatorUrl: string;
  network: Network;
  payTo: `0x${string}`;
  price: string;
}

export type X402ContractScannerSellerConfigResult =
  | {
      ok: true;
      mode: "real";
      config: X402ContractScannerSellerConfig;
    }
  | {
      ok: false;
      mode: X402ContractScannerMode;
      missing: string[];
      invalid: string[];
    };

export interface X402PaymentResponsePayload {
  x402Version: 2;
  state: "dev_payment_accepted";
  paymentId: string;
  resourceId: string;
  network: string;
  transaction: null;
  phase: "phase-4-dev";
  simulatedSettlement: true;
}

export function contractScannerX402Mode(env: Record<string, string | undefined> = process.env): X402ContractScannerMode {
  return env.X402_CONTRACT_SCANNER_MODE === "real" ? "real" : "simulated";
}

function hasValue(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function isEvmAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
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

function priceIsValid(value: string): boolean {
  const trimmed = normalizePrice(value);
  const priceBody = trimmed.charCodeAt(0) === 36 ? trimmed.slice(1) : trimmed;

  return /^[0-9]+(?:\.[0-9]{1,6})?$/.test(priceBody);
}

export function resolveContractScannerSellerConfig(
  env: Record<string, string | undefined> = process.env
): X402ContractScannerSellerConfigResult {
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
  const facilitatorUrl = env.X402_FACILITATOR_URL?.trim() || DEFAULT_X402_FACILITATOR_URL;
  const network = env.X402_SETTLEMENT_NETWORK?.trim();
  const payTo = env.X402_PAY_TO_ADDRESS?.trim();
  const price = normalizePrice(env.X402_CONTRACT_SCANNER_PRICE_USD || DEFAULT_X402_CONTRACT_SCANNER_PRICE);

  if (!hasValue(network)) {
    missing.push("X402_SETTLEMENT_NETWORK");
  } else if (network !== DEFAULT_X402_BASE_SEPOLIA_NETWORK) {
    invalid.push("X402_SETTLEMENT_NETWORK");
  }

  if (!hasValue(payTo)) {
    missing.push("X402_PAY_TO_ADDRESS");
  } else if (!isEvmAddress(payTo)) {
    invalid.push("X402_PAY_TO_ADDRESS");
  }

  try {
    new URL(facilitatorUrl);
  } catch {
    invalid.push("X402_FACILITATOR_URL");
  }

  if (!priceIsValid(price)) {
    invalid.push("X402_CONTRACT_SCANNER_PRICE_USD");
  }

  if (missing.length > 0 || invalid.length > 0 || !network || !payTo || !isEvmAddress(payTo)) {
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
      facilitatorUrl,
      network: network as Network,
      payTo,
      price
    }
  };
}

export function createContractScannerRouteConfig(config: X402ContractScannerSellerConfig): RouteConfig {
  return {
    accepts: {
      scheme: "exact",
      price: config.price,
      network: config.network,
      payTo: config.payTo
    },
    description: "Contract Scanner Agent output for TaskMarket402 Wallet / Token Risk Report",
    mimeType: "application/json",
    serviceName: "TaskMarket402 Contract Scanner",
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        source: "paid_agent_endpoint",
        phase: "phase-5-real-x402",
        payment: {
          state: "real_x402_payment_required",
          network: config.network,
          settlement: "required"
        }
      }
    }),
    settlementFailedResponseBody: () => ({
      contentType: "application/json",
      body: {
        source: "paid_agent_endpoint",
        phase: "phase-5-real-x402",
        payment: {
          state: "real_x402_failed",
          network: config.network,
          settlement: "failed"
        }
      }
    })
  };
}

export function createContractScannerX402ResourceServer(
  config: X402ContractScannerSellerConfig
): x402ResourceServer {
  return new x402ResourceServer(
    new HTTPFacilitatorClient({
      url: config.facilitatorUrl
    })
  ).register(config.network, new ExactEvmScheme());
}

export function createX402ProtectedResource(input: {
  task: AgentTask;
  agentKind: SpecialistAgentKind;
  resourceUrl: string;
  description?: string;
  price?: string;
}): X402ProtectedResource {
  return {
    task: input.task,
    agentKind: input.agentKind,
    price: input.price ?? input.task.budget.amount,
    resourceUrl: input.resourceUrl,
    resourceId: `${input.task.missionId}:${input.agentKind}:${input.task.id}`,
    description: input.description ?? `${input.agentKind.replaceAll("_", " ")} specialist output`,
    mimeType: "application/json"
  };
}

export function encodeBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function decodeBase64Json(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

function networkForResource(resource: X402ProtectedResource, env: Record<string, string | undefined>): string {
  return env.X402_SETTLEMENT_NETWORK?.trim() || `eip155:${resource.task.budget.chainId}`;
}

function expectedDevProof(env: Record<string, string | undefined>): string {
  return env.X402_DEV_PAYMENT_PROOF?.trim() || DEFAULT_DEV_PROOF;
}

function paymentRequiredError(reason: X402DevPaymentFailureReason | undefined): string {
  if (reason === "invalid_payment_proof") {
    return "Development payment proof is invalid";
  }

  if (reason === "wrong_resource") {
    return "Development payment proof targets a different resource";
  }

  if (reason === "dev_mode_disabled") {
    return "Development payment mode is disabled";
  }

  return "PAYMENT-SIGNATURE header is required";
}

export function createPaymentRequiredPayload(
  resource: X402ProtectedResource,
  options: {
    env?: Record<string, string | undefined>;
    reason?: X402DevPaymentFailureReason;
  } = {}
): X402PaymentRequiredPayload {
  const env = options.env ?? process.env;

  return {
    x402Version: 2,
    error: paymentRequiredError(options.reason),
    resource: {
      id: resource.resourceId,
      url: resource.resourceUrl,
      description: resource.description,
      mimeType: resource.mimeType
    },
    accepts: [
      {
        scheme: "exact",
        price: `$${resource.price}`,
        network: networkForResource(resource, env),
        asset: env.USDC_CONTRACT_ADDRESS?.trim() || DEFAULT_SIMULATED_USDC_ASSET,
        payTo: env.X402_PAY_TO_ADDRESS?.trim() || DEFAULT_SIMULATED_PAY_TO,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USDC",
          version: "2",
          resourceId: resource.resourceId,
          phase: "phase-4-dev",
          simulatedSettlement: "true"
        }
      }
    ],
    phase: "phase-4-dev",
    simulatedSettlement: true
  };
}

export function createX402PaymentRequired(
  resource: X402ProtectedResource,
  options: {
    env?: Record<string, string | undefined>;
    reason?: X402DevPaymentFailureReason;
  } = {}
): Response {
  const payload = createPaymentRequiredPayload(resource, options);

  return new Response(
    JSON.stringify({
      error: "Payment Required",
      message: "x402-style development payment proof required.",
      state: "payment_required",
      reason: options.reason ?? "missing_payment_proof",
      phase: "phase-4-dev",
      simulatedSettlement: true,
      resource: payload.resource,
      accepts: payload.accepts
    }),
    {
      status: 402,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        [X402_PAYMENT_REQUIRED_HEADER]: encodeBase64Json(payload)
      }
    }
  );
}

export function readPaymentSignature(headers: Headers): string | undefined {
  return headers.get(X402_PAYMENT_SIGNATURE_HEADER) ?? headers.get(X402_LEGACY_PAYMENT_HEADER) ?? undefined;
}

export function createDevPaymentSignature(
  resource: X402ProtectedResource,
  env: Record<string, string | undefined> = process.env
): string {
  const payload: X402DevPaymentPayload = {
    x402Version: 2,
    mode: "dev",
    resourceId: resource.resourceId,
    proof: expectedDevProof(env),
    phase: "phase-4-dev",
    simulatedSettlement: true
  };

  return encodeBase64Json(payload);
}

function decodedDevPaymentPayload(signature: string): X402DevPaymentPayload | undefined {
  try {
    const decoded = decodeBase64Json(signature);

    if (
      typeof decoded === "object" &&
      decoded !== null &&
      "x402Version" in decoded &&
      "mode" in decoded &&
      "resourceId" in decoded &&
      "proof" in decoded
    ) {
      return decoded as X402DevPaymentPayload;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function verifyDevPaymentProof(
  headers: Headers,
  resource: X402ProtectedResource,
  env: Record<string, string | undefined> = process.env
): X402DevPaymentVerification {
  if (env.X402_DEV_MODE === "false") {
    return {
      ok: false,
      state: "payment_required",
      reason: "dev_mode_disabled"
    };
  }

  const signature = readPaymentSignature(headers);

  if (!signature) {
    return {
      ok: false,
      state: "payment_required",
      reason: "missing_payment_proof"
    };
  }

  const payload = decodedDevPaymentPayload(signature);

  if (!payload || payload.mode !== "dev" || payload.proof !== expectedDevProof(env)) {
    return {
      ok: false,
      state: "payment_required",
      reason: "invalid_payment_proof"
    };
  }

  if (payload.resourceId !== resource.resourceId) {
    return {
      ok: false,
      state: "payment_required",
      reason: "wrong_resource"
    };
  }

  return {
    ok: true,
    state: "dev_payment_accepted",
    paymentId: `dev_${resource.resourceId.replace(/[^a-zA-Z0-9]/g, "_")}`
  };
}

export function createPaymentResponsePayload(
  resource: X402ProtectedResource,
  verification: X402DevPaymentAccepted,
  env: Record<string, string | undefined> = process.env
): X402PaymentResponsePayload {
  return {
    x402Version: 2,
    state: "dev_payment_accepted",
    paymentId: verification.paymentId,
    resourceId: resource.resourceId,
    network: networkForResource(resource, env),
    transaction: null,
    phase: "phase-4-dev",
    simulatedSettlement: true
  };
}

export function createPaymentResponseHeader(
  resource: X402ProtectedResource,
  verification: X402DevPaymentAccepted,
  env: Record<string, string | undefined> = process.env
): string {
  return encodeBase64Json(createPaymentResponsePayload(resource, verification, env));
}
