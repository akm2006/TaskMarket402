"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, ShieldCheck, Wallet } from "lucide-react";
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_USDC_ADDRESS,
  DEFAULT_PERMISSION_PERIOD_SECONDS,
  type MissionPermissionReceipt,
  type MissionPermissionUiState
} from "@/lib/core/mission-permission";
import type { MissionBudgetPolicy } from "@/lib/core/types";
import {
  connectMetaMask,
  readWalletReadiness,
  requestMissionBudgetPermission,
  switchMetaMaskToBaseSepolia,
  type WalletReadiness
} from "@/lib/adapters/wallet/metamask-permissions";

type MetaMaskPermissionPanelProps = {
  policy: MissionBudgetPolicy;
};

type AsyncAction = "connect" | "network" | "permission" | null;

const permissionStates: MissionPermissionUiState[] = [
  "wallet_not_connected",
  "wallet_connected",
  "wrong_network",
  "permission_requested",
  "permission_granted",
  "permission_rejected",
  "permission_unavailable"
];

const stateLabels: Record<MissionPermissionUiState, string> = {
  wallet_not_connected: "Wallet not connected",
  wallet_connected: "Wallet connected",
  wrong_network: "Wrong network",
  permission_requested: "Permission requested",
  permission_granted: "Permission granted",
  permission_rejected: "Permission rejected",
  permission_unavailable: "Permission unavailable"
};

const stateStyles: Record<MissionPermissionUiState, string> = {
  wallet_not_connected: "border-zinc-700 bg-zinc-950 text-zinc-300",
  wallet_connected: "border-cyan-300/50 bg-cyan-950/50 text-cyan-100",
  wrong_network: "border-amber-300/60 bg-amber-950/50 text-amber-100",
  permission_requested: "border-sky-300/60 bg-sky-950/50 text-sky-100",
  permission_granted: "border-emerald-300/60 bg-emerald-950/60 text-emerald-100",
  permission_rejected: "border-red-300/60 bg-red-950/50 text-red-100",
  permission_unavailable: "border-orange-300/60 bg-orange-950/50 text-orange-100"
};

