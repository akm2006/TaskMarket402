import { NextResponse } from "next/server";
import { phaseOneDemoSnapshot } from "@/lib/core/phase-one-demo";
import { runDemoMissionAiRuntime } from "@/lib/runtime/mission-ai-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MissionAiRunRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_request: Request, context: MissionAiRunRouteContext) {
  const { id } = await context.params;

  if (id !== phaseOneDemoSnapshot.mission.id) {
    return NextResponse.json({ error: "Mission not found." }, { status: 404 });
  }

  const result = await runDemoMissionAiRuntime({
    env: process.env
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
