import type { AgentOutput, Mission } from "../../core/types";
import { geminiDevProvider } from "./gemini";
import { mockAiProvider } from "./mock";
import type {
  AiFinalReportResult,
  AiPlanResult,
  AiProviderClient,
  AiProviderId,
  AiProviderOptions,
  AiVerificationResult
} from "./provider-types";
import {
  planMissionWithVenice,
  synthesizeFinalReportWithVenice,
  verifyAgentOutputWithVenice
} from "./venice";

function envProvider(value: string | undefined): AiProviderId {
  if (value === "gemini" || value === "mock" || value === "venice") {
    return value;
  }

  return "venice";
}

export function resolveAiProviderId(env: Record<string, string | undefined> = process.env): AiProviderId {
  return envProvider(env.AI_PROVIDER);
}

const veniceProvider: AiProviderClient = {
  id: "venice",
  role: "official_sponsor",
  async planMission(mission, options): Promise<AiPlanResult> {
    const result = await planMissionWithVenice(mission, options);

    return {
      provider: "venice",
      providerRole: "official_sponsor",
      ...result
    };
  },
  async verifyAgentOutput(output, options): Promise<AiVerificationResult> {
    const result = await verifyAgentOutputWithVenice(output, options);

    return {
      provider: "venice",
      providerRole: "official_sponsor",
      ...result
    };
  },
  async synthesizeFinalReport(outputs, options): Promise<AiFinalReportResult> {
    const result = await synthesizeFinalReportWithVenice(outputs, options);

    return {
      provider: "venice",
      providerRole: "official_sponsor",
      ...result
    };
  }
};

export function createAiProvider(options: AiProviderOptions = {}): AiProviderClient {
  const providerId = resolveAiProviderId(options.env);

  if (providerId === "gemini") {
    return geminiDevProvider;
  }

  if (providerId === "mock") {
    return mockAiProvider;
  }

  return veniceProvider;
}

export async function planMission(mission: Mission, options: AiProviderOptions = {}): Promise<AiPlanResult> {
  return createAiProvider(options).planMission(mission, options);
}

export async function verifyAgentOutput(
  output: AgentOutput,
  options: AiProviderOptions = {}
): Promise<AiVerificationResult> {
  return createAiProvider(options).verifyAgentOutput(output, options);
}

export async function synthesizeFinalReport(
  outputs: AgentOutput[],
  options: AiProviderOptions = {}
): Promise<AiFinalReportResult> {
  return createAiProvider(options).synthesizeFinalReport(outputs, options);
}

export type {
  AiFailureDiagnostic,
  AiFinalReportResult,
  AiPlanResult,
  AiProviderClient,
  AiProviderId,
  AiProviderMode,
  AiProviderOptions,
  AiProviderRole,
  AiVerificationResult
} from "./provider-types";
