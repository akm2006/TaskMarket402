# Venice AI Research Notes

## Role In TaskMarket402

Venice AI plans the mission, verifies specialist outputs, and synthesizes the final Wallet / Token Risk Report.

## Adapter Shape To Validate

- `planMission(input)`
- `verifyAgentOutput(input)`
- `synthesizeFinalReport(input)`

## Concepts To Verify Before Coding

- Current OpenAI-compatible base URL.
- Recommended model names.
- Authentication headers.
- Structured output support.
- Rate limits and failure modes.

## Current Status

Placeholder only. Research current docs before implementing.

## Implementation Research Rule

- Status: not implemented yet.
- Source of truth: official Venice AI docs, Context7 if available, and installed package/source types for any selected client.
- Verify before implementation: OpenAI-compatible base URL, auth headers, current model names, structured output support, rate limits, and fallback behavior.
- Role in TaskMarket402: mission planning, specialist-output verification, and final report synthesis.
- Known uncertainties: recommended models, structured output guarantees, and exact error/rate-limit behavior.
