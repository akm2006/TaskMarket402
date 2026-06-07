import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createAgentRouteConfig,
  createAgentX402ResourceServer,
  createPaymentResponseHeader,
  createX402PaymentRequired,
  resolveAgentSellerConfig,
  verifyDevPaymentProof,
  x402AgentMode
} from "../../../../lib/adapters/payment/x402-server";
import type { SpecialistAgentKind } from "../../../../lib/agents/types";
import { phaseOneDemoSnapshot } from "../../../../lib/core/phase-one-demo";
import {
  createPaidAgentResource,
  runPaidAgentAfterAcceptedPayment,
  specialistAgentKindFromSlug
} from "../../../../lib/runtime/paid-agent-flow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PaidAgentRouteContext = {
  params: Promise<unknown>;
};

interface PaidAgentRequestBody {
  targetAddress?: string;
}

type PaidAgentRouteMode = "phase-4-dev" | "phase-8-real-x402-all-agents";

async function readBody(request: Request): Promise<PaidAgentRequestBody> {
  try {
    const body = (await request.json()) as PaidAgentRequestBody;

    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

function missionFromBody(body: PaidAgentRequestBody) {
  return typeof body.targetAddress === "string" && body.targetAddress.length > 0
    ? {
        ...phaseOneDemoSnapshot.mission,
        targetAddress: body.targetAddress
      }
    : phaseOneDemoSnapshot.mission;
}

async function handlePaidAgentRequest(
  request: Request,
  agentKind: SpecialistAgentKind,
  mode: PaidAgentRouteMode,
  bodyOverride?: PaidAgentRequestBody,
  realPrice?: string
) {
  const body = bodyOverride ?? (await readBody(request));
  const mission = missionFromBody(body);
  const snapshot = {
    ...phaseOneDemoSnapshot,
    mission
  };
  const resource = createPaidAgentResource(snapshot, agentKind, request.url);
  const simulatedSettlement = mode === "phase-4-dev";
  const verification = simulatedSettlement
    ? verifyDevPaymentProof(request.headers, resource, process.env)
    : undefined;

  if (verification && !verification.ok) {
    return createX402PaymentRequired(resource, {
      env: process.env,
      reason: verification.reason
    });
  }

  const specialistRun = await runPaidAgentAfterAcceptedPayment(mission, agentKind, {
    env: process.env
  });
  const headers: Record<string, string> = {
    "Cache-Control": "no-store"
  };
  const normalizedRealPrice = realPrice?.startsWith(".") ? `0${realPrice}` : realPrice;
  const paymentAmount =
    !simulatedSettlement && normalizedRealPrice
      ? normalizedRealPrice.charCodeAt(0) === 36
        ? normalizedRealPrice.slice(1)
        : normalizedRealPrice
      : resource.price;

  if (verification?.ok) {
    headers["PAYMENT-RESPONSE"] = createPaymentResponseHeader(resource, verification, process.env);
  }

  return NextResponse.json(
    {
      source: "paid_agent_endpoint",
      phase: mode,
      simulatedSettlement,
      agentKind,
      payment: {
        state: simulatedSettlement ? verification?.state : "real_x402_paid",
        mode: simulatedSettlement ? "dev" : "live",
        settlement: simulatedSettlement ? "simulated" : "settled",
        paymentId: verification?.ok ? verification.paymentId : undefined,
        resourceId: resource.resourceId,
        amount: paymentAmount,
        currency: resource.task.budget.currency
      },
      events: [
        {
          type: simulatedSettlement ? "dev_payment_accepted" : "real_x402_paid",
          resourceId: resource.resourceId,
          simulatedSettlement
        },
        {
          type: "agent_output_returned",
          resourceId: resource.resourceId,
          simulatedSettlement
        }
      ],
      specialistRun
    },
    {
      headers
    }
  );
}

async function handleRealX402AgentRequest(request: Request, agentKind: SpecialistAgentKind) {
  const configResult = resolveAgentSellerConfig(agentKind, process.env);

  if (!configResult.ok) {
    return NextResponse.json(
      {
        source: "paid_agent_endpoint",
        phase: "phase-8-real-x402-all-agents",
        agentKind,
        simulatedSettlement: false,
        payment: {
          state: "real_x402_unavailable",
          settlement: "unavailable",
          missing: configResult.missing,
          invalid: configResult.invalid
        }
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const body = await readBody(request.clone());
  const { withX402 } = await import("@x402/next");
  const protectedHandler = withX402(
    async (protectedRequest: NextRequest) =>
      (await handlePaidAgentRequest(
        protectedRequest,
        agentKind,
        "phase-8-real-x402-all-agents",
        body,
        configResult.config.price
      )) as NextResponse,
    createAgentRouteConfig(configResult.config),
    createAgentX402ResourceServer(configResult.config)
  );

  return protectedHandler(request as NextRequest);
}

export async function POST(request: Request, context: PaidAgentRouteContext) {
  const params = await context.params;
  const agentKindSlug =
    typeof params === "object" && params !== null && "agentKind" in params ? String(params.agentKind) : "";
  const agentKind = specialistAgentKindFromSlug(agentKindSlug);

  if (!agentKind) {
    return NextResponse.json({ error: "Specialist agent not found." }, { status: 404 });
  }

  if (x402AgentMode(agentKind, process.env) === "real") {
    return handleRealX402AgentRequest(request, agentKind);
  }

  return handlePaidAgentRequest(request, agentKind, "phase-4-dev");
}
