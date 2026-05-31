import type { AgentOutput, AgentTask, FinalReport, Mission, VeniceConfidence, VeniceResultState } from "../../core/types";

export type AiProviderId = "venice" | "gemini" | "mock";
export type AiProviderRole = "official_sponsor" | "development_testing" | "deterministic_mock";
export type AiProviderMode = "live" | "dev" | "fallback";

export type AiProviderCategory =
  | "configuration"
  | "auth"
  | "credits_billing"
  | "rate_limit"
  | "model"
  | "request_format"
  | "structured_output"
  | "network"
  | "provider"
  | "unknown";

export interface AiFailureDiagnostic {
  statusCode?: number;
  errorClass: string;
  providerCategory: AiProviderCategory;
  providerCode?: string;
}

export interface AiProviderOptions {
  env?: Record<string, string | undefined>;
}

export interface AiPlanResult {
  provider: AiProviderId;
  providerRole: AiProviderRole;
  mode: AiProviderMode;
  state: VeniceResultState;
  model: string;
  tasks: AgentTask[];
  rationale: string;
  notes: string[];
  diagnostic?: AiFailureDiagnostic;
}

export interface AiVerificationResult {
  provider: AiProviderId;
  providerRole: AiProviderRole;
  mode: AiProviderMode;
  state: VeniceResultState;
  model: string;
  verified: boolean;
  confidence: VeniceConfidence;
  notes: string[];
  riskSignals: string[];
  requiresHumanReview: boolean;
  diagnostic?: AiFailureDiagnostic;
}

export interface AiFinalReportResult {
  provider: AiProviderId;
  providerRole: AiProviderRole;
  mode: AiProviderMode;
  state: VeniceResultState;
  model: string;
  report: FinalReport;
  notes: string[];
  diagnostic?: AiFailureDiagnostic;
}

export interface AiProviderClient {
  id: AiProviderId;
  role: AiProviderRole;
  planMission(mission: Mission, options?: AiProviderOptions): Promise<AiPlanResult>;
  verifyAgentOutput(output: AgentOutput, options?: AiProviderOptions): Promise<AiVerificationResult>;
  synthesizeFinalReport(outputs: AgentOutput[], options?: AiProviderOptions): Promise<AiFinalReportResult>;
}