function shortAddress(address: string | undefined) {
  if (!address) {
    return "Not connected";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function balanceLine(readiness: WalletReadiness | null, key: "eth" | "usdc") {
  const balance = readiness?.[key];

  if (!balance) {
    return "Unknown until wallet connects";
  }

  if (balance.state === "unknown") {
    return `${balance.symbol}: read unavailable`;
  }

  return `${balance.symbol}: ${balance.amount ?? "0"} (${balance.state})`;
}

function activeStateClass(state: MissionPermissionUiState, activeState: MissionPermissionUiState) {
  return state === activeState ? `${stateStyles[state]} ring-1 ring-cyan-200/70` : stateStyles[state];
}

export function MetaMaskPermissionPanel({ policy }: MetaMaskPermissionPanelProps) {
  const [activeState, setActiveState] = useState<MissionPermissionUiState>("wallet_not_connected");
  const [wallet, setWallet] = useState<WalletReadiness | null>(null);
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | undefined>();
  const [delegateAddress, setDelegateAddress] = useState(
    process.env.NEXT_PUBLIC_METAMASK_SESSION_ACCOUNT_ADDRESS ?? ""
  );
  const [receipt, setReceipt] = useState<MissionPermissionReceipt | null>(null);
  const [message, setMessage] = useState("Connect MetaMask to begin the Phase 7 permission proof.");
  const [action, setAction] = useState<AsyncAction>(null);

  const tokenAddress = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || BASE_SEPOLIA_USDC_ADDRESS;
  const configuredPeriodDurationSeconds = Number.parseInt(
    process.env.NEXT_PUBLIC_MISSION_PERMISSION_PERIOD_SECONDS ?? String(DEFAULT_PERMISSION_PERIOD_SECONDS),
    10
  );
  const periodDurationSeconds =
    Number.isFinite(configuredPeriodDurationSeconds) && configuredPeriodDurationSeconds > 0
      ? configuredPeriodDurationSeconds
      : DEFAULT_PERMISSION_PERIOD_SECONDS;

  const requestSummary = useMemo(
    () => [
      { label: "Mission budget", value: `${policy.totalBudget.amount} ${policy.totalBudget.currency}` },
      { label: "Max per agent", value: `${policy.maxPerAgent.amount} ${policy.maxPerAgent.currency}` },
      { label: "Target chain", value: `Base Sepolia (${BASE_SEPOLIA_CHAIN_ID})` },
      { label: "Permission expiry", value: "60 minutes after approval request" },
      { label: "Period duration", value: `${periodDurationSeconds} seconds` }
    ],
    [periodDurationSeconds, policy.maxPerAgent.amount, policy.maxPerAgent.currency, policy.totalBudget.amount, policy.totalBudget.currency]
  );

  useEffect(() => {
    const provider = window.ethereum;

    if (!provider?.on || !provider.removeListener) {
      return;
    }

    const handleChainChanged = (value: unknown) => {
      const chainId = typeof value === "string" ? Number.parseInt(value, value.startsWith("0x") ? 16 : 10) : Number(value);

      if (!walletAddress || !Number.isFinite(chainId)) {
        return;
      }

      void readWalletReadiness({
        address: walletAddress,
        chainId,
        rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL,
        usdcAddress: tokenAddress
      }).then((readiness) => {
        setWallet(readiness);
        setActiveState(readiness.state);
        setMessage(
          readiness.state === "wrong_network"
            ? "Switch MetaMask to Base Sepolia before requesting a mission permission."
            : "Wallet is connected on Base Sepolia. You can request the scoped mission-budget permission receipt."
        );
      });
    };

    const handleAccountsChanged = (value: unknown) => {
      const [firstAccount] = Array.isArray(value) ? value : [];

      if (typeof firstAccount !== "string") {
        setWalletAddress(undefined);
        setWallet(null);
        setReceipt(null);
        setActiveState("wallet_not_connected");
        setMessage("MetaMask account disconnected. Connect MetaMask to continue the permission proof.");
        return;
      }

      setWalletAddress(undefined);
      setWallet(null);
      setReceipt(null);
      setActiveState("wallet_not_connected");
      setMessage("MetaMask account changed. Connect MetaMask again to refresh wallet readiness.");
    };

    provider.on("chainChanged", handleChainChanged);
    provider.on("accountsChanged", handleAccountsChanged);

    return () => {
      provider.removeListener?.("chainChanged", handleChainChanged);
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [tokenAddress, walletAddress]);

  async function connectWallet() {
    setAction("connect");
    setReceipt(null);

    const result = await connectMetaMask(window.ethereum);

    if (!result.ok) {
      setActiveState(result.state);
      setWallet(null);
      setWalletAddress(undefined);
      setMessage(result.message);
      setAction(null);
      return;
    }

    setWalletAddress(result.address);

    await updateWalletReadiness(result.address, result.chainId);
    setAction(null);
  }

  async function updateWalletReadiness(address: `0x${string}`, chainId: number) {
    const readiness = await readWalletReadiness({
      address,
      chainId,
      rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL,
      usdcAddress: tokenAddress
    });

    setWallet(readiness);
    setActiveState(readiness.state);
    setMessage(
      readiness.state === "wrong_network"
        ? "Switch MetaMask to Base Sepolia before requesting a mission permission."
        : "Wallet is connected on Base Sepolia. You can request the scoped mission-budget permission receipt."
    );
  }

  async function switchToBaseSepolia() {
    setAction("network");
    setReceipt(null);

    const result = await switchMetaMaskToBaseSepolia(window.ethereum);

    if (!result.ok) {
      setActiveState(result.state);
      setMessage(result.message);
      setAction(null);
      return;
    }

    if (walletAddress) {
      await updateWalletReadiness(walletAddress, result.chainId);
    } else {
      setMessage("Base Sepolia selected. Connect MetaMask to check wallet readiness.");
      setActiveState("wallet_not_connected");
    }

    setAction(null);
  }

  async function requestPermission() {
    setAction("permission");
    setActiveState("permission_requested");
    setReceipt(null);
    setMessage("MetaMask permission request is open. Approve only if the displayed scope matches the mission budget.");

    const result = await requestMissionBudgetPermission({
      provider: window.ethereum,
      policy: createActivePermissionPolicy(policy),
      delegateAddress,
      walletAddress,
      tokenAddress,
      periodDurationSeconds
    });

    setActiveState(result.state);

    if (result.state === "permission_granted") {
      setReceipt(result.receipt);
      setMessage(result.message);
    } else {
      setMessage(result.message);
    }

    setAction(null);
  }

  const canRequestPermission =
    activeState === "wallet_connected" && action !== "permission" && delegateAddress.trim().length > 0;

  return (
    <section
      className="rounded-lg border border-cyan-300/25 bg-cyan-950/20 p-5"
      data-testid="wallet-readiness-panel"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">MetaMask Permission Proof</p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Scoped mission-budget authority</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Phase 7 proves wallet connection, Base Sepolia readiness, and a sanitized Advanced Permissions receipt.
            <span className="font-semibold text-zinc-200" data-testid="permission-proof-disclaimer">
              {" "}
              No delegated x402 execution yet.
            </span>
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="connect-metamask"
          disabled={action !== null}
          onClick={connectWallet}
          type="button"
        >
          {action === "connect" ? <Loader2 className="animate-spin" size={16} /> : <Wallet size={16} />}
          {action === "connect" ? "Connecting" : "Connect MetaMask"}
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/50 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="switch-base-sepolia"
          disabled={action !== null}
          onClick={switchToBaseSepolia}
          type="button"
        >
          {action === "network" ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
          {action === "network" ? "Checking" : "Switch/Recheck Base Sepolia"}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="Permission proof states">
        {permissionStates.map((state) => (
          <span
            key={state}
            className={`rounded border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${activeStateClass(state, activeState)}`}
            data-testid={`permission-state-${state}`}
          >
            {stateLabels[state]}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center gap-2">
            {activeState === "permission_granted" ? (
              <CheckCircle2 className="text-emerald-300" size={18} />
            ) : activeState === "wrong_network" || activeState === "permission_unavailable" ? (
              <AlertTriangle className="text-amber-300" size={18} />
            ) : (
              <ShieldCheck className="text-cyan-300" size={18} />
            )}
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">Readiness</h3>
          </div>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Connected wallet</dt>
              <dd className="mt-1 font-semibold text-zinc-100">{shortAddress(walletAddress)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Chain</dt>
              <dd className="mt-1 font-semibold text-zinc-100">
                {wallet ? `${wallet.chainId}` : `Expected ${BASE_SEPOLIA_CHAIN_ID}`}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">ETH readiness</dt>
              <dd className="mt-1 font-semibold text-zinc-100">{balanceLine(wallet, "eth")}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">USDC readiness</dt>
              <dd className="mt-1 font-semibold text-zinc-100">{balanceLine(wallet, "usdc")}</dd>
            </div>
          </dl>
          {wallet?.diagnostics.length ? (
            <ul className="mt-4 grid gap-2 text-sm text-amber-100">
              {wallet.diagnostics.map((diagnostic) => (
                <li key={diagnostic} className="rounded border border-amber-300/30 bg-amber-950/40 px-3 py-2">
                  {diagnostic}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 rounded border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm leading-6 text-zinc-300">
            {message}
          </p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex items-center gap-2">
            <KeyRound className="text-cyan-300" size={18} />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">Permission Request</h3>
          </div>
          <label className="mt-4 grid gap-2 text-sm">
            <span className="font-medium text-zinc-300">Delegate/session public address</span>
            <input
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-300"
              data-testid="mission-delegate-address"
              onChange={(event) => setDelegateAddress(event.target.value)}
              placeholder="0x..."
              value={delegateAddress}
            />
          </label>
          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="request-mission-permission"
            disabled={!canRequestPermission}
            onClick={requestPermission}
            type="button"
          >
            {action === "permission" ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
            {action === "permission" ? "Requesting" : "Request Permission"}
          </button>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            This requests an ERC-20 periodic permission receipt only. The later ERC-7710 redemption, 1Shot relay, and
            user-authorized x402 execution path are separate phases.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">Mission policy scope</h3>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            {requestSummary.map((item) => (
              <div key={item.label}>
                <dt className="text-zinc-500">{item.label}</dt>
                <dd className="mt-1 font-semibold text-zinc-100">{item.value}</dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4" data-testid="permission-receipt-panel">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">Sanitized receipt</h3>
          {receipt ? (
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Receipt id</dt>
                <dd className="mt-1 font-semibold text-zinc-100">{receipt.receiptId}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Delegate</dt>
                <dd className="mt-1 font-semibold text-zinc-100">{shortAddress(receipt.delegateAddress)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Context hash</dt>
                <dd className="mt-1 font-semibold text-zinc-100">{receipt.contextHash ?? "not returned"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Dependencies</dt>
                <dd className="mt-1 font-semibold text-zinc-100">{receipt.dependencyCount}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              No receipt yet. When granted, this panel shows only hashes and metadata, never raw wallet payloads,
              signatures, or permission context.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

function createActivePermissionPolicy(policy: MissionBudgetPolicy): MissionBudgetPolicy {
  return {
    ...policy,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  };
}
