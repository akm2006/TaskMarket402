import type { AgentTask } from "../../core/types";

export interface X402ProtectedResource {
  task: AgentTask;
  price: string;
  resourceUrl: string;
}

export function createX402PaymentRequired(_resource: X402ProtectedResource): Response {
  // TODO: Research current docs before implementing.
  throw new Error("x402 server adapter is not implemented.");
}
