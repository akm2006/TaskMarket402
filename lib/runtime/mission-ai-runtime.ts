import { createAiProvider } from "../adapters/ai/provider";
import type {
  AiFailureDiagnostic,
  AiFinalReportResult,
  AiPlanResult,
  AiProviderCategory,
  AiProviderClient,
  AiProviderId,
  AiProviderMode,
  AiProviderOptions,
  AiProviderRole,
  AiVerificationResult
} from "../adapters/ai/provider-types";
import { runSpecialistAgents, type SpecialistAgentOptions, type SpecialistAgentRun } from "../agents";
import { phaseOneDemoSnapshot } from "../core/phase-one-demo";
import type { AgentOutput, AgentTask, FinalReport, MissionRunSnapshot, VeniceConfidence } from "../core/types";
import {
  runPaidSpecialistAgentsWithDevPayment,
  type PaidAgentFlow,
  type PaidAgentFlowResult,
  type PaidAgentPaymentEvent,
  type PaidAgentPaymentEventType
} from "./paid-agent-flow";

export type MissionAiRuntimeState = "completed" | "fallback" | "failed" | "credits_billing" | "rate_limit";
export type MissionAiSpecialistOutputSource = "real_data_agents" | "agent_fallback_outputs" | "phase_one_typed_mock_outputs";

export interface MissionAiRuntimeStatus {
  provider: AiProviderId;
  providerRole: AiProviderRole;
  mode: AiProviderMode;
  state: MissionAiRuntimeState;
  model: string;
  failureCategory?: AiProviderCategory;
}

export interface MissionAiRuntimePlanDto {
  status: MissionAiRuntimeStatus;
  rationale: string;
  taskCount: number;
  tasks: AgentTask[];
}

export interface MissionAiRuntimeVerificationItemDto {
  taskId: string;
  status: MissionAiRuntimeStatus;
  verified: boolean;
  confidence: VeniceConfidence;
  riskSignals: string[];
  requiresHumanReview: boolean;
  notes: string[];
}

export interface MissionAiRuntimeReportDto {
  status: MissionAiRuntimeStatus;
  report: FinalReport;
}

export interface MissionAiRuntimeSpecialistOutputDto {
  taskId: string;
  agentKind: SpecialistAgentRun["agentKind"];
  source: SpecialistAgentRun["source"];
  summary: string;
  evidence: string[];
  riskSignals: string[];
  diagnostics: string[];
}

export interface MissionAiPaymentEventDto {
  id: string;
  type: PaidAgentPaymentEventType;
  agentKind: SpecialistAgentRun["agentKind"];
  taskId: string;
  resourceId: string;
  title: string;
  detail: string;
  amount: string;
  currency: "USDC";
  occurredAt: string;
  simulatedSettlement: boolean;
}

export interface MissionAiRuntimeResponse {
  source: "ai_runtime";
  staticBaseline: "phase_one_mock_snapshot";
  specialistOutputSource: MissionAiSpecialistOutputSource;
  paymentFlow: PaidAgentFlow;
  paymentEvents: MissionAiPaymentEventDto[];
  missionId: string;
  generatedAt: string;
  provider: AiProviderId;
  providerRole: AiProviderRole;
  mode: AiProviderMode;
  state: MissionAiRuntimeState;
  specialistOutputs: MissionAiRuntimeSpecialistOutputDto[];
  plan: MissionAiRuntimePlanDto;
  verification: {
    status: MissionAiRuntimeStatus;
    verifiedCount: number;
    requiresHumanReviewCount: number;
    items: MissionAiRuntimeVerificationItemDto[];
  };
  finalReport: MissionAiRuntimeReportDto;
}

export interface MissionAiRuntimeOptions extends AiProviderOptions {
  provider?: AiProviderClient;
  snapshot?: MissionRunSnapshot;
  specialistRuns?: SpecialistAgentRun[];
  agentOptions?: SpecialistAgentOptions;
  agentRunner?: (snapshot: MissionRunSnapshot, options: SpecialistAgentOptions) => Promise<SpecialistAgentRun[]>;
  paymentFlow?: PaidAgentFlow;
  paidAgentRunner?: (snapshot: MissionRunSnapshot, options: SpecialistAgentOptions) => Promise<PaidAgentFlowResult>;
  now?: () => string;
}

