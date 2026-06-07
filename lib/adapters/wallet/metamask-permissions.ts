import { erc7715ProviderActions, type RequestExecutionPermissionsParameters } from "@metamask/smart-accounts-kit/actions";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  formatUnits,
  http,
  type Address
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_USDC_ADDRESS,
  type MissionPermissionReceipt,
  type MissionPermissionUiState,
  missionPolicyToPermissionRequest,
  normalizeEvmAddress,
  sanitizeMissionPermissionReceipt
} from "../../core/mission-permission";
import type { MissionBudgetPolicy } from "../../core/types";

export interface Eip1193RequestArguments {
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

export interface Eip1193Provider {
  request(args: Eip1193RequestArguments): Promise<unknown>;
  on?(event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void): void;
  removeListener?(event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export type BalanceReadinessState = "ready" | "empty" | "unknown";

export interface BalanceReadiness {
  state: BalanceReadinessState;
  amount?: string;
  symbol: "ETH" | "USDC";
}

export interface WalletReadiness {
  state: "wallet_connected" | "wrong_network";
  address?: `0x${string}`;
  chainId: number;
  targetChainId: typeof BASE_SEPOLIA_CHAIN_ID;
  eth: BalanceReadiness;
  usdc: BalanceReadiness;
  diagnostics: string[];
}

export type ConnectMetaMaskResult =
  | {
      ok: true;
      address: `0x${string}`;
      chainId: number;
    }
  | {
      ok: false;
      state: "wallet_not_connected" | "permission_rejected" | "permission_unavailable";
      message: string;
    };

export type SwitchBaseSepoliaResult =
  | {
      ok: true;
      chainId: typeof BASE_SEPOLIA_CHAIN_ID;
    }
  | {
      ok: false;
      state: "wrong_network" | "permission_rejected" | "permission_unavailable";
      reason: string;
      message: string;
    };

export type RequestMissionBudgetPermissionResult =
  | {
      state: "permission_granted";
      receipt: MissionPermissionReceipt;
      message: string;
    }
  | {
      state: Exclude<MissionPermissionUiState, "permission_granted" | "permission_requested" | "wallet_connected">;
      message: string;
      reason: string;
    };

export interface ReadWalletReadinessOptions {
  address: string;
  chainId: number;
  rpcUrl?: string;
  usdcAddress?: string;
}

export interface RequestMissionBudgetPermissionOptions {
  provider: Eip1193Provider | undefined;
  policy: MissionBudgetPolicy;
  delegateAddress: string;
  walletAddress?: string;
  tokenAddress?: string;
  periodDurationSeconds?: number;
  nowSeconds?: number;
}

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
  }
] as const;

const BASE_SEPOLIA_CHAIN_HEX = "0x14a34";
const BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org";
const BASE_SEPOLIA_EXPLORER_URL = "https://sepolia.basescan.org";

export async function connectMetaMask(provider: Eip1193Provider | undefined): Promise<ConnectMetaMaskResult> {
  if (!provider) {
    return {
      ok: false,
      state: "wallet_not_connected",
      message: "MetaMask was not detected in this browser."
    };
  }

  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const [firstAccount] = Array.isArray(accounts) ? accounts : [];
    const address = typeof firstAccount === "string" ? normalizeEvmAddress(firstAccount) : null;

    if (!address) {
      return {
        ok: false,
        state: "permission_unavailable",
        message: "MetaMask did not return a usable account address."
      };
    }

    return {
      ok: true,
      address,
      chainId: await readProviderChainId(provider)
    };
  } catch (error) {
    if (isUserRejectedError(error)) {
      return {
        ok: false,
        state: "permission_rejected",
        message: "Wallet connection was rejected."
      };
    }

    return {
      ok: false,
      state: "permission_unavailable",
      message: "Wallet connection failed safely."
    };
  }
}

