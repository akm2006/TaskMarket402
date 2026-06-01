import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createPublicClient, erc20Abi, formatEther, formatUnits, http, isAddress, parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { payContractScannerWithX402, resolveContractScannerBuyerConfig } from "../lib/adapters/payment/x402-client";
import {
  DEFAULT_X402_BASE_SEPOLIA_NETWORK,
  DEFAULT_X402_CONTRACT_SCANNER_PRICE
} from "../lib/adapters/payment/x402-server";

const ENV_LOCAL_PATH = resolve(process.cwd(), ".env.local");
const DEFAULT_BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const DEFAULT_BASE_SEPOLIA_RPC = "https://sepolia.base.org";

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
    const requiredKeys = [
      "X402_BUYER_PRIVATE_KEY",
      "X402_PAY_TO_ADDRESS",
      "X402_SETTLEMENT_NETWORK",
      "X402_FACILITATOR_URL",
      "X402_CONTRACT_SCANNER_URL",
      "X402_CONTRACT_SCANNER_PRICE_USD"
    ];
    const missing = requiredKeys.filter((key) => !env[key]?.trim());
    const invalid = [
      privateKey ? undefined : "X402_BUYER_PRIVATE_KEY",
      env.X402_PAY_TO_ADDRESS && isAddress(env.X402_PAY_TO_ADDRESS) ? undefined : "X402_PAY_TO_ADDRESS",
      env.X402_SETTLEMENT_NETWORK === DEFAULT_X402_BASE_SEPOLIA_NETWORK ? undefined : "X402_SETTLEMENT_NETWORK",
      safeUrlParts(env.X402_CONTRACT_SCANNER_URL).absolute ? undefined : "X402_CONTRACT_SCANNER_URL",
      priceToUsdcUnits(env.X402_CONTRACT_SCANNER_PRICE_USD ?? DEFAULT_X402_CONTRACT_SCANNER_PRICE)
        ? undefined
        : "X402_CONTRACT_SCANNER_PRICE_USD"
    ].filter((value): value is string => Boolean(value));
    const buyerConfig = resolveContractScannerBuyerConfig({
      ...env,
      X402_CONTRACT_SCANNER_MODE: "real"
    });
    const rpcUrl = env.BASE_RPC_URL?.trim() || env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || DEFAULT_BASE_SEPOLIA_RPC;
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl)
    });
    const usdcAddress = (env.USDC_CONTRACT_ADDRESS?.trim() || DEFAULT_BASE_SEPOLIA_USDC) as `0x${string}`;
    const priceUnits = priceToUsdcUnits(env.X402_CONTRACT_SCANNER_PRICE_USD ?? DEFAULT_X402_CONTRACT_SCANNER_PRICE);
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
      scannerUrl: safeUrlParts(env.X402_CONTRACT_SCANNER_URL),
      usdcEnoughForPrice: priceUnits === undefined ? false : usdcBalance >= priceUnits,
      configValid: buyerConfig.ok,
      missing,
      invalid
    };

    if (missing.length > 0 || invalid.length > 0 || !buyerAddress || !priceUnits || usdcBalance < priceUnits) {
      console.info(
        "[x402-smoke]",
        JSON.stringify(
          {
            readiness,
            payment: {
              state: "not_run",
              sanitizedFailureCategory: "configuration"
            }
          },
          null,
          2
        )
      );
      expect(missing).toEqual([]);
      expect(invalid).toEqual([]);
      expect(buyerAddress).toBeTruthy();
      expect(priceUnits).toBeTruthy();
      expect(usdcBalance >= (priceUnits ?? BigInt(0))).toBe(true);
      return;
    }

    const payment = await payContractScannerWithX402(
      {
        targetAddress: "0x0000000000000000000000000000000000000402"
      },
      {
        env: {
          ...env,
          X402_CONTRACT_SCANNER_MODE: "real"
        }
      }
    );

    console.info(
      "[x402-smoke]",
      JSON.stringify(
        {
          readiness,
          payment: {
            state: payment.state,
            responseStatus: payment.responseStatus,
            settlementPresent: payment.settlementPresent,
            transactionPresent: payment.transactionPresent,
            sanitizedFailureCategory: payment.failureCategory,
            errorClass: payment.errorClass
          }
        },
        null,
        2
      )
    );

    expect(payment.state).toBe("real_x402_paid");
    expect(payment.specialistRun?.agentKind).toBe("contract_scanner");
  }, 120_000);
});
