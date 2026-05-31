import { NextResponse } from "next/server";
import {
  createPaymentResponseHeader,
  createX402PaymentRequired,
  verifyDevPaymentProof
} from "../../../../lib/adapters/payment/x402-server";
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

async function readBody(request: Request): Promise<PaidAgentRequestBody> {
  try {
    const body = (await request.json()) as PaidAgentRequestBody;

    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export async function POST(request: Request, context: PaidAgentRouteContext) {
  const params = await context.params;
  const agentKindSlug =
    typeof params === "object" && params !== null && "agentKind" in params
      ? String(params.agentKind)
      : "";
  const agentKind = specialistAgentKindFromSlug(agentKindSlug);

  if (!agentKind) {
    return NextResponse.json({ error: "Specialist agent not found." }, { status: 404 });
  }

  const body = await readBody(request);
  const mission =
    typeof body.targetAddress === "string" && body.targetAddress.length > 0
      ? {
          ...phaseOneDemoSnapshot.mission,
          targetAddress: body.targetAddress
        }
      : phaseOneDemoSnapshot.mission;
  const snapshot = {
    ...phaseOneDemoSnapshot,
    mission
  };
  const resource = createPaidAgentResource(snapshot, agentKind, request.url);
  const verification = verifyDevPaymentProof(request.headers, resource, process.env);

  if (!verification.ok) {
    return createX402PaymentRequired(resource, {
      env: process.env,
      reason: verification.reason
    });
  }

  const specialistRun = await runPaidAgentAfterAcceptedPayment(mission, agentKind, {
    env: process.env
  });

  return NextResponse.json(
    {
      source: "paid_agent_endpoint",
      phase: "phase-4-dev",
      simulatedSettlement: true,
      agentKind,
      payment: {
        state: verification.state,
        mode: "dev",
        settlement: "simulated",
        paymentId: verification.paymentId,
        resourceId: resource.resourceId,
        amount: resource.price,
        currency: resource.task.budget.currency
      },
      events: [
        {
          type: "dev_payment_accepted",
          resourceId: resource.resourceId,
          simulatedSettlement: true
        },
        {
          type: "agent_output_returned",
          resourceId: resource.resourceId,
          simulatedSettlement: true
        }
      ],
      specialistRun
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "PAYMENT-RESPONSE": createPaymentResponseHeader(resource, verification, process.env)
      }
    }
  );
}