function stateFromDiagnostic(diagnostic: AiFailureDiagnostic | undefined): MissionAiRuntimeState | undefined {
  if (diagnostic?.providerCategory === "credits_billing") {
    return "credits_billing";
  }

  if (diagnostic?.providerCategory === "rate_limit") {
    return "rate_limit";
  }

  return undefined;
}

function runtimeState(
  mode: AiProviderMode,
  state: string,
  diagnostic: AiFailureDiagnostic | undefined
): MissionAiRuntimeState {
  const diagnosticState = stateFromDiagnostic(diagnostic);

  if (diagnosticState) {
    return diagnosticState;
  }

  if (state === "completed") {
    return "completed";
  }

  if (
    mode === "fallback" ||
    state === "skipped_missing_api_key" ||
    state === "empty_response" ||
    state === "invalid_response" ||
    state === "policy_rejected"
  ) {
    return "fallback";
  }

  return "failed";
}

function statusFromResult(result: {
  provider: AiProviderId;
  providerRole: AiProviderRole;
  mode: AiProviderMode;
  state: string;
  model: string;
  diagnostic?: AiFailureDiagnostic;
}): MissionAiRuntimeStatus {
  return {
    provider: result.provider,
    providerRole: result.providerRole,
    mode: result.mode,
    state: runtimeState(result.mode, result.state, result.diagnostic),
    model: result.model,
    failureCategory: result.diagnostic?.providerCategory
  };
}

function aggregateState(statuses: MissionAiRuntimeStatus[]): MissionAiRuntimeState {
  const priority: MissionAiRuntimeState[] = ["credits_billing", "rate_limit", "failed", "fallback", "completed"];

  return priority.find((state) => statuses.some((status) => status.state === state)) ?? "completed";
}

function aggregateMode(statuses: MissionAiRuntimeStatus[]): AiProviderMode {
  if (statuses.some((status) => status.mode === "live")) {
    return "live";
  }

  if (statuses.some((status) => status.mode === "dev")) {
    return "dev";
  }

  return "fallback";
}

async function verifyOutputs(
  provider: AiProviderClient,
  outputs: AgentOutput[],
  options: AiProviderOptions
): Promise<AiVerificationResult[]> {
  const results: AiVerificationResult[] = [];

  for (const output of outputs) {
    results.push(await provider.verifyAgentOutput(output, options));
  }

  return results;
}

function staticMockSpecialistRuns(snapshot: MissionRunSnapshot): SpecialistAgentRun[] {
  return snapshot.specialistOutputs.map((output) => ({
    agentKind: output.taskId.includes("wallet")
      ? "wallet_behavior"
      : output.taskId.includes("market")
        ? "market_context"
        : "contract_scanner",
    source: "mock",
    output: {
      ...output,
      evidence: output.evidence[0]?.startsWith("Output source:")
        ? output.evidence
        : ["Output source: mock", ...output.evidence]
    },
    diagnostics: ["Static Phase 1 mock specialist output."]
  }));
}

function specialistOutputSource(runs: SpecialistAgentRun[]): MissionAiSpecialistOutputSource {
  if (runs.some((run) => run.source === "real-data")) {
    return "real_data_agents";
  }

  if (runs.every((run) => run.source === "mock")) {
    return "phase_one_typed_mock_outputs";
  }

  return "agent_fallback_outputs";
}

function toSpecialistOutputDto(run: SpecialistAgentRun): MissionAiRuntimeSpecialistOutputDto {
  return {
    taskId: run.output.taskId,
    agentKind: run.agentKind,
    source: run.source,
    summary: run.output.summary,
    evidence: run.output.evidence.slice(0, 8),
    riskSignals: run.output.riskSignals,
    diagnostics: run.diagnostics.slice(0, 4)
  };
}

function toPaymentEventDto(event: PaidAgentPaymentEvent): MissionAiPaymentEventDto {
  return {
    id: event.id,
    type: event.type,
    agentKind: event.agentKind,
    taskId: event.taskId,
    resourceId: event.resourceId,
    title: event.title,
    detail: event.detail,
    amount: event.amount,
    currency: event.currency,
    occurredAt: event.occurredAt,
    simulatedSettlement: event.simulatedSettlement
  };
}

