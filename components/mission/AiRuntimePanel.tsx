"use client";

import { useState } from "react";
import { Bot, CheckCircle2, CircleDollarSign, FileText, ListChecks, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import type {
  MissionAiPaymentEventDto,
  MissionAiRuntimeResponse,
  MissionAiRuntimeState,
  MissionAiRuntimeStatus,
  MissionAiRuntimeSpecialistOutputDto
} from "@/lib/runtime/mission-ai-runtime";

type AiRuntimePanelProps = {
  missionId: string;
};

type SpecialistKind = MissionAiRuntimeSpecialistOutputDto["agentKind"];
type BadgeTone = "real" | "simulated" | "success" | "fallback" | "neutral" | "danger" | "ai";

const specialistLabels: Record<SpecialistKind, string> = {
  contract_scanner: "Contract Scanner",
  wallet_behavior: "Wallet Behavior",
  market_context: "Market Context"
};

const stateLabels: Record<MissionAiRuntimeState, string> = {
  completed: "Completed",
  fallback: "Fallback",
  failed: "Failed",
  credits_billing: "Credits billing",
  rate_limit: "Rate limit"
};

const stateStyles: Record<MissionAiRuntimeState, string> = {
  completed: "border-emerald-300/50 bg-emerald-950/50 text-emerald-100",
  fallback: "border-amber-300/50 bg-amber-950/50 text-amber-100",
  failed: "border-red-300/60 bg-red-950/50 text-red-100",
  credits_billing: "border-orange-300/60 bg-orange-950/50 text-orange-100",
  rate_limit: "border-yellow-300/60 bg-yellow-950/50 text-yellow-100"
};

const paymentEventStyles: Record<MissionAiPaymentEventDto["type"], string> = {
  payment_required: "border-cyan-300/50 bg-cyan-950/50 text-cyan-100",
  dev_payment_accepted: "border-emerald-300/50 bg-emerald-950/50 text-emerald-100",
  real_x402_payment_required: "border-sky-300/50 bg-sky-950/50 text-sky-100",
  real_x402_paid: "border-emerald-300/60 bg-emerald-950/60 text-emerald-100",
  real_x402_failed: "border-red-300/60 bg-red-950/50 text-red-100",
  real_x402_unavailable: "border-amber-300/60 bg-amber-950/50 text-amber-100",
  simulated_payment_used: "border-violet-300/50 bg-violet-950/50 text-violet-100",
  agent_output_returned: "border-zinc-600 bg-zinc-900 text-zinc-200"
};

const paymentEventLabels: Record<MissionAiPaymentEventDto["type"], string> = {
  payment_required: "Payment required",
  dev_payment_accepted: "Dev payment accepted",
  real_x402_payment_required: "Real x402 required",
  real_x402_paid: "Real x402 paid",
  real_x402_failed: "Real x402 failed",
  real_x402_unavailable: "Real x402 unavailable",
  simulated_payment_used: "Simulated fallback",
  agent_output_returned: "Agent output returned"
};

const specialistOrder: SpecialistKind[] = ["contract_scanner", "wallet_behavior", "market_context"];

const badgeStyles: Record<BadgeTone, string> = {
  real: "border-emerald-300/60 bg-emerald-950/60 text-emerald-100",
  simulated: "border-violet-300/50 bg-violet-950/50 text-violet-100",
  success: "border-cyan-300/50 bg-cyan-950/50 text-cyan-100",
  fallback: "border-amber-300/60 bg-amber-950/50 text-amber-100",
  neutral: "border-zinc-700 bg-zinc-950 text-zinc-200",
  danger: "border-red-300/60 bg-red-950/50 text-red-100",
  ai: "border-teal-300/50 bg-teal-950/50 text-teal-100"
};

function providerLabel(status: Pick<MissionAiRuntimeStatus, "provider" | "mode">) {
  const provider = status.provider === "gemini" ? "Gemini" : status.provider === "venice" ? "Venice" : "Mock";
  const mode = status.mode === "dev" ? "dev" : status.mode;

  return `${provider} / ${mode}`;
}

function roleLabel(status: Pick<MissionAiRuntimeStatus, "providerRole">) {
  if (status.providerRole === "official_sponsor") {
    return "Official sponsor AI path";
  }

  if (status.providerRole === "development_testing") {
    return "Development AI provider";
  }

  return "Deterministic fallback provider";
}

function agentLabel(agentKind: SpecialistKind) {
  return specialistLabels[agentKind] ?? agentKind.replaceAll("_", " ");
}

function Badge({ children, tone = "neutral", testId }: { children: string; tone?: BadgeTone; testId?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${badgeStyles[tone]}`}
      data-testid={testId}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: MissionAiRuntimeStatus }) {
  return (
    <span className={`inline-flex items-center rounded border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${stateStyles[status.state]}`}>
      {stateLabels[status.state]}
    </span>
  );
}

function AiStateBadge({ status, testId }: { status: MissionAiRuntimeStatus; testId?: string }) {
  const badge = aiBadge(status);

  return (
    <Badge tone={badge.tone} testId={testId}>
      {badge.label}
    </Badge>
  );
}

function sourceLabel(source: MissionAiRuntimeSpecialistOutputDto["source"]) {
  if (source === "real-data") {
    return "real-data output";
  }

  if (source === "fallback") {
    return "fallback output";
  }

  return "mock output";
}

function sourceTone(source: MissionAiRuntimeSpecialistOutputDto["source"]): BadgeTone {
  if (source === "real-data") {
    return "real";
  }

  if (source === "fallback") {
    return "fallback";
  }

  return "neutral";
}

function eventsForAgent(events: MissionAiPaymentEventDto[], agentKind: SpecialistKind) {
  return events.filter((event) => event.agentKind === agentKind);
}

function paymentBadgeForAgent(events: MissionAiPaymentEventDto[], agentKind: SpecialistKind) {
  const agentEvents = eventsForAgent(events, agentKind);

  if (agentEvents.some((event) => event.type === "real_x402_paid" && !event.simulatedSettlement)) {
    return {
      label: "Real x402 paid agent",
      tone: "real" as const,
      detail: "Settlement completed before Contract Scanner output was returned."
    };
  }

  if (agentEvents.some((event) => event.type === "real_x402_failed" || event.type === "real_x402_unavailable")) {
    return {
      label: "Real x402 fallback",
      tone: "fallback" as const,
      detail: "Real x402 was attempted, then the runtime fell back visibly."
    };
  }

  return {
    label: "Simulated/dev paid agent",
    tone: "simulated" as const,
    detail: "Development-only payment proof; no real x402 settlement is claimed."
  };
}

function aiBadge(status: MissionAiRuntimeStatus) {
  if (status.state === "completed") {
    return { label: "AI verified", tone: "ai" as const };
  }

  if (status.state === "credits_billing" || status.state === "rate_limit" || status.state === "fallback") {
    return { label: "AI fallback", tone: "fallback" as const };
  }

  return { label: "AI failed safely", tone: "danger" as const };
}

function timelineSteps(result: MissionAiRuntimeResponse) {
  const eventTypes = new Set(result.paymentEvents.map((event) => event.type));
  const realPaid = eventTypes.has("real_x402_paid");
  const simulatedPaid = eventTypes.has("simulated_payment_used") || eventTypes.has("dev_payment_accepted");
  const verificationBadge = aiBadge(result.verification.status);
  const reportBadge = aiBadge(result.finalReport.status);

  return [
    {
      id: "payment_required",
      label: "payment_required",
      detail: eventTypes.has("real_x402_payment_required")
        ? "Contract Scanner real x402 challenge recorded."
        : "Paid-agent challenge recorded.",
      done: eventTypes.has("payment_required") || eventTypes.has("real_x402_payment_required"),
      tone: "neutral" as const
    },
    {
      id: realPaid ? "real_x402_paid" : "simulated_payment_used",
      label: realPaid ? "real_x402_paid" : "simulated_payment_used",
      detail: realPaid
        ? "Contract Scanner settled through real x402."
        : "Specialist agents used simulated/dev payment.",
      done: realPaid || simulatedPaid,
      tone: realPaid ? ("real" as const) : ("simulated" as const)
    },
    {
      id: "agent_output_returned",
      label: "agent_output_returned",
      detail: "Specialist outputs returned to the mission runtime.",
      done: eventTypes.has("agent_output_returned"),
      tone: "success" as const
    },
    {
      id: "ai_verified",
      label: "ai_verified",
      detail:
        result.verification.status.state === "completed"
          ? "Provider layer verified specialist outputs."
          : "Provider layer returned a safe fallback state.",
      done: result.verification.items.length > 0,
      tone: verificationBadge.tone
    },
    {
      id: "final_report_ready",
      label: "final_report_ready",
      detail:
        result.finalReport.report.status === "synthesized"
          ? "Final report synthesized from specialist outputs."
          : "Fallback report preserved available evidence.",
      done: Boolean(result.finalReport.report.summary),
      tone: reportBadge.tone
    }
  ];
}

function RuntimeStatusLine({ status }: { status: MissionAiRuntimeStatus }) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="ai-runtime-status">
      <span className="rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-200">
        {providerLabel(status)}
      </span>
      <span className="rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-200">
        {status.model}
      </span>
      <span className="rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-300">
        {roleLabel(status)}
      </span>
      <StatusBadge status={status} />
      {status.failureCategory ? (
        <span className="rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {status.failureCategory.replace("_", " ")}
        </span>
      ) : null}
    </div>
  );
}

export function AiRuntimePanel({ missionId }: AiRuntimePanelProps) {
  const [result, setResult] = useState<MissionAiRuntimeResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAiAnalysis() {
    setIsRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/missions/${missionId}/ai-run`, {
        method: "POST",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("AI runtime request failed.");
      }

      const json = (await response.json()) as MissionAiRuntimeResponse;
      setResult(json);
    } catch {
      setError("AI runtime failed safely before returning a client-safe result.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section className="rounded-lg border border-cyan-300/25 bg-cyan-950/20 p-5" data-testid="ai-runtime-panel">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">AI Runtime</p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Server-side provider run</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Static mock snapshot remains the baseline. This run uses the server AI provider layer for plan,
            verification, and report synthesis.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="run-ai-analysis"
          disabled={isRunning}
          onClick={runAiAnalysis}
          type="button"
        >
          {isRunning ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          {isRunning ? "Running" : "Run AI analysis"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded border border-red-300/40 bg-red-950/40 p-3 text-sm text-red-100" data-testid="ai-runtime-error">
          {error}
        </p>
      ) : null}

      {!result ? (
        <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4" data-testid="ai-runtime-empty">
          <p className="text-sm font-semibold text-zinc-100">Static mock snapshot</p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            No AI runtime result has been generated in this browser session.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4" data-testid="ai-runtime-result">
          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4" data-testid="paid-agent-flow">
            <div className="flex items-center gap-2">
              <CircleDollarSign size={17} className="text-cyan-300" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                Hybrid specialist paid-agent flow
              </h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Flow: {result.paymentFlow.replaceAll("_", " ")}. Contract Scanner is the only Phase 5 real x402 agent
              when the runtime returns a real payment event. Wallet Behavior and Market Context remain simulated/dev
              payment by design.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {specialistOrder.map((agentKind) => {
                const paymentBadge = paymentBadgeForAgent(result.paymentEvents, agentKind);
                const agentEvents = eventsForAgent(result.paymentEvents, agentKind);

                return (
                  <div
                    key={agentKind}
                    className="rounded border border-zinc-800 bg-zinc-900/60 p-3"
                    data-testid={`payment-agent-${agentKind}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{agentLabel(agentKind)}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                          {agentEvents[0]?.amount ?? "0.00"} USDC budgeted resource
                        </p>
                      </div>
                      <Badge
                        tone={paymentBadge.tone}
                        testId={`payment-badge-${agentKind}`}
                      >
                        {paymentBadge.label}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-5 text-zinc-400">{paymentBadge.detail}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {agentEvents.map((event) => (
                        <span
                          key={event.id}
                          className={`rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${paymentEventStyles[event.type]}`}
                          title={event.detail}
                        >
                          {paymentEventLabels[event.type]}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded border border-zinc-800 bg-zinc-950/80 p-3" data-testid="payment-audit-timeline">
              <div className="flex items-center gap-2">
                <ListChecks size={16} className="text-cyan-300" />
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
                  Compact payment audit timeline
                </h4>
              </div>
              <ol className="mt-3 grid gap-2 lg:grid-cols-5">
                {timelineSteps(result).map((step) => (
                  <li
                    key={step.id}
                    className="rounded border border-zinc-800 bg-zinc-900/60 p-3"
                    data-testid={`audit-step-${step.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={step.done ? step.tone : "neutral"}>{step.label}</Badge>
                      {step.done ? <CheckCircle2 size={15} className="shrink-0 text-emerald-300" /> : null}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-400">{step.detail}</p>
                  </li>
                ))}
              </ol>
            </div>
          </article>

          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4" data-testid="specialist-data-outputs">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">Specialist data outputs</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Source set: {result.specialistOutputSource.replaceAll("_", " ")}
            </p>
            <div className="mt-3 grid gap-2">
              {result.specialistOutputs.map((output) => (
                <div key={output.taskId} className="rounded border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{output.taskId}</p>
                    <Badge tone={sourceTone(output.source)} testId={`output-source-${output.agentKind}`}>
                      {sourceLabel(output.source)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{output.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {output.riskSignals.slice(0, 4).map((signal) => (
                      <span
                        key={signal}
                        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300"
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center gap-2">
              <Bot size={17} className="text-cyan-300" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">AI-generated plan</h3>
            </div>
            <div className="mt-3">
              <RuntimeStatusLine status={result.plan.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <AiStateBadge status={result.plan.status} testId="ai-plan-badge" />
              <Badge tone="neutral">Provider identity is metadata, not task prompt persona</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{result.plan.rationale}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {result.plan.tasks.map((task) => (
                <div key={task.id} className="rounded border border-zinc-800 bg-zinc-900/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {task.agentKind.replace("_", " ")}
                  </p>
                  <p className="mt-2 text-sm leading-5 text-zinc-200">{task.objective}</p>
                  <p className="mt-2 text-sm font-semibold text-cyan-300">
                    {task.budget.amount} {task.budget.currency}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="text-cyan-300" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">AI verification</h3>
            </div>
            <div className="mt-3">
              <RuntimeStatusLine status={result.verification.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <AiStateBadge status={result.verification.status} testId="ai-verification-badge" />
              <Badge tone="neutral">AI does not approve payment policy</Badge>
            </div>
            <div className="mt-3 grid gap-2">
              {result.verification.items.map((item) => (
                <div key={item.taskId} className="rounded border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.taskId}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-zinc-300">
                    Confidence {item.confidence}; {item.requiresHumanReview ? "human review required" : "no human review flag"}.
                  </p>
                  {item.notes[0] ? <p className="mt-2 text-sm leading-5 text-zinc-400">{item.notes[0]}</p> : null}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center gap-2">
              <FileText size={17} className="text-cyan-300" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">AI final report</h3>
            </div>
            <div className="mt-3">
              <RuntimeStatusLine status={result.finalReport.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <AiStateBadge status={result.finalReport.status} testId="ai-report-badge" />
              <Badge tone={result.finalReport.report.status === "synthesized" ? "success" : "fallback"}>
                {result.finalReport.report.status === "synthesized" ? "Final report ready" : "Fallback report ready"}
              </Badge>
            </div>
            <h4 className="mt-3 text-lg font-semibold text-zinc-50">{result.finalReport.report.title}</h4>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{result.finalReport.report.summary}</p>
            <p className="mt-2 text-sm font-semibold text-cyan-300">
              Risk level: {result.finalReport.report.riskLevel}
            </p>
          </article>
        </div>
      )}
    </section>
  );
}
