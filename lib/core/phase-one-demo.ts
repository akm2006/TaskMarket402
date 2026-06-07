import { createInitialAgentPlan } from "./agent-orchestrator";
import { createMission } from "./mission";
import type {
  AgentOutput,
  FinalReportPlaceholder,
  MissionRunSnapshot,
  WorkGraph,
  WorkGraphEvent,
  WorkGraphNode
} from "./types";

const mission = {
  ...createMission({
    id: "risk-report-demo",
    title: "Wallet / Token Risk Report",
    targetAddress: "0x7a3F2C0b8d4E1a9F6B12C88d91e9A0b4c51D7A20",
    createdAt: "2026-05-27T09:30:00.000Z",
    budgetPolicy: {
      missionId: "risk-report-demo",
      totalBudget: {
        amount: "3.00",
        currency: "USDC",
        chainId: 84532
      },
      maxPerAgent: {
        amount: "0.50",
        currency: "USDC",
        chainId: 84532
      },
      expiresAt: "2026-05-27T10:30:00.000Z",
      allowedPaymentProtocol: "x402"
    }
  }),
  status: "planned" as const
};

const managerPlan = createInitialAgentPlan(mission);

const node = (
  id: string,
  label: string,
  kind: WorkGraphNode["kind"],
  status: WorkGraphNode["status"],
  metadata: Record<string, string>
): WorkGraphNode => ({
  id,
  label,
  kind,
  status,
  metadata
});

const workGraph: WorkGraph = {
  missionId: mission.id,
  nodes: [
    node("mission-budget", "Mission Budget", "mission", "planned", {
      budget: "3.00 USDC",
      maxPerAgent: "0.50 USDC",
      scope: "Wallet / Token Risk Report",
      mode: "Hybrid demo baseline"
    }),
    node("metamask-permission", "MetaMask Permission Proof", "permission", "planned", {
      network: "Base Sepolia",
      status: "Phase 7 wallet permission receipt",
      scope: "Wallet connection -> scoped mission-budget permission",
      states: "wallet_not_connected / wallet_connected / wrong_network / permission_requested / permission_granted / permission_rejected / permission_unavailable",
      proofBoundary: "No delegated x402 execution yet"
    }),
    node("manager-agent", "Manager Agent", "agent", "running", {
      objective: "Split mission budget into bounded specialist work.",
      output: "Three-task plan",
      budgetUsed: "0.00 USDC"
    }),
    node("contract-scanner", "Contract Scanner Agent", "agent", "completed", {
      subBudget: "0.40 USDC",
      output: "Real-data contract analysis",
      source: "Server-side specialist agent",
      paymentMode: "real x402 capable",
      outputMode: "real-data output"
    }),
    node("wallet-behavior", "Wallet Behavior Agent", "agent", "completed", {
      subBudget: "0.35 USDC",
      output: "Wallet behavior analysis",
      source: "Server-side specialist agent",
      paymentMode: "simulated payment",
      outputMode: "real-data or fallback output"
    }),
    node("market-context", "Market Context Agent", "agent", "completed", {
      subBudget: "0.25 USDC",
      output: "Market context analysis",
      source: "Server-side specialist agent",
      paymentMode: "simulated payment",
      outputMode: "real-data or fallback output"
    }),
    node("x402-payment", "x402 Payment Node", "payment", "payment_required", {
      amount: "0.40 USDC",
      resource: "Contract Scanner report",
      status: "Contract Scanner real x402",
      implementation: "Phase 5 Base Sepolia path is live-proven when runtime/env are configured",
      paymentMode: "real x402"
    }),
    node("oneshot-relay", "1Shot Relay Status", "relay", "planned", {
      status: "Future real relay proof",
      currentState: "Not implemented in Phase 1",
      reason: "Sponsor integration deferred"
    }),
    node("venice-verification", "AI Verification Layer", "verification", "verified", {
      status: "Provider-layer verification",
      implementation: "Venice remains official sponsor path; Gemini/mock can appear only as provider-labeled fallback/dev states",
      aiMode: "AI verified or fallback"
    }),
    node("final-report", "Final Report", "report", "planned", {
      status: "Synthesized mission result",
      synthesis: "Server runtime can synthesize from specialist outputs through the provider-neutral AI layer",
      aiMode: "final report ready"
    }),
    node("blocked-payment", "Blocked Payment Demo", "payment", "blocked", {
      attemptedAmount: "0.80 USDC",
      maxPerAgent: "0.50 USDC",
      reason: "Policy rejected spend above per-agent cap",
      proofState: "policy enforced"
    })
  ],
  edges: [
    {
      id: "mission-permission",
      source: "mission-budget",
      target: "metamask-permission",
      label: "Budget scope to wallet permission"
    },
    {
      id: "permission-manager",
      source: "metamask-permission",
      target: "manager-agent",
      label: "Permission receipt enables planning proof"
    },
    { id: "manager-contract", source: "manager-agent", target: "contract-scanner", label: "0.40 USDC sub-budget" },
    { id: "manager-wallet", source: "manager-agent", target: "wallet-behavior", label: "0.35 USDC sub-budget" },
    { id: "manager-market", source: "manager-agent", target: "market-context", label: "0.25 USDC sub-budget" },
    { id: "contract-payment", source: "contract-scanner", target: "x402-payment", label: "Payment-required branch" },
    { id: "payment-relay", source: "x402-payment", target: "oneshot-relay", label: "Future relay/status branch" },
    { id: "contract-verify", source: "contract-scanner", target: "venice-verification", label: "Contract output to verification" },
    { id: "wallet-verify", source: "wallet-behavior", target: "venice-verification", label: "Wallet output to verification" },
    { id: "market-verify", source: "market-context", target: "venice-verification", label: "Market output to verification" },
    { id: "verify-report", source: "venice-verification", target: "final-report", label: "Verified outputs to report shell" },
    { id: "manager-blocked", source: "manager-agent", target: "blocked-payment", label: "Policy-enforcement branch" }
  ]
};