function usesPaidAgentFlow(paymentFlow: PaidAgentFlow): boolean {
  return (
    paymentFlow === "x402_style_dev" ||
    paymentFlow === "x402_contract_scanner_real" ||
    paymentFlow === "x402_real_agents"
  );
}

export async function runDemoMissionAiRuntime(options: MissionAiRuntimeOptions = {}): Promise<MissionAiRuntimeResponse> {
  const snapshot = options.snapshot ?? phaseOneDemoSnapshot;
  const provider = options.provider ?? createAiProvider(options);
  const providerOptions: AiProviderOptions = {
    env: options.env
  };
  const agentOptions: SpecialistAgentOptions = {
    env: options.env,
    ...options.agentOptions
  };
  let paymentFlow: PaidAgentFlow = options.paymentFlow ?? "x402_style_dev";
  let paymentEvents: PaidAgentPaymentEvent[] = [];
  let specialistRuns: SpecialistAgentRun[];

  if (options.specialistRuns) {
    specialistRuns = options.specialistRuns;
    paymentFlow = "direct_agents";
  } else if (options.agentRunner) {
    specialistRuns = await options.agentRunner(snapshot, agentOptions);
    paymentFlow = "direct_agents";
  } else if (usesPaidAgentFlow(paymentFlow)) {
    const paidResult = options.paidAgentRunner
      ? await options.paidAgentRunner(snapshot, agentOptions)
      : await runPaidSpecialistAgentsWithDevPayment(snapshot, {
          ...agentOptions,
          now: options.now
        });
    specialistRuns = paidResult.runs;
    paymentEvents = paidResult.paymentEvents;
  } else {
    specialistRuns = await runSpecialistAgents(snapshot.mission, agentOptions);
  }

  const specialistOutputs: AgentOutput[] = specialistRuns.map((run) => run.output);

  const planResult: AiPlanResult = await provider.planMission(snapshot.mission, providerOptions);
  const verificationResults = await verifyOutputs(provider, specialistOutputs, providerOptions);
  const reportResult: AiFinalReportResult = await provider.synthesizeFinalReport(specialistOutputs, providerOptions);

  const planStatus = statusFromResult(planResult);
  const verificationItems = verificationResults.map((result, index) => ({
    taskId: specialistOutputs[index]?.taskId ?? `specialist-output-${index + 1}`,
    status: statusFromResult(result),
    verified: result.verified,
    confidence: result.confidence,
    riskSignals: result.riskSignals,
    requiresHumanReview: result.requiresHumanReview,
    notes: result.notes.slice(0, 3)
  }));
  const verificationStatuses = verificationItems.map((item) => item.status);
  const reportStatus = statusFromResult(reportResult);
  const allStatuses = [planStatus, ...verificationStatuses, reportStatus];
  const verificationStatus: MissionAiRuntimeStatus = verificationStatuses[0]
    ? {
        ...verificationStatuses[0],
        mode: aggregateMode(verificationStatuses),
        state: aggregateState(verificationStatuses)
      }
    : planStatus;

  return {
    source: "ai_runtime",
    staticBaseline: "phase_one_mock_snapshot",
    specialistOutputSource: specialistOutputSource(specialistRuns),
    paymentFlow,
    paymentEvents: paymentEvents.map(toPaymentEventDto),
    missionId: snapshot.mission.id,
    generatedAt: options.now?.() ?? new Date().toISOString(),
    provider: planStatus.provider,
    providerRole: planStatus.providerRole,
    mode: aggregateMode(allStatuses),
    state: aggregateState(allStatuses),
    specialistOutputs: specialistRuns.map(toSpecialistOutputDto),
    plan: {
      status: planStatus,
      rationale: planResult.rationale,
      taskCount: planResult.tasks.length,
      tasks: planResult.tasks
    },
    verification: {
      status: verificationStatus,
      verifiedCount: verificationResults.filter((result) => result.verified).length,
      requiresHumanReviewCount: verificationResults.filter((result) => result.requiresHumanReview).length,
      items: verificationItems.map((item, index) => ({
        ...item,
        taskId: specialistOutputs[index]?.taskId ?? item.taskId
      }))
    },
    finalReport: {
      status: reportStatus,
      report: reportResult.report
    }
  };
}

export function createStaticMockSpecialistRuns(snapshot: MissionRunSnapshot = phaseOneDemoSnapshot): SpecialistAgentRun[] {
  return staticMockSpecialistRuns(snapshot);
}
