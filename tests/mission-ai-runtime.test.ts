import { describe, expect, it } from "vitest";
import type {
  AiFinalReportResult,
  AiPlanResult,
  AiProviderCategory,
  AiProviderClient,
  AiVerificationResult
} from "../lib/adapters/ai/provider-types";
import type { AgentOutput, AgentTask, Mission } from "../lib/core/types";
import { phaseOneDemoSnapshot } from "../lib/core/phase-one-demo";
import { createStaticMockSpecialistRuns, runDemoMissionAiRuntime } from "../lib/runtime/mission-ai-runtime";
import type { SpecialistAgentRun } from "../lib/agents";
import type { PaidAgentFlowResult } from "../lib/runtime/paid-agent-flow";

const now = () => "2026-05-31T12:00:00.000Z";
const staticRuns = createStaticMockSpecialistRuns(phaseOneDemoSnapshot);

function taskFor(mission: Mission): AgentTask {
  return {
    id: `${mission.id}:contract-scanner`,
    missionId: mission.id,
    agentKind: "contract_scanner",
    objective: "Scan contract risk indicators.",
    budget: {
      amount: "0.40",
      currency: mission.budgetPolicy.totalBudget.currency,
      chainId: mission.budgetPolicy.totalBudget.chainId
    }
  };
}

function successfulProvider(): AiProviderClient {
  return {
    id: "gemini",
    role: "development_testing",
    async planMission(mission): Promise<AiPlanResult> {
      return {
        provider: "gemini",
        providerRole: "development_testing",
        mode: "dev",
        state: "completed",
        model: "mocked-gemini",
        tasks: [taskFor(mission)],
        rationale: "Mocked provider returned a bounded plan.",
        notes: []
      };
    },
    async verifyAgentOutput(output: AgentOutput): Promise<AiVerificationResult> {
      return {
        provider: "gemini",
        providerRole: "development_testing",
        mode: "dev",
        state: "completed",
        model: "mocked-gemini",
        verified: true,
        confidence: "medium",
        notes: [`Verified ${output.taskId}.`],
        riskSignals: output.riskSignals,
        requiresHumanReview: false
      };
    },
    async synthesizeFinalReport(): Promise<AiFinalReportResult> {
      return {
        provider: "gemini",
        providerRole: "development_testing",
        mode: "dev",
        state: "completed",
        model: "mocked-gemini",
        report: {
          title: "Wallet / Token Risk Report",
          status: "synthesized",
          summary: "Mocked provider synthesized a client-safe report.",
          riskLevel: "medium",
          sections: [{ heading: "Summary", body: "Bounded mock synthesis." }],
          recommendations: ["Keep core policy authoritative."],
          verificationSummary: "All mocked specialist outputs were verified."
        },
        notes: []
      };
    }
  };
}

function failingProvider(category: AiProviderCategory): AiProviderClient {
  const diagnostic = {
    statusCode: category === "credits_billing" ? 402 : 429,
    errorClass: "ProviderError",
    providerCategory: category
  };

  return {
    id: "venice",
    role: "official_sponsor",
    async planMission(mission): Promise<AiPlanResult> {
      return {
        provider: "venice",
        providerRole: "official_sponsor",
        mode: "fallback",
        state: "request_failed",
        model: "mocked-venice",
        tasks: [taskFor(mission)],
        rationale: "Deterministic fallback plan.",
        notes: ["Sanitized provider failure."],
        diagnostic
      };
    },
    async verifyAgentOutput(output): Promise<AiVerificationResult> {
      return {
        provider: "venice",
        providerRole: "official_sponsor",
        mode: "fallback",
        state: "request_failed",
        model: "mocked-venice",
        verified: false,
        confidence: "unknown",
        notes: ["Sanitized provider failure."],
        riskSignals: output.riskSignals,
        requiresHumanReview: true,
        diagnostic
      };
    },
    async synthesizeFinalReport(outputs): Promise<AiFinalReportResult> {
      return {
        provider: "venice",
        providerRole: "official_sponsor",
        mode: "fallback",
        state: "request_failed",
        model: "mocked-venice",
        report: {
          title: "Wallet / Token Risk Report",
          status: "fallback",
          summary: "Provider failed safely; fallback report preserved specialist summaries.",
          riskLevel: "unknown",
          sections: outputs.map((output) => ({ heading: output.taskId, body: output.summary })),
          recommendations: ["Resolve provider condition before live inference."],
          verificationSummary: "No provider synthesis was accepted."
        },
        notes: ["Sanitized provider failure."],
        diagnostic
      };
    }
  };
}