const specialistOutputs: AgentOutput[] = [
  {
    taskId: `${mission.id}:contract-scanner`,
    summary: "Mock scan flags proxy-like upgrade surface and missing verified-source confidence.",
    evidence: ["Verified-source placeholder: not checked", "Proxy pattern placeholder: simulated", "Owner privilege placeholder: simulated"],
    riskSignals: ["upgradeable-contract", "owner-privilege", "verification-needed"]
  },
  {
    taskId: `${mission.id}:wallet-behavior`,
    summary: "Mock wallet behavior shows concentrated inbound transfers and limited counterparty diversity.",
    evidence: ["Transfer cluster placeholder", "Counterparty diversity placeholder", "Recent activity placeholder"],
    riskSignals: ["concentration-risk", "recent-activity-spike"]
  },
  {
    taskId: `${mission.id}:market-context`,
    summary: "Mock market context shows thin liquidity and short history, so confidence remains provisional.",
    evidence: ["Liquidity depth placeholder", "Pair age placeholder", "Volume consistency placeholder"],
    riskSignals: ["thin-liquidity", "short-market-history"]
  }
];

const events: WorkGraphEvent[] = [
  {
    id: "event-001",
    occurredAt: "09:30:00",
    actor: "User",
    title: "Mission drafted",
    detail: "Wallet / Token Risk Report created with 3.00 USDC mission budget.",
    status: "planned",
    relatedNodeId: "mission-budget"
  },
  {
    id: "event-002",
    occurredAt: "09:30:04",
    actor: "Manager Agent",
    title: "Plan generated",
    detail: "Budget split into Contract Scanner, Wallet Behavior, and Market Context work units.",
    status: "running",
    relatedNodeId: "manager-agent"
  },
  {
    id: "event-003",
    occurredAt: "09:30:08",
    actor: "Contract Scanner",
    title: "x402 payment boundary",
    detail: "Contract Scanner owns the real x402 path in Phase 5; Wallet Behavior and Market Context remain simulated/dev payment.",
    status: "payment_required",
    relatedNodeId: "x402-payment"
  },
  {
    id: "event-004",
    occurredAt: "09:30:11",
    actor: "Policy Engine",
    title: "Overspend blocked",
    detail: "A 0.80 USDC specialist payment attempt exceeded the 0.50 USDC per-agent cap.",
    status: "blocked",
    relatedNodeId: "blocked-payment"
  },
  {
    id: "event-005",
    occurredAt: "09:30:18",
    actor: "AI Runtime",
    title: "Verification layer ready",
    detail: "Runtime results label Venice, Gemini, or mock/fallback states explicitly; credits-billing fallback is not presented as live Venice inference.",
    status: "verified",
    relatedNodeId: "venice-verification"
  }
];

const finalReport: FinalReportPlaceholder = {
  title: "Wallet / Token Risk Report",
  status: "placeholder",
  summary: "The static snapshot anchors the audit trail. The server runtime can now show provider-labeled AI planning, verification, and final report synthesis without changing wallet or payment execution.",
  sections: [
    {
      heading: "Budget Trail",
      body: "The mission budget, sub-budgets, payment-required node, and blocked payment are visible in the WorkGraph."
    },
    {
      heading: "Specialist Outputs",
      body: "Contract Scanner can run behind the real x402 path; Wallet Behavior and Market Context intentionally stay on simulated/dev payment for this phase."
    },
    {
      heading: "Deferred Integrations",
      body: "MetaMask, ERC-7710, 1Shot relay, wallet UI, and Supabase persistence remain out of scope for Phase 6."
    }
  ]
};

export const phaseOneDemoSnapshot: MissionRunSnapshot = {
  mission,
  managerPlan,
  specialistOutputs,
  workGraph,
  events,
  finalReport,
  blockedPaymentReason: "Payment blocked because requested spend exceeds the mission policy max per-agent cap."
};
