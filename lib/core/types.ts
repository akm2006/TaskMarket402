export type MissionStatus = "draft" | "planned" | "running" | "completed" | "blocked" | "failed";

export type WorkGraphNodeStatus =
  | "planned"
  | "running"
  | "payment_required"
  | "paid"
  | "relayed"
  | "verified"
  | "blocked"
  | "failed"
  | "completed";

export type AgentKind = "manager" | "contract_scanner" | "wallet_behavior" | "market_context";

export interface MoneyAmount {
  amount: string;
  currency: "USDC";
  chainId: number;
}

export interface MissionBudgetPolicy {
  missionId: string;
  totalBudget: MoneyAmount;
  maxPerAgent: MoneyAmount;
  expiresAt: string;
  allowedPaymentProtocol: "x402";
}

export interface Mission {
  id: string;
  title: string;
  targetAddress: string;
  budgetPolicy: MissionBudgetPolicy;
  status: MissionStatus;
  createdAt: string;
}

export interface AgentTask {
  id: string;
  missionId: string;
  agentKind: AgentKind;
  budget: MoneyAmount;
  objective: string;
}

export interface WorkGraphNode {
  id: string;
  label: string;
  status: WorkGraphNodeStatus;
  kind: "mission" | "agent" | "payment" | "relay" | "verification" | "report";
  metadata?: Record<string, string>;
}

export interface WorkGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface WorkGraph {
  missionId: string;
  nodes: WorkGraphNode[];
  edges: WorkGraphEdge[];
}

export interface AgentOutput {
  taskId: string;
  summary: string;
  evidence: string[];
  riskSignals: string[];
}

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export type VeniceExecutionMode = "live" | "fallback";

export type VeniceResultState =
  | "completed"
  | "skipped_missing_api_key"
  | "empty_response"
  | "invalid_response"
  | "request_failed"
  | "policy_rejected";

export type VeniceConfidence = "low" | "medium" | "high" | "unknown";

export interface FinalReportSection {
  heading: string;
  body: string;
}

export interface FinalReport {
  title: string;
  status: "synthesized" | "fallback";
  summary: string;
  riskLevel: RiskLevel;
  sections: FinalReportSection[];
  recommendations: string[];
  verificationSummary: string;
}

export interface WorkGraphEvent {
  id: string;
  occurredAt: string;
  actor: string;
  title: string;
  detail: string;
  status: WorkGraphNodeStatus;
  relatedNodeId?: string;
}

export interface FinalReportPlaceholder {
  title: string;
  status: "placeholder";
  summary: string;
  sections: FinalReportSection[];
}

export interface MissionRunSnapshot {
  mission: Mission;
  managerPlan: AgentTask[];
  specialistOutputs: AgentOutput[];
  workGraph: WorkGraph;
  events: WorkGraphEvent[];
  finalReport: FinalReportPlaceholder;
  blockedPaymentReason: string;
}
