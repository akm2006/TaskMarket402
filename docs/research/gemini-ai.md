# Gemini AI Research Notes

## Role In TaskMarket402

Gemini is a development/testing AI provider only. It exists so TaskMarket402 can keep validating AI planning, verification, and report synthesis flows while Venice live inference is blocked by credits/billing. Gemini must never be presented as Venice output and is not the official sponsor AI path for the final demo.

## Sources Checked

- Google Gen AI TypeScript/JavaScript SDK docs through Context7: `/websites/googleapis_github_io_js-genai`
- Google Gemini structured output docs: `https://ai.google.dev/gemini-api/docs/structured-output`
- Google Gemini quickstart docs: `https://ai.google.dev/gemini-api/docs/quickstart`
- Google Gemini API key docs: `https://ai.google.dev/gemini-api/docs/api-key`

## Current API Shape

- Server-side env var: `GEMINI_API_KEY`.
- Optional model env var: `GEMINI_MODEL`.
- Development default model: `gemini-2.5-flash`.
- REST endpoint used by the development adapter:
  - `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Auth:
  - `x-goog-api-key: <GEMINI_API_KEY>`
- Request core:
  - `contents`
  - `generationConfig.temperature`
  - `generationConfig.responseMimeType = "application/json"`
  - `generationConfig.responseSchema`
- Response core:
  - read `candidates[0].content.parts[*].text`
  - parse JSON
  - validate with shared TaskMarket402 Zod schemas before mapping to internal result types.

## Structured JSON Strategy

Google docs support structured output with JSON/schema configuration and state that SDKs can use Zod/JSON Schema. The adapter uses REST with explicit JSON schemas plus Zod validation. Gemini output is accepted only after the same internal schemas used by Venice pass.

Implementation note: the live REST smoke path works with `generationConfig.responseMimeType` and `generationConfig.responseSchema`. The newer documented `responseFormat.text.mimeType/schema` shape returned a sanitized HTTP 400 `INVALID_ARGUMENT` against the tested `v1beta` REST endpoint, so the adapter currently keeps the accepted `responseMimeType/responseSchema` shape.

## Prompt Architecture

Gemini uses the same provider-neutral TaskMarket402 task prompt payloads as Venice. The prompts say "You are the AI reasoning layer for TaskMarket402," request JSON-only output, restrict planning to allowed specialist agents, require `maxPerAgent` compliance, and prohibit changing payment policy.

Gemini's development/testing status is tracked outside the task prompt through result metadata: `provider: "gemini"`, `providerRole: "development_testing"`, and successful live Gemini calls use `mode: "dev"`. The model prompt must not tell Gemini to act as a separate testing persona or compare itself to Venice.

## Provider Rules

- `AI_PROVIDER=venice`: official sponsor path.
- `AI_PROVIDER=gemini`: development/testing provider.
- `AI_PROVIDER=mock`: deterministic local fallback provider.
- Missing `AI_PROVIDER` defaults to `venice`.
- Missing `GEMINI_API_KEY` returns explicit fallback state and does not call Gemini.
- Gemini plans are validated through core budget policy. Gemini cannot override mission budget or payment policy.

## Security Notes

- Keep `GEMINI_API_KEY` in `.env.local` or deployment secret storage only.
- Do not use `NEXT_PUBLIC_GEMINI_API_KEY`.
- Do not print prompts, raw model responses, headers, full request bodies, or API keys in smoke output.

## Failure Modes

- Missing API key: `skipped_missing_api_key`.
- Empty generated content: `empty_response`.
- Malformed JSON or schema mismatch: `invalid_response`.
- Provider/network/auth/rate/model errors: `request_failed` with sanitized diagnostics.
- Plan exceeds mission policy: `policy_rejected` and deterministic core fallback.

## Current Status

Provider layer prepared for development/testing. Gemini remains separate from Venice and must be labeled honestly in any future UI/runtime surface.

## Live Smoke Result - 2026-05-31

- `.env.local` had `GEMINI_API_KEY` configured; no key value was printed.
- `pnpm smoke:gemini` completed live planning, verification, and report synthesis with `gemini-2.5-flash` during implementation.
- A later full verification run returned sanitized `429 RESOURCE_EXHAUSTED` rate-limit diagnostics for all three calls. The smoke script now treats explicit provider/rate/network fallback states as diagnosed provider conditions instead of code failures.
- Smoke output printed only provider, model, configured-key boolean, result states, counts, and sanitized failure fields.
- Gemini output is development/testing only and must not be shown as Venice output.

## Implementation Research Rule

- Status: development/testing provider implemented behind provider-neutral interface.
- Source of truth: official Google Gemini docs, Context7 Google Gen AI SDK docs, and local adapter tests.
- Verify before runtime wiring: live `pnpm smoke:gemini`, server-only key handling, structured-output schema compatibility, and fallback behavior.
- Role in TaskMarket402: development/test continuity only while Venice credits are unavailable.
- Known uncertainties: account-specific Gemini quota/rate limits, future REST structured-output field changes, and whether `gemini-2.5-flash` remains the best low-cost dev default.
