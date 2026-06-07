import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createPublicClient, erc20Abi, formatEther, formatUnits, http, isAddress, parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  paySpecialistAgentWithX402,
  resolveAgentBuyerConfig,
  type X402AgentPaymentResult
} from "../lib/adapters/payment/x402-client";
import {
  DEFAULT_X402_AGENT_PRICE,
  DEFAULT_X402_BASE_SEPOLIA_NETWORK,
  x402AgentEnvKeys
} from "../lib/adapters/payment/x402-server";
import type { SpecialistAgentKind } from "../lib/agents/types";
import { specialistAgentSlug } from "../lib/runtime/paid-agent-flow";

const ENV_LOCAL_PATH = resolve(process.cwd(), ".env.local");
const DEFAULT_BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const DEFAULT_BASE_SEPOLIA_RPC = "https://sepolia.base.org";
const agentKinds: SpecialistAgentKind[] = ["contract_scanner", "wallet_behavior", "market_context"];

function stripQuotes(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function readEnvLocal(): Record<string, string | undefined> {
  if (!existsSync(ENV_LOCAL_PATH)) {
    return {};
  }

  return readFileSync(ENV_LOCAL_PATH, "utf8")
    .split(/\r?\n/)
    .reduce<Record<string, string | undefined>>((env, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return env;
      }

      const equalsIndex = trimmed.indexOf("=");

      if (equalsIndex <= 0) {
        return env;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      const value = stripQuotes(trimmed.slice(equalsIndex + 1));

      env[key] = value || undefined;
      return env;
    }, {});
}

function smokeEnv(): Record<string, string | undefined> {
  return {
    ...process.env,
    ...readEnvLocal()
  };
}

function normalizePrivateKey(value: string | undefined): `0x${string}` | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const trimmed = value.trim();
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;

  return /^0x[a-fA-F0-9]{64}$/.test(normalized) ? (normalized as `0x${string}`) : undefined;
}

function priceToUsdcUnits(value: string): bigint | undefined {
  const trimmed = value.trim();
  const normalized = trimmed.startsWith(".") ? `0${trimmed}` : trimmed;
  const priceBody = normalized.charCodeAt(0) === 36 ? normalized.slice(1) : normalized;

  if (!/^[0-9]+(?:\.[0-9]{1,6})?$/.test(priceBody)) {
    return undefined;
  }

  return parseUnits(priceBody, 6);
}

function safeUrlParts(value: string | undefined): { absolute: boolean; host?: string; path?: string } {
  try {
    const parsed = new URL(value ?? "");

    return {
      absolute: true,
      host: parsed.host,
      path: parsed.pathname
    };
  } catch {
    return {
      absolute: false
    };
  }
}

function safeHost(value: string | undefined): string | undefined {
  try {
    return new URL(value ?? "").host;
  } catch {
    return undefined;
  }
}

function routeUrlForAgent(env: Record<string, string | undefined>, agentKind: SpecialistAgentKind): string | undefined {
  const explicit = env[x402AgentEnvKeys(agentKind).urlKey]?.trim();

  if (explicit) {
    return explicit;
  }

  if (!env.X402_CONTRACT_SCANNER_URL?.trim()) {
    return undefined;
  }

  try {
    const parsed = new URL(env.X402_CONTRACT_SCANNER_URL);
    parsed.pathname = `/api/agents/${specialistAgentSlug(agentKind)}`;
    parsed.search = "";
    parsed.hash = "";

    return parsed.toString();
  } catch {
    return undefined;
  }
}

function priceForAgent(env: Record<string, string | undefined>, agentKind: SpecialistAgentKind): string {
  return (
    env[x402AgentEnvKeys(agentKind).priceKey]?.trim() ||
    env.X402_CONTRACT_SCANNER_PRICE_USD?.trim() ||
    DEFAULT_X402_AGENT_PRICE
  );
}

function liveAgentEnv(env: Record<string, string | undefined>, agentKind: SpecialistAgentKind) {
  const keys = x402AgentEnvKeys(agentKind);
  const routeUrl = routeUrlForAgent(env, agentKind);

  return {
    ...env,
    [keys.modeKey]: "real",
    [keys.urlKey]: routeUrl,
    [keys.priceKey]: priceForAgent(env, agentKind)
  };
}