export async function readWalletReadiness({
  address,
  chainId,
  rpcUrl,
  usdcAddress
}: ReadWalletReadinessOptions): Promise<WalletReadiness> {
  const normalizedAddress = normalizeEvmAddress(address);
  const tokenAddress = normalizeEvmAddress(usdcAddress ?? BASE_SEPOLIA_USDC_ADDRESS);
  const diagnostics: string[] = [];

  if (!normalizedAddress) {
    return {
      state: "wrong_network",
      chainId,
      targetChainId: BASE_SEPOLIA_CHAIN_ID,
      eth: { state: "unknown", symbol: "ETH" },
      usdc: { state: "unknown", symbol: "USDC" },
      diagnostics: ["Connected wallet address could not be normalized."]
    };
  }

  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    return {
      state: "wrong_network",
      address: normalizedAddress,
      chainId,
      targetChainId: BASE_SEPOLIA_CHAIN_ID,
      eth: { state: "unknown", symbol: "ETH" },
      usdc: { state: "unknown", symbol: "USDC" },
      diagnostics: [`Connected wallet is on chain ${chainId}; Base Sepolia ${BASE_SEPOLIA_CHAIN_ID} is required.`]
    };
  }

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl || "https://sepolia.base.org")
  });

  let eth: BalanceReadiness = { state: "unknown", symbol: "ETH" };
  let usdc: BalanceReadiness = { state: "unknown", symbol: "USDC" };

  try {
    const balance = await publicClient.getBalance({ address: normalizedAddress });
    eth = {
      state: balance > BigInt(0) ? "ready" : "empty",
      amount: formatEther(balance),
      symbol: "ETH"
    };
  } catch {
    diagnostics.push("Base Sepolia ETH balance read failed.");
  }

  if (tokenAddress) {
    try {
      const balance = await publicClient.readContract({
        address: tokenAddress as Address,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: [normalizedAddress]
      });

      usdc = {
        state: balance > BigInt(0) ? "ready" : "empty",
        amount: formatUnits(balance, 6),
        symbol: "USDC"
      };
    } catch {
      diagnostics.push("Base Sepolia USDC balance read failed.");
    }
  } else {
    diagnostics.push("Base Sepolia USDC token address is invalid.");
  }

  return {
    state: "wallet_connected",
    address: normalizedAddress,
    chainId,
    targetChainId: BASE_SEPOLIA_CHAIN_ID,
    eth,
    usdc,
    diagnostics
  };
}

export async function switchMetaMaskToBaseSepolia(
  provider: Eip1193Provider | undefined
): Promise<SwitchBaseSepoliaResult> {
  if (!provider) {
    return {
      ok: false,
      state: "permission_unavailable",
      reason: "provider_missing",
      message: "MetaMask was not detected in this browser."
    };
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_SEPOLIA_CHAIN_HEX }]
    });
  } catch (error) {
    if (isUserRejectedError(error)) {
      return {
        ok: false,
        state: "permission_rejected",
        reason: "user_rejected",
        message: "Base Sepolia switch was rejected in MetaMask."
      };
    }

    if (!isChainMissingError(error)) {
      return {
        ok: false,
        state: "wrong_network",
        reason: classifyPermissionError(error),
        message: "MetaMask did not switch to Base Sepolia."
      };
    }

    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BASE_SEPOLIA_CHAIN_HEX,
            chainName: "Base Sepolia",
            nativeCurrency: {
              name: "Ether",
              symbol: "ETH",
              decimals: 18
            },
            rpcUrls: [BASE_SEPOLIA_RPC_URL],
            blockExplorerUrls: [BASE_SEPOLIA_EXPLORER_URL]
          }
        ]
      });
    } catch (addError) {
      return {
        ok: false,
        state: isUserRejectedError(addError) ? "permission_rejected" : "wrong_network",
        reason: isUserRejectedError(addError) ? "user_rejected" : classifyPermissionError(addError),
        message: isUserRejectedError(addError)
          ? "Base Sepolia add/switch was rejected in MetaMask."
          : "MetaMask could not add or switch to Base Sepolia."
      };
    }
  }

  const chainId = await readProviderChainId(provider);

  if (chainId !== BASE_SEPOLIA_CHAIN_ID) {
    return {
      ok: false,
      state: "wrong_network",
      reason: "provider_chain_mismatch",
      message: `MetaMask still reports chain ${chainId}; Base Sepolia ${BASE_SEPOLIA_CHAIN_ID} is required.`
    };
  }

  return {
    ok: true,
    chainId: BASE_SEPOLIA_CHAIN_ID
  };
}