describe("mission AI runtime", () => {
  it("returns a client-safe missing-env fallback for Venice", async () => {
    const result = await runDemoMissionAiRuntime({
      env: { AI_PROVIDER: "venice" },
      specialistRuns: staticRuns,
      now
    });

    expect(result).toMatchObject({
      source: "ai_runtime",
      staticBaseline: "phase_one_mock_snapshot",
      specialistOutputSource: "phase_one_typed_mock_outputs",
      provider: "venice",
      mode: "fallback",
      state: "fallback"
    });
    expect(result.plan.status.failureCategory).toBe("configuration");
    expect(result.finalReport.report.status).toBe("fallback");
  });

  it("maps provider credits billing diagnostics into a credits_billing runtime state", async () => {
    const result = await runDemoMissionAiRuntime({
      provider: failingProvider("credits_billing"),
      specialistRuns: staticRuns,
      now
    });

    expect(result.state).toBe("credits_billing");
    expect(result.plan.status).toMatchObject({
      state: "credits_billing",
      failureCategory: "credits_billing"
    });
    expect(result.verification.status.state).toBe("credits_billing");
    expect(result.finalReport.status.state).toBe("credits_billing");
  });

  it("maps provider rate limits into a rate_limit runtime state", async () => {
    const result = await runDemoMissionAiRuntime({
      provider: failingProvider("rate_limit"),
      specialistRuns: staticRuns,
      now
    });

    expect(result.state).toBe("rate_limit");
    expect(result.plan.status.failureCategory).toBe("rate_limit");
    expect(result.finalReport.status.state).toBe("rate_limit");
  });

  it("returns a successful mocked provider runtime response without live API calls", async () => {
    const result = await runDemoMissionAiRuntime({
      provider: successfulProvider(),
      snapshot: phaseOneDemoSnapshot,
      specialistRuns: staticRuns,
      now
    });

    expect(result).toMatchObject({
      provider: "gemini",
      providerRole: "development_testing",
      mode: "dev",
      state: "completed"
    });
    expect(result.plan.tasks).toHaveLength(1);
    expect(result.verification.verifiedCount).toBe(phaseOneDemoSnapshot.specialistOutputs.length);
    expect(result.finalReport.report.status).toBe("synthesized");
  });

  it("keeps deterministic mock provider output completed with fallback mode", async () => {
    const result = await runDemoMissionAiRuntime({
      env: { AI_PROVIDER: "mock" },
      specialistRuns: staticRuns,
      now
    });

    expect(result).toMatchObject({
      provider: "mock",
      providerRole: "deterministic_mock",
      mode: "fallback",
      state: "completed"
    });
    expect(result.plan.taskCount).toBe(3);
  });

  it("keeps runtime working when all specialist agents fallback", async () => {
    const fallbackRuns: SpecialistAgentRun[] = phaseOneDemoSnapshot.specialistOutputs.map((output, index) => ({
      agentKind: index === 1 ? "wallet_behavior" : index === 2 ? "market_context" : "contract_scanner",
      source: "fallback",
      diagnostics: ["Injected fallback specialist output."],
      output: {
        ...output,
        evidence: ["Output source: fallback", "Injected fallback specialist output."],
        riskSignals: ["agent-fallback"]
      }
    }));

    const result = await runDemoMissionAiRuntime({
      provider: successfulProvider(),
      specialistRuns: fallbackRuns,
      now
    });

    expect(result.specialistOutputSource).toBe("agent_fallback_outputs");
    expect(result.specialistOutputs.every((output) => output.source === "fallback")).toBe(true);
    expect(result.state).toBe("completed");
    expect(result.verification.items).toHaveLength(3);
  });

  it("returns x402-style dev payment events from the paid-agent runtime path", async () => {
    const paidAgentRunner = async (): Promise<PaidAgentFlowResult> => ({
      flow: "x402_style_dev",
      runs: staticRuns,
      paymentEvents: [
        {
          id: "event-payment-required",
          type: "payment_required",
          agentKind: "contract_scanner",
          taskId: "risk-report-demo:contract-scanner",
          resourceId: "risk-report-demo:contract_scanner:risk-report-demo:contract-scanner",
          title: "Payment required",
          detail: "x402-style development challenge created before specialist output is returned.",
          amount: "0.40",
          currency: "USDC",
          occurredAt: now(),
          simulatedSettlement: true
        },
        {
          id: "event-dev-payment-accepted",
          type: "dev_payment_accepted",
          agentKind: "contract_scanner",
          taskId: "risk-report-demo:contract-scanner",
          resourceId: "risk-report-demo:contract_scanner:risk-report-demo:contract-scanner",
          title: "Development payment accepted",
          detail: "Development-only proof accepted; no real x402 settlement occurred.",
          amount: "0.40",
          currency: "USDC",
          occurredAt: now(),
          simulatedSettlement: true
        },
        {
          id: "event-agent-output-returned",
          type: "agent_output_returned",
          agentKind: "contract_scanner",
          taskId: "risk-report-demo:contract-scanner",
          resourceId: "risk-report-demo:contract_scanner:risk-report-demo:contract-scanner",
          title: "Agent output returned",
          detail: "Contract scanner returned output after simulated payment acceptance.",
          amount: "0.40",
          currency: "USDC",
          occurredAt: now(),
          simulatedSettlement: true
        }
      ]
    });

    const result = await runDemoMissionAiRuntime({
      provider: successfulProvider(),
      snapshot: phaseOneDemoSnapshot,
      paymentFlow: "x402_style_dev",
      paidAgentRunner,
      now
    });

    expect(result.paymentFlow).toBe("x402_style_dev");
    expect(result.paymentEvents.map((event) => event.type)).toEqual([
      "payment_required",
      "dev_payment_accepted",
      "agent_output_returned"
    ]);
    expect(result.paymentEvents.every((event) => event.simulatedSettlement)).toBe(true);
    expect(result.state).toBe("completed");
  });
});
