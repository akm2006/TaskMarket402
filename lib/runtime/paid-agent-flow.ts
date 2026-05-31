import {
  createDevPaymentSignature,
  createX402ProtectedResource,
  verifyDevPaymentProof,
  type X402ProtectedResource
} from "../adapters/payment/x402-server";
import { runSpecialistAgentByKind, type SpecialistAgentOptions, type SpecialistAgentRun } from "../agents";
import type { SpecialistAgentKind } from "../agents/types";
import { outputWithSource } from "../agents/types";
import type { AgentTask, Mission, MissionRunSnapshot } from "../core/types";

export type PaidAgentPaymentEventType = "payment_required" | "dev_payment_accepted" | "agent_output_returned";
export type PaidAgentFlow = "direct_agents" | "x402_style_dev";

export interface PaidAgentPaymentEvent {
  id: string;
  type: PaidAgentPaymentEventType;
  agentKind: SpecialistAgentKind;
  taskId: string;
  resourceId: string;
  title: string;
  detail: string;
  amount: string;
  currency: "USDC";
  occurredAt: string;
  simulatedSettlement: true;
}

export interface PaidAgentFlowResult {
  flow: "x402_style_dev";
  runs: SpecialistAgentRun[];
  paymentEvents: PaidAgentPaymentEvent[];
}

export interface PaidAgentFlowOptions extends SpecialistAgentOptions {
  now?: () => string;
}

const specialistKinds: SpecialistAgentKind[] = ["contract_scanner", "wallet_behavior", "market_context"];

export function specialistAgentSlug(agentKind: SpecialistAgentKind): string {
  return agentKind.replaceAll("_", "-");
}

export function specialistAgentKindFromSlug(slug: string): SpecialistAgentKind | undefined {
  const normalized = slug.replaceAll("-", "_");

  if (normalized === "contract_scanner" || normalized === "wallet_behavior" || normalized === "market_context") {
    return normalized;
  }

  return undefined;
}

function fallbackTask(mission: Mission, agentKind: SpecialistAgentKind): AgentTask {
  return {
    id: `${mission.id}:${specialistAgentSlug(agentKind)}`,
    missionId: mission.id,
    agentKind,
    objective: `${agentKind.replaceAll("_", " ")} specialist work.`,
    budget: mission.budgetPolicy.maxPerAgent
  };
}

export function taskForSpecialist(snapshot: MissionRunSnapshot, agentKind: SpecialistAgentKind): AgentTask {
  return snapshot.managerPlan.find((task) => task.agentKind === agentKind) ?? fallbackTask(snapshot.mission, agentKind);
}

export function createPaidAgentResource(
  snapshot: MissionRunSnapshot,
  agentKind: SpecialistAgentKind,
  resourceUrl: string
): X402ProtectedResource {
  const task = taskForSpecialist(snapshot, agentKind);

  return createX402ProtectedResource({
    task,
    agentKind,
    resourceUrl,
    description: `${agentKind.replaceAll("_", " ")} output for ${snapshot.mission.title}`,
    price: task.budget.amount
  });
}

function paymentEvent(
  resource: X402ProtectedResource,
  type: PaidAgentPaymentEventType,
  title: string,
  detail: string,
  now: () => string
): PaidAgentPaymentEvent {
  return {
    id: `${resource.resourceId}:${type}`,
    type,
    agentKind: resource.agentKind,
    taskId: resource.task.id,
    resourceId: resource.resourceId,
    title,
    detail,
    amount: resource.price,
    currency: resource.task.budget.currency,
    occurredAt: now(),
    simulatedSettlement: true
  };
}

function paymentFallbackRun(
  mission: Mission,
  agentKind: SpecialistAgentKind,
  reason: string,
  diagnostics: string[]
): SpecialistAgentRun {
  return {
    agentKind,
    source: "fallback",
    diagnostics,
    output: outputWithSource(
      {
        taskId: `${mission.id}:${specialistAgentSlug(agentKind)}`,
        summary: `Paid agent fallback: ${reason}`,
        evidence: diagnostics,
        riskSignals: ["x402-style-payment-unavailable"]
      },
      "fallback"
    )
  };
}

export async function runPaidAgentAfterAcceptedPayment(
  mission: Mission,
  agentKind: SpecialistAgentKind,
  options: SpecialistAgentOptions = {}
): Promise<SpecialistAgentRun> {
  return runSpecialistAgentByKind(mission, agentKind, options);
}

export async function runPaidSpecialistAgentsWithDevPayment(
  snapshot: MissionRunSnapshot,
  options: PaidAgentFlowOptions = {}
): Promise<PaidAgentFlowResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const runs: SpecialistAgentRun[] = [];
  const paymentEvents: PaidAgentPaymentEvent[] = [];

  for (const agentKind of specialistKinds) {
    const resource = createPaidAgentResource(snapshot, agentKind, `internal://taskmarket402/api/agents/${specialistAgentSlug(agentKind)}`);
    paymentEvents.push(
      paymentEvent(
        resource,
        "payment_required",
        "Payment required",
        "x402-style development challenge created before specialist output is returned.",
        now
      )
    );

    const headers = new Headers({
      "PAYMENT-SIGNATURE": createDevPaymentSignature(resource, options.env)
    });
    const verification = verifyDevPaymentProof(headers, resource, options.env);

    if (!verification.ok) {
      runs.push(
        paymentFallbackRun(snapshot.mission, agentKind, "development payment proof was not accepted", [
          `x402-style dev payment fallback: ${verification.reason}`
        ])
      );
      continue;
    }

    paymentEvents.push(
      paymentEvent(
        resource,
        "dev_payment_accepted",
        "Development payment accepted",
        "Development-only proof accepted; no real x402 settlement occurred.",
        now
      )
    );

    const run = await runPaidAgentAfterAcceptedPayment(snapshot.mission, agentKind, options);
    runs.push(run);
    paymentEvents.push(
      paymentEvent(
        resource,
        "agent_output_returned",
        "Agent output returned",
        `${agentKind.replaceAll("_", " ")} returned a ${run.source} output after simulated payment acceptance.`,
        now
      )
    );
  }

  return {
    flow: "x402_style_dev",
    runs,
    paymentEvents
  };
}