export async function requestMissionBudgetPermission({
  provider,
  policy,
  delegateAddress,
  walletAddress,
  tokenAddress,
  periodDurationSeconds,
  nowSeconds
}: RequestMissionBudgetPermissionOptions): Promise<RequestMissionBudgetPermissionResult> {
  if (!provider) {
    return {
      state: "wallet_not_connected",
      reason: "provider_missing",
      message: "MetaMask was not detected in this browser."
    };
  }

  const currentChainId = await readProviderChainId(provider);

  if (currentChainId !== BASE_SEPOLIA_CHAIN_ID) {
    return {
      state: "wrong_network",
      reason: "provider_chain_mismatch",
      message: `MetaMask reports chain ${currentChainId}; switch to Base Sepolia before requesting permission.`
    };
  }

  const mapped = missionPolicyToPermissionRequest(policy, {
    delegateAddress,
    tokenAddress,
    walletAddress,
    periodDurationSeconds,
    nowSeconds
  });

  if (!mapped.ok) {
    return {
      state: mapped.reason === "invalid_chain" ? "wrong_network" : "permission_unavailable",
      reason: mapped.reason,
      message: mapped.message
    };
  }

  try {
    const walletClient = createWalletClient({
      transport: custom(provider)
    }).extend(erc7715ProviderActions());

    const permissionParameters: RequestExecutionPermissionsParameters = [mapped.value.requestShape];
    const grantedPermissions = await walletClient.requestExecutionPermissions(permissionParameters);
    const [firstReceipt] = Array.isArray(grantedPermissions) ? grantedPermissions : [];

    return {
      state: "permission_granted",
      receipt: sanitizeMissionPermissionReceipt({
        rawReceipt: firstReceipt ?? grantedPermissions,
        request: mapped.value,
        walletAddress
      }),
      message: "Scoped mission-budget permission receipt granted."
    };
  } catch (error) {
    if (isUserRejectedError(error)) {
      return {
        state: "permission_rejected",
        reason: "user_rejected",
        message: "Permission request was rejected in MetaMask."
      };
    }

    return {
      state: "permission_unavailable",
      reason: classifyPermissionError(error),
      message: "MetaMask Advanced Permissions did not return a usable mission permission receipt."
    };
  }
}

async function readProviderChainId(provider: Eip1193Provider): Promise<number> {
  const chainId = await provider.request({ method: "eth_chainId" });

  if (typeof chainId === "string") {
    return Number.parseInt(chainId, chainId.startsWith("0x") ? 16 : 10);
  }

  if (typeof chainId === "number") {
    return chainId;
  }

  return Number.NaN;
}

function isUserRejectedError(error: unknown): boolean {
  return isRecord(error) && (error.code === 4001 || error.code === "4001");
}

function isChainMissingError(error: unknown): boolean {
  return isRecord(error) && (error.code === 4902 || error.code === "4902");
}

function classifyPermissionError(error: unknown): string {
  if (!isRecord(error)) {
    return "unknown";
  }

  const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

  if (message.includes("wallet_requestexecutionpermissions") || message.includes("unsupported")) {
    return "unsupported_method";
  }

  if (message.includes("chain") || message.includes("network")) {
    return "wrong_network";
  }

  return "provider_request_failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
