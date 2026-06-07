import { describe, expect, it } from "vitest";
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_USDC_ADDRESS,
  missionPolicyToPermissionRequest,
  sanitizeMissionPermissionReceipt
} from "../lib/core/mission-permission";
import { requestMissionBudgetPermission, switchMetaMaskToBaseSepolia } from "../lib/adapters/wallet/metamask-permissions";
import type { MissionBudgetPolicy } from "../lib/core/types";

const delegateAddress = "0x1111111111111111111111111111111111111111";
const walletAddress = "0x2222222222222222222222222222222222222222";

function policy(overrides: Partial<MissionBudgetPolicy> = {}): MissionBudgetPolicy {
  return {
    missionId: "risk-report-demo",
    totalBudget: {
      amount: "3.00",
      currency: "USDC",
      chainId: BASE_SEPOLIA_CHAIN_ID
    },
    maxPerAgent: {
      amount: "0.50",
      currency: "USDC",
      chainId: BASE_SEPOLIA_CHAIN_ID
    },
    expiresAt: "2026-06-03T00:00:00.000Z",
    allowedPaymentProtocol: "x402",
    ...overrides
  };
}

describe("MetaMask mission permission mapping", () => {
  it("maps a safe mission policy to an ERC-20 periodic permission request", () => {
    const result = missionPolicyToPermissionRequest(policy(), {
      delegateAddress,
      walletAddress,
      tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
      periodDurationSeconds: 3600,
      nowSeconds: 1_750_000_000
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.value.requestShape).toMatchObject({
      chainId: BASE_SEPOLIA_CHAIN_ID,
      to: delegateAddress,
      permission: {
        type: "erc20-token-periodic",
        isAdjustmentAllowed: false,
        data: {
          tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
          periodDuration: 3600
        }
      }
    });
    expect(result.value.requestShape.permission.data.periodAmount.toString()).toBe("3000000");
    expect(result.value.summary.periodAmountBaseUnits).toBe("3000000");
  });

  it("rejects a wrong-chain policy before requesting wallet permission", () => {
    const result = missionPolicyToPermissionRequest(
      policy({
        totalBudget: {
          amount: "3.00",
          currency: "USDC",
          chainId: 1
        }
      }),
      {
        delegateAddress,
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        nowSeconds: 1_750_000_000
      }
    );

    expect(result).toMatchObject({
      ok: false,
      reason: "invalid_chain"
    });
  });

  it("rejects unsafe budget policies before requesting wallet permission", () => {
    const invalidBudget = missionPolicyToPermissionRequest(
      policy({
        totalBudget: {
          amount: "0",
          currency: "USDC",
          chainId: BASE_SEPOLIA_CHAIN_ID
        }
      }),
      {
        delegateAddress,
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        nowSeconds: 1_750_000_000
      }
    );

    const overBudgetAgent = missionPolicyToPermissionRequest(
      policy({
        maxPerAgent: {
          amount: "5.00",
          currency: "USDC",
          chainId: BASE_SEPOLIA_CHAIN_ID
        }
      }),
      {
        delegateAddress,
        tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
        nowSeconds: 1_750_000_000
      }
    );

    expect(invalidBudget).toMatchObject({
      ok: false,
      reason: "invalid_budget"
    });
    expect(overBudgetAgent).toMatchObject({
      ok: false,
      reason: "max_per_agent_exceeds_total"
    });
  });

  it("sanitizes permission receipt metadata without exposing raw context", () => {
    const mapped = missionPolicyToPermissionRequest(policy(), {
      delegateAddress,
      walletAddress,
      tokenAddress: BASE_SEPOLIA_USDC_ADDRESS,
      nowSeconds: 1_750_000_000
    });

    expect(mapped.ok).toBe(true);

    if (!mapped.ok) {
      return;
    }

    const receipt = sanitizeMissionPermissionReceipt({
      request: mapped.value,
      walletAddress,
      grantedAt: "2026-06-02T12:00:00.000Z",
      rawReceipt: {
        context: "0xdeadbeef",
        delegationManager: "0x3333333333333333333333333333333333333333",
        dependencies: [{ factoryData: "0xabcdef" }]
      }
    });

    const serialized = JSON.stringify(receipt);

    expect(receipt).toMatchObject({
      state: "permission_granted",
      dependencyCount: 1,
      walletAddress,
      delegateAddress
    });
    expect(receipt.receiptId).toMatch(/^tm_/);
    expect(receipt.contextHash).toMatch(/^tm_/);
    expect(serialized).not.toContain("0xdeadbeef");
    expect(serialized).not.toContain("0xabcdef");
  });

  it("rejects permission requests when MetaMask still reports the wrong chain", async () => {
    const result = await requestMissionBudgetPermission({
      provider: {
        async request({ method }) {
          if (method === "eth_chainId") {
            return "0x1";
          }

          throw new Error("wallet permission request should not be called on the wrong chain");
        }
      },
      policy: policy(),
      delegateAddress,
      walletAddress,
      tokenAddress: BASE_SEPOLIA_USDC_ADDRESS
    });

    expect(result).toMatchObject({
      state: "wrong_network",
      reason: "provider_chain_mismatch"
    });
  });

  it("switches MetaMask to Base Sepolia through the wallet switch method", async () => {
    const methods: string[] = [];
    const result = await switchMetaMaskToBaseSepolia({
      async request({ method }) {
        methods.push(method);

        if (method === "eth_chainId") {
          return "0x14a34";
        }

        return null;
      }
    });

    expect(result).toEqual({
      ok: true,
      chainId: BASE_SEPOLIA_CHAIN_ID
    });
    expect(methods).toContain("wallet_switchEthereumChain");
  });
});