async function routeIsRealX402Ready(url: string | undefined): Promise<boolean> {
  if (!url) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        targetAddress: "0x0000000000000000000000000000000000000402"
      })
    });
    clearTimeout(timer);
    const text = await response.text();

    return response.status === 402 && text.includes("real_x402_payment_required");
  } catch {
    return false;
  }
}

async function allRoutesReady(agentEnvs: Array<{ agentKind: SpecialistAgentKind; env: Record<string, string | undefined> }>): Promise<boolean> {
  const readiness = await Promise.all(
    agentEnvs.map(({ agentKind, env }) => routeIsRealX402Ready(routeUrlForAgent(env, agentKind)))
  );

  return readiness.every(Boolean);
}

async function payAgentWithOverallTimeout(
  agentKind: SpecialistAgentKind,
  env: Record<string, string | undefined>,
  timeoutMs: number
): Promise<X402AgentPaymentResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      paySpecialistAgentWithX402(
        agentKind,
        {
          targetAddress: "0x0000000000000000000000000000000000000402"
        },
        {
          env,
          requestTimeoutMs: timeoutMs
        }
      ),
      new Promise<X402AgentPaymentResult>((resolveTimeout) => {
        timer = setTimeout(() => {
          resolveTimeout({
            agentKind,
            state: "real_x402_failed",
            failureCategory: "request",
            errorClass: "TimeoutError",
            settlementPresent: false,
            transactionPresent: false
          });
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

describe("server-only x402 live smoke test", () => {
  it("runs only when X402_LIVE_SMOKE=true and prints sanitized x402 status", async () => {
    const env = smokeEnv();

    if (env.X402_LIVE_SMOKE !== "true") {
      console.info(
        "[x402-smoke]",
        JSON.stringify(
          {
            skipped: true,
            reason: "X402_LIVE_SMOKE is not true",
            envLocalFound: existsSync(ENV_LOCAL_PATH)
          },
          null,
          2
        )
      );
      expect(env.X402_LIVE_SMOKE).not.toBe("true");
      return;
    }

    const privateKey = normalizePrivateKey(env.X402_BUYER_PRIVATE_KEY);
    const buyerAddress = privateKey ? privateKeyToAccount(privateKey).address : undefined;
    const requiredKeys = ["X402_BUYER_PRIVATE_KEY", "X402_PAY_TO_ADDRESS", "X402_SETTLEMENT_NETWORK", "X402_FACILITATOR_URL"];
    const missing = requiredKeys.filter((key) => !env[key]?.trim());
    const invalid = [
      privateKey ? undefined : "X402_BUYER_PRIVATE_KEY",
      env.X402_PAY_TO_ADDRESS && isAddress(env.X402_PAY_TO_ADDRESS) ? undefined : "X402_PAY_TO_ADDRESS",
      env.X402_SETTLEMENT_NETWORK === DEFAULT_X402_BASE_SEPOLIA_NETWORK ? undefined : "X402_SETTLEMENT_NETWORK"
    ].filter((value): value is string => Boolean(value));
    const agentEnvs = agentKinds.map((agentKind) => ({
      agentKind,
      env: liveAgentEnv(env, agentKind)
    }));
    const buyerConfigs = agentEnvs.map(({ agentKind, env: agentEnv }) => ({
      agentKind,
      result: resolveAgentBuyerConfig(agentKind, agentEnv)
    }));
    const agentMissing = buyerConfigs.flatMap((config) => (config.result.ok ? [] : config.result.missing));
    const agentInvalid = buyerConfigs.flatMap((config) => (config.result.ok ? [] : config.result.invalid));
    const rpcUrl = env.BASE_RPC_URL?.trim() || env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || DEFAULT_BASE_SEPOLIA_RPC;
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl)
    });
    const usdcAddress = (env.USDC_CONTRACT_ADDRESS?.trim() || DEFAULT_BASE_SEPOLIA_USDC) as `0x${string}`;
    const agentPrices = agentEnvs.map(({ agentKind, env: agentEnv }) => ({
      agentKind,
      value: priceForAgent(agentEnv, agentKind),
      units: priceToUsdcUnits(priceForAgent(agentEnv, agentKind))
    }));
    const totalPriceUnits = agentPrices.reduce((total, price) => total + (price.units ?? BigInt(0)), BigInt(0));
    let ethBalance = BigInt(0);
    let usdcBalance = BigInt(0);

    if (buyerAddress) {
      ethBalance = await publicClient.getBalance({
        address: buyerAddress
      });
      usdcBalance = await publicClient.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [buyerAddress]
      });
    }

    const readiness = {
      buyerAddress,
      network: env.X402_SETTLEMENT_NETWORK,
      ethBalance: formatEther(ethBalance),
      usdcBalance: formatUnits(usdcBalance, 6),
      sellerAddressValid: Boolean(env.X402_PAY_TO_ADDRESS && isAddress(env.X402_PAY_TO_ADDRESS)),
      facilitatorHost: safeHost(env.X402_FACILITATOR_URL),
      usdcEnoughForTotalPrice: totalPriceUnits > BigInt(0) ? usdcBalance >= totalPriceUnits : false,
      agents: agentEnvs.map(({ agentKind, env: agentEnv }) => ({
        agentKind,
        url: safeUrlParts(routeUrlForAgent(agentEnv, agentKind)),
        priceConfigured: Boolean(priceForAgent(agentEnv, agentKind)),
        configValid: buyerConfigs.find((config) => config.agentKind === agentKind)?.result.ok ?? false
      })),
      missing: [...new Set([...missing, ...agentMissing])],
      invalid: [...new Set([...invalid, ...agentInvalid])]
    };

    const readinessMissing = readiness.missing;
    const readinessInvalid = readiness.invalid;
    const invalidPrices = agentPrices.filter((price) => !price.units).map((price) => `${price.agentKind}:price`);

    if (
      readinessMissing.length > 0 ||
      readinessInvalid.length > 0 ||
      invalidPrices.length > 0 ||
      !buyerAddress ||
      totalPriceUnits === BigInt(0) ||
      usdcBalance < totalPriceUnits
    ) {
      console.info(
        "[x402-smoke]",
        JSON.stringify(
          {
            readiness,
            invalidPrices,
            payment: {
              state: "not_run",
              sanitizedFailureCategory: "configuration"
            }
          },
          null,
          2
        )
      );
      expect(readinessMissing).toEqual([]);
      expect(readinessInvalid).toEqual([]);
      expect(invalidPrices).toEqual([]);
      expect(buyerAddress).toBeTruthy();
      expect(totalPriceUnits > BigInt(0)).toBe(true);
      expect(usdcBalance >= totalPriceUnits).toBe(true);
      return;
    }

    const routesReady = await allRoutesReady(agentEnvs);
    const payments = [];

    if (!routesReady) {
      console.info(
        "[x402-smoke]",
        JSON.stringify(
          {
            readiness,
            payment: {
              state: "not_run",
              sanitizedFailureCategory: "route_unavailable"
            }
          },
          null,
          2
        )
      );
      expect(routesReady).toBe(true);
      return;
    }

    for (const { agentKind, env: agentEnv } of agentEnvs) {
      const payment = await payAgentWithOverallTimeout(agentKind, agentEnv, 60_000);

      payments.push({
        agentKind,
        state: payment.state,
        responseStatus: payment.responseStatus,
        settlementPresent: payment.settlementPresent,
        transactionPresent: payment.transactionPresent,
        sanitizedFailureCategory: payment.failureCategory,
        errorClass: payment.errorClass,
        specialistKind: payment.specialistRun?.agentKind
      });
    }

    console.info(
      "[x402-smoke]",
      JSON.stringify(
        {
          readiness,
          payments
        },
        null,
        2
      )
    );

    expect(payments).toHaveLength(3);
    for (const payment of payments) {
      expect(payment.state).toBe("real_x402_paid");
      expect(payment.specialistKind).toBe(payment.agentKind);
    }
  }, 240_000);
});
