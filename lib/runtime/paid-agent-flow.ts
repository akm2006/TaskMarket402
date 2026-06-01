import {
  payContractScannerWithX402,
  type X402ContractScannerPaymentResult
} from "../adapters/payment/x402-client";
import {
  contractScannerX402Mode,
  createDevPaymentSignature,
  createX402ProtectedResource,
  verifyDevPaymentProof,
  type X402ProtectedResource
} from "../adapters/payment/x402-server";
import { runSpecialistAgentByKind, type SpecialistAgentOptions, type SpecialistAgentRun } from "../agents";
import type { SpecialistAgentKind } from "../agents/types";
import { outputWithSource } from "../agents/types";
import type { AgentTask, Mission, MissionRunSnapshot } from "../core/types";

export type PaidAgentPaymentEventType =
  | "payment_required"
  | "dev_payment_accepted"
  | "real_x402_payment_required"
  | "real_x402_paid"
  | "real_x402_failed"
  | "real_x402_unavailable"
  | "simulated_payment_used"
  | "agent_output_returned";
export type PaidAgentFlow = "direct_agents" | "x402_style_dev" | "x402_contract_scanner_real";

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
  simulatedSettlement: boolean;
}

export interface PaidAgentFlowResult {
  flow: "x402_style_dev" | "x402_contract_scanner_real";
  runs: SpecialistAgentRun[];
  paymentEvents: PaidAgentPaymentEvent[];
}

export interface PaidAgentFlowOptions extends SpecialistAgentOptions {
  now?: () => string;
  contractScannerBuyer?: (
    payload: { targetAddress: string },
    options?: Parameters<typeof payContractScannerWithX402>[1]
  ) => Promise<X402ContractScannerPaymentResult>;
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
  now: () => string,
  simulatedSettlement = true
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
    simulatedSettlement
  };
}

function priceAmount(value: string | undefined, fallback: string): string {
  if (!value?.trim()) {
    return fallback;
  }

  const trimmed = value.trim();
  const normalized = trimmed.startsWith(".") ? `0${trimmed}` : trimmed;

  return normalized.charCodeAt(0) === 36 ? normalized.slice(1) : normalized;
}

function resourceWithPrice(resource: X402ProtectedResource, price: string): X402ProtectedResource {
  return {
    ...resource,
    price
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
  let flow: PaidAgentFlowResult["flow"] = "x402_style_dev";

  for (const agentKind of specialistKinds) {
    const baseResourceUrl =
      agentKind === "contract_scanner" && options.env?.X402_CONTRACT_SCANNER_URL
        ? options.env.X402_CONTRACT_SCANNER_URL
        : `internal://taskmarket402/api/agents/${specialistAgentSlug(agentKind)}`;
    const resource = createPaidAgentResource(snapshot, agentKind, baseResourceUrl);

    if (agentKind === "contract_scanner" && contractScannerX402Mode(options.env) === "real") {
      flow = "x402_contract_scanner_real";
      const realResource = resourceWithPrice(
        resource,
        priceAmount(options.env?.X402_CONTRACT_SCANNER_PRICE_USD, resource.price)
      );

      paymentEvents.push(
        paymentEvent(
          realResource,
          "real_x402_payment_required",
          "Real x402 payment required",
          "Contract Scanner attempted the real x402 buyer/seller/facilitator path.",
          now,
          false
        )
      );

      const buyer = options.contractScannerBuyer ?? payContractScannerWithX402;
      const realPayment = await buyer(
        {
          targetAddress: snapshot.mission.targetAddress
        },
        {
          env: options.env
        }
      );

      if (realPayment.state === "real_x402_paid" && realPayment.specialistRun) {
        runs.push(realPayment.specialistRun);
        paymentEvents.push(
          paymentEvent(
            realResource,
            "real_x402_paid",
            "Real x402 paid",
            realPayment.transactionPresent
              ? "Contract Scanner settled through x402 and returned a specialist output."
              : "Contract Scanner returned a settled x402 response; transaction details are kept server-side.",
            now,
            false
          )
        );
        paymentEvents.push(
          paymentEvent(
            realResource,
            "agent_output_returned",
            "Agent output returned",
            "Contract Scanner returned output after real x402 settlement.",
            now,
            false
          )
        );
        continue;
      }

      paymentEvents.push(
        paymentEvent(
          realResource,
          realPayment.state === "real_x402_unavailable" ? "real_x402_unavailable" : "real_x402_failed",
          realPayment.state === "real_x402_unavailable" ? "Real x402 unavailable" : "Real x402 failed",
          realPayment.failureCategory
            ? `Real x402 did not produce settled output; sanitized category: ${realPayment.failureCategory}.`
            : "Real x402 did not produce settled output.",
          now,
          false
        )
      );
      paymentEvents.push(
        paymentEvent(
          resource,
          "simulated_payment_used",
          "Simulated fallback used",
          "Contract Scanner fell back to the existing simulated/dev paid-agent path after real x402 was unavailable.",
          now,
          true
        )
      );
    } else {
      paymentEvents.push(
        paymentEvent(
          resource,
          "payment_required",
          "Payment required",
          "x402-style development challenge created before specialist output is returned.",
          now
        )
      );
    }

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
        now,
        true
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
        now,
        true
      )
    );
  }

  return {
    flow,
    runs,
    paymentEvents
  };
}
