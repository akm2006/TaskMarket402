import type { AgentTask } from "../../core/types";
import {
  createDevPaymentSignature,
  X402_PAYMENT_SIGNATURE_HEADER,
  type X402ProtectedResource
} from "./x402-server";

export interface X402PaymentChallenge {
  resourceUrl: string;
  resourceId?: string;
  amount: string;
  currency: string;
  network: string;
}

export interface X402PaymentResult {
  paymentId: string;
  status: "prepared" | "submitted" | "settled" | "failed";
  mode: "dev";
  simulatedSettlement: true;
}

export interface X402DevPaymentProof {
  header: typeof X402_PAYMENT_SIGNATURE_HEADER;
  value: string;
  mode: "dev";
  simulatedSettlement: true;
}

export function prepareDevX402PaymentProof(
  resource: X402ProtectedResource,
  env: Record<string, string | undefined> = process.env
): X402DevPaymentProof {
  return {
    header: X402_PAYMENT_SIGNATURE_HEADER,
    value: createDevPaymentSignature(resource, env),
    mode: "dev",
    simulatedSettlement: true
  };
}

export async function payX402Challenge(
  task: AgentTask,
  challenge: X402PaymentChallenge
): Promise<X402PaymentResult> {
  return {
    paymentId: `dev_${(challenge.resourceId ?? `${task.missionId}:${task.id}`).replace(/[^a-zA-Z0-9]/g, "_")}`,
    status: "prepared",
    mode: "dev",
    simulatedSettlement: true
  };
}
