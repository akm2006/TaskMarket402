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
      mode: "Mock Phase 1 state"
    }),
    node("manager-agent", "Manager Agent", "agent", "running", {
      objective: "Split mission budget into bounded specialist work.",
      output: "Three-task plan",
      budgetUsed: "0.00 USDC"
    }),
    node("contract-scanner", "Contract Scanner Agent", "agent", "completed", {
      subBudget: "0.40 USDC",
      output: "Mock contract risk summary",
      source: "Typed mock output"
    }),
    node("wallet-behavior", "Wallet Behavior Agent", "agent", "completed", {
      subBudget: "0.35 USDC",
      output: "Mock wallet behavior summary",
      source: "Typed mock output"
    }),
    node("market-context", "Market Context Agent", "agent", "completed", {
      subBudget: "0.25 USDC",
      output: "Mock liquidity and market context",
      source: "Typed mock output"
    }),
    node("x402-payment", "x402 Payment Node", "payment", "payment_required", {
      amount: "0.40 USDC",
      resource: "Contract Scanner report",
      implementation: "Mock 402 challenge only"
    }),
    node("oneshot-relay", "1Shot Relay Status", "relay", "planned", {
      status: "Future real relay proof",
      currentState: "Not implemented in Phase 1",
      reason: "Sponsor integration deferred"
    }),
    node("venice-verification", "Venice Verification", "verification", "verified", {
      status: "Mock verifier pass",
      implementation: "Placeholder until Venice research and adapter work"
    }),
    node("final-report", "Final Report", "report", "planned", {
      status: "Placeholder",
      synthesis: "Awaiting real Venice implementation"
    }),
    node("blocked-payment", "Blocked Payment Demo", "payment", "blocked", {
      attemptedAmount: "0.80 USDC",
      maxPerAgent: "0.50 USDC",
      reason: "Policy rejected spend above per-agent cap"
    })
  ],
  edges: [
    { id: "mission-manager", source: "mission-budget", target: "manager-agent", label: "Mission authority to planning" },
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
    title: "Payment required",
    detail: "Mock x402 payment challenge recorded for a 0.40 USDC report resource.",
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
    actor: "Mock Verification",
    title: "Outputs accepted",
    detail: "Typed mock outputs were accepted for report synthesis placeholder.",
    status: "verified",
    relatedNodeId: "venice-verification"
  }
];

const finalReport: FinalReportPlaceholder = {
  title: "Wallet / Token Risk Report",
  status: "placeholder",
  summary: "Phase 1 renders the report shell and audit trail. Real Venice synthesis is intentionally deferred.",
  sections: [
    {
      heading: "Budget Trail",
      body: "The mission budget, sub-budgets, payment-required node, and blocked payment are visible in the WorkGraph."
    },
    {
      heading: "Specialist Outputs",
      body: "Contract, wallet behavior, and market context summaries are typed mock outputs only."
    },
    {
      heading: "Deferred Integrations",
      body: "MetaMask, x402 settlement, 1Shot relay, Venice synthesis, and Supabase persistence remain behind placeholders."
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
