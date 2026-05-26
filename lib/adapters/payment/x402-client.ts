import type { AgentTask } from "../../core/types";

export interface X402PaymentChallenge {
  resourceUrl: string;
  amount: string;
  currency: string;
  network: string;
}

export interface X402PaymentResult {
  paymentId: string;
  status: "prepared" | "submitted" | "settled" | "failed";
}

export async function payX402Challenge(
  _task: AgentTask,
  _challenge: X402PaymentChallenge
): Promise<X402PaymentResult> {
  // TODO: Research current docs before implementing.
  throw new Error("x402 client adapter is not implemented.");
}
