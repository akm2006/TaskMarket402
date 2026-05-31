import {
  createPublicClient,
  formatEther,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex
} from "viem";
import { base, baseSepolia } from "viem/chains";

export type BaseDataFallbackReason = "invalid_address" | "unsupported_chain" | "rpc_error";

export interface BaseRpcReadClient {
  getCode(parameters: { address: Address }): Promise<Hex | undefined>;
  getBalance(parameters: { address: Address }): Promise<bigint>;
  getTransactionCount(parameters: { address: Address }): Promise<number>;
}

export interface BaseAddressSnapshot {
  status: "ok";
  address: Address;
  chainId: number;
  chainName: string;
  rpcUrlSource: "env" | "public";
  isContract: boolean;
  codeSizeBytes: number;
  nativeBalanceEth: string;
  transactionCount: number;
}

export interface BaseAddressFallback {
  status: "fallback";
  reason: BaseDataFallbackReason;
  message: string;
  address?: string;
  chainId?: number;
}

export type BaseAddressResult = BaseAddressSnapshot | BaseAddressFallback;

export interface BaseRpcOptions {
  env?: Record<string, string | undefined>;
  client?: BaseRpcReadClient;
}

interface ResolvedBaseChain {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  rpcUrlSource: "env" | "public";
  chain: typeof base | typeof baseSepolia;
}

const DEFAULT_BASE_SEPOLIA_RPC_URL = "https://sepolia.base.org";
const DEFAULT_BASE_MAINNET_RPC_URL = "https://mainnet.base.org";

function parseChainId(value: string | undefined): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : 84532;
}

function resolveBaseChain(env: Record<string, string | undefined>): ResolvedBaseChain | undefined {
  const chainId = parseChainId(env.BASE_CHAIN_ID ?? env.NEXT_PUBLIC_CHAIN_ID);

  if (chainId === 8453) {
    const rpcUrl = env.BASE_RPC_URL ?? env.NEXT_PUBLIC_BASE_RPC_URL ?? DEFAULT_BASE_MAINNET_RPC_URL;

    return {
      chainId,
      chainName: "Base Mainnet",
      rpcUrl,
      rpcUrlSource: env.BASE_RPC_URL ?? env.NEXT_PUBLIC_BASE_RPC_URL ? "env" : "public",
      chain: base
    };
  }

  if (chainId === 84532) {
    const rpcUrl = env.BASE_RPC_URL ?? env.NEXT_PUBLIC_BASE_RPC_URL ?? DEFAULT_BASE_SEPOLIA_RPC_URL;

    return {
      chainId,
      chainName: "Base Sepolia",
      rpcUrl,
      rpcUrlSource: env.BASE_RPC_URL ?? env.NEXT_PUBLIC_BASE_RPC_URL ? "env" : "public",
      chain: baseSepolia
    };
  }

  return undefined;
}

function codeSize(code: Hex | undefined): number {
  if (!code || code === "0x") {
    return 0;
  }

  return Math.max(0, Math.floor((code.length - 2) / 2));
}

export function normalizeEvmAddress(value: string): Address | undefined {
  if (!isAddress(value)) {
    return undefined;
  }

  return getAddress(value);
}

export async function readBaseAddressSnapshot(
  targetAddress: string,
  options: BaseRpcOptions = {}
): Promise<BaseAddressResult> {
  const address = normalizeEvmAddress(targetAddress);

  if (!address) {
    return {
      status: "fallback",
      reason: "invalid_address",
      message: "Target is not a valid EVM address.",
      address: targetAddress
    };
  }

  const env = options.env ?? process.env;
  const resolvedChain = resolveBaseChain(env);

  if (!resolvedChain) {
    return {
      status: "fallback",
      reason: "unsupported_chain",
      message: "Only Base Mainnet and Base Sepolia are supported for Phase 3 read-only agents.",
      address,
      chainId: parseChainId(env.BASE_CHAIN_ID ?? env.NEXT_PUBLIC_CHAIN_ID)
    };
  }

  try {
    const client =
      options.client ??
      (createPublicClient({
        chain: resolvedChain.chain,
        transport: http(resolvedChain.rpcUrl)
      }) as BaseRpcReadClient);
    const [code, balance, transactionCount] = await Promise.all([
      client.getCode({ address }),
      client.getBalance({ address }),
      client.getTransactionCount({ address })
    ]);
    const codeSizeBytes = codeSize(code);

    return {
      status: "ok",
      address,
      chainId: resolvedChain.chainId,
      chainName: resolvedChain.chainName,
      rpcUrlSource: resolvedChain.rpcUrlSource,
      isContract: codeSizeBytes > 0,
      codeSizeBytes,
      nativeBalanceEth: formatEther(balance),
      transactionCount
    };
  } catch {
    return {
      status: "fallback",
      reason: "rpc_error",
      message: "Base RPC read failed or was rate-limited.",
      address,
      chainId: resolvedChain.chainId
    };
  }
}
