import Link from "next/link";
import { ArrowRight, ClipboardList, ShieldCheck } from "lucide-react";
import { phaseOneDemoSnapshot } from "@/lib/core/phase-one-demo";
import { WorkGraphCanvas } from "@/components/workgraph/WorkGraphCanvas";

const proofPoints = [
  "One mission budget with a hard per-agent cap.",
  "Manager Agent splits budget into bounded specialist work.",
  "Mock x402, 1Shot, Venice, and blocked-payment nodes are visible without real integrations."
];

export default function Home() {
  const { mission, workGraph } = phaseOneDemoSnapshot;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100" data-testid="landing-page">
      <section className="border-b border-zinc-800 bg-zinc-950 px-5 py-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">TaskMarket402</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-50 sm:text-6xl">
              Mission Budget WorkGraph for autonomous agent teams.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
              Create one scoped wallet/token risk mission, let a Manager Agent split the budget, and inspect every
              planned payment, output, verification, and blocked spend in the WorkGraph.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
              href="/missions/new"
            >
              <ClipboardList size={16} />
              Create Mission
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-zinc-500"
              href={`/missions/${mission.id}`}
            >
              <ShieldCheck size={16} />
              View Demo
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Phase 1 Mock State</p>
              <h2 className="mt-1 text-2xl font-semibold text-zinc-50">WorkGraph is the primary surface</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              Sponsor integrations stay behind adapter placeholders. This page renders the non-chain MVP state only.
            </p>
          </div>
          <WorkGraphCanvas graph={workGraph} />
        </div>
      </section>

      <section className="px-5 pb-12">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {proofPoints.map((point) => (
            <div key={point} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="text-sm leading-6 text-zinc-300">{point}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
