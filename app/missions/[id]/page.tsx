import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CircleDollarSign } from "lucide-react";
import { phaseOneDemoSnapshot } from "@/lib/core/phase-one-demo";
import { WorkGraphCanvas } from "@/components/workgraph/WorkGraphCanvas";
import { AiRuntimePanel } from "@/components/mission/AiRuntimePanel";

type MissionDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MissionDetailPage({ params }: MissionDetailPageProps) {
  const { id } = await params;
  const snapshot = phaseOneDemoSnapshot;

  if (id !== snapshot.mission.id) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100" data-testid="mission-detail-page">
      <section className="border-b border-zinc-800 px-5 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link className="text-sm font-semibold text-cyan-300 hover:text-cyan-200" href="/">
              Back to landing
            </Link>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">{snapshot.mission.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              Target {snapshot.mission.targetAddress}. The WorkGraph now includes the Phase 7 MetaMask permission proof
              layer, while keeping delegated x402 execution out of scope. Contract Scanner can use the live-proven Base
              Sepolia x402 path, Wallet Behavior and Market Context stay on simulated/dev payment, and AI states are
              labeled by provider and mode.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Mission Budget</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-50">
              {snapshot.mission.budgetPolicy.totalBudget.amount} {snapshot.mission.budgetPolicy.totalBudget.currency}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Max {snapshot.mission.budgetPolicy.maxPerAgent.amount} USDC per agent
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Audit Graph</p>
              <h2 className="mt-1 text-2xl font-semibold">Every budget and payment state in one graph</h2>
            </div>
              <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Wallet permission, payment, specialist output, verification, report synthesis, and blocked spend stay
              visible as audit events. The UI distinguishes real x402 from simulated payment instead of blending them
              together.
            </p>
          </div>
          <WorkGraphCanvas graph={snapshot.workGraph} />
        </div>
      </section>

      <section className="px-5 pb-12">
        <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <AiRuntimePanel missionId={snapshot.mission.id} />

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="text-cyan-300" size={18} />
                <h2 className="text-xl font-semibold">Manager Agent Plan</h2>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {snapshot.managerPlan.map((task) => (
                  <article key={task.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {task.agentKind.replace("_", " ")}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-200">{task.objective}</p>
                    <p className="mt-3 text-sm font-semibold text-cyan-300">
                      {task.budget.amount} {task.budget.currency}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
              <h2 className="text-xl font-semibold">Baseline Specialist Outputs</h2>
              <div className="mt-5 grid gap-4">
                {snapshot.specialistOutputs.map((output) => (
                  <article key={output.taskId} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{output.taskId}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-200">{output.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {output.riskSignals.map((signal) => (
                        <span
                          key={signal}
                          className="rounded border border-amber-300/30 bg-amber-950/60 px-2 py-1 text-xs text-amber-100"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-lg border border-red-400/40 bg-red-950/40 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-red-200">Blocked Payment</p>
              <p className="mt-3 text-sm leading-6 text-red-50">{snapshot.blockedPaymentReason}</p>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
              <h2 className="text-xl font-semibold">Event Log</h2>
              <ol className="mt-5 space-y-4" data-testid="event-log">
                {snapshot.events.map((event) => (
                  <li key={event.id} className="border-l border-zinc-700 pl-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-100">{event.title}</p>
                      <time className="text-xs text-zinc-500">{event.occurredAt}</time>
                    </div>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-cyan-300">{event.actor}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{event.detail}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Final Report Placeholder</p>
              <h2 className="mt-2 text-xl font-semibold">{snapshot.finalReport.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{snapshot.finalReport.summary}</p>
              <div className="mt-5 space-y-4">
                {snapshot.finalReport.sections.map((section) => (
                  <div key={section.heading}>
                    <h3 className="text-sm font-semibold text-zinc-100">{section.heading}</h3>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">{section.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <Link
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
              href="/missions/new"
            >
              Create Another Mock Mission
              <ArrowRight size={16} />
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
