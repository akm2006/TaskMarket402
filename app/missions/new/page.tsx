import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { phaseOneDemoSnapshot } from "@/lib/core/phase-one-demo";
import { MetaMaskPermissionPanel } from "@/components/mission/MetaMaskPermissionPanel";

const formFields = [
  { label: "Mission type", value: "Wallet / Token Risk Report" },
  { label: "Target address", value: phaseOneDemoSnapshot.mission.targetAddress },
  { label: "Mission budget", value: "3.00 USDC" },
  { label: "Max per-agent spend", value: "0.50 USDC" },
  { label: "Duration", value: "60 minutes" }
];

export default function CreateMissionPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-zinc-100" data-testid="create-mission-page">
      <div className="mx-auto grid max-w-6xl gap-6">
        <section>
          <Link className="text-sm font-semibold text-cyan-300 hover:text-cyan-200" href="/">
            Back to WorkGraph
          </Link>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight">Create a mission budget</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Phase 7 adds the first user-authorized layer: connect MetaMask, verify Base Sepolia readiness, and request a
            scoped mission-budget permission receipt. This still does not execute payments, 1Shot relay, or delegated
            x402.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <div className="mt-8 grid gap-4" data-testid="create-mission-form">
              {formFields.map((field) => (
                <label key={field.label} className="grid gap-2">
                  <span className="text-sm font-medium text-zinc-300">{field.label}</span>
                  <input
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none"
                    readOnly
                    value={field.value}
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200"
                href={`/missions/${phaseOneDemoSnapshot.mission.id}`}
              >
                <ShieldCheck size={16} />
                Open Mission WorkGraph
                <ArrowRight size={16} />
              </Link>
            </div>
          </section>

          <aside className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Policy Preview</p>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-zinc-500">Budget control</dt>
                <dd className="mt-1 text-zinc-100">Manager Agent cannot allocate above the mission or per-agent caps.</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Payment proof</dt>
                <dd className="mt-1 text-zinc-100">
                  Contract Scanner x402 behavior is unchanged. This page only requests the MetaMask permission receipt.
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Failure case</dt>
                <dd className="mt-1 text-zinc-100">The demo includes a blocked 0.80 USDC payment attempt.</dd>
              </div>
            </dl>
          </aside>
        </div>

        <MetaMaskPermissionPanel policy={phaseOneDemoSnapshot.mission.budgetPolicy} />
      </div>
    </main>
  );
}
