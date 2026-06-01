# TaskMarket402 Product Completion Plan

Date: 2026-06-01

## Executive Summary

TaskMarket402 is past a small mock MVP. The current repo already proves several hard pieces: a mission WorkGraph UI, provider-neutral AI runtime, real-data specialist agents, simulated x402-style paid-agent behavior, and one live-proven real x402 Contract Scanner payment on Base Sepolia. The remaining work is not to explain how mocks connect later; it is to replace the remaining simulated sponsor boundaries with a product-grade testnet path where a user creates a mission, grants scoped wallet authority, autonomous agents execute paid work within that mission budget, AI verifies and synthesizes the result, and the WorkGraph records permission, payment, execution, verification, and report events.

The recommended final architecture is a single Base Sepolia golden path first, then breadth. The user connects MetaMask, grants a scoped ERC-7715/MetaMask Advanced Permission for a mission USDC budget to a mission session/delegate account, the Manager Agent creates tasks under core policy, all three specialist agents are paid through real x402 on testnet, and at least the Contract Scanner payment path is executed through real x402 plus 1Shot/MetaMask delegation evidence. Contract Scanner remains the first live-proven x402 path. Wallet Behavior and Market Context must be upgraded from simulated/dev payment to real x402 before final submission unless a documented blocker is found.

The AI layer must stay provider-neutral and switchable through `AI_PROVIDER=venice | gemini | mock`. Venice is the preferred final sponsor/demo provider, Gemini is the active development and fallback provider, and neither Gemini nor mock output may be presented as Venice. Public/demo copy may say "Venice-powered" only when `AI_PROVIDER=venice` and a live Venice smoke passes. Supabase is not needed to prove one local smoke run, but it is recommended for a hackathon-grade product because the WorkGraph audit trail needs durable mission, permission, payment, relay, AI, and report records.

## Research Sources Checked

- Local repo: `AGENTS.md`, `README.md`, `docs/BUILD_LOG.md`, `docs/research/*`, `graphify-out/GRAPH_REPORT.md`, `.env.example`, `package.json`, `lib/core/*`, `lib/runtime/*`, `lib/adapters/*`, `app/api/*`, `components/mission/*`, and tests.
- Hackathon page: https://www.hackquest.io/hackathons/MetaMask-Smart-Accounts-Kit-x-1Shot-API-x-Venice-AI-Dev-Cook-Off
- MetaMask Smart Accounts supported networks: https://docs.metamask.io/smart-accounts-kit/get-started/supported-networks/
- MetaMask Advanced Permissions guide: https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/execute-on-metamask-users-behalf/
- MetaMask delegation guide: https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/
- MetaMask x402 buyer delegation guide: https://docs.metamask.io/smart-accounts-kit/guides/x402/buyer/delegations/
- MetaMask redelegation guide: https://docs.metamask.io/smart-accounts-kit/guides/advanced-permissions/create-redelegation/
- x402 buyer, seller, facilitator, and network docs: https://docs.x402.org/
- 1Shot API docs and x402/EIP-7702 examples: https://docs.1shotapi.com/api/api.html and https://docs.1shotapi.com/api/examples/x402.html
- Venice getting started and billing balance docs: https://docs.venice.ai/overview/getting-started and https://docs.venice.ai/api-reference/endpoint/billing/balance
- Supabase SSR docs via Context7 `/supabase/ssr`.

Research caveat: sponsor APIs are fast-moving. Before implementing each phase below, re-check the exact current package names, endpoint shapes, supported networks, and installed package types.

## 1. Current Product State

### Real and Working

- Phase 1 mission UI, mission detail page, create mission page, WorkGraph audit UI, event log, blocked payment case, and final report placeholder exist.
- Provider-neutral AI layer exists with `planMission()`, `verifyAgentOutput()`, and `synthesizeFinalReport()`.
- Gemini works as a development AI provider and is tracked separately from Venice.
- Venice adapter exists and uses an OpenAI-compatible strategy, but live inference is blocked by the current account's credits/billing state.
- Contract Scanner, Wallet Behavior, and Market Context specialist agents return typed real-data or fallback outputs.
- x402-style simulated paid-agent flow exists.
- Real x402 Contract Scanner path exists, uses installed `@x402/*` packages, and live smoke passed on Base Sepolia with `real_x402_paid`, HTTP 200, settlement indicator, and transaction indicator.
- WorkGraph and mission UI honestly distinguish real x402 Contract Scanner from simulated/dev payment agents.
- Static, unit, e2e, build, AI smoke, Venice diagnostic, and x402 smoke scripts exist.

### Simulated

- Wallet Behavior and Market Context payment flows are simulated/dev payment only.
- Mission budget permission is not real yet; the budget exists as typed policy/UI state.
- Manager Agent planning can be AI-generated, but the permission/payment authority is not yet driven by the user wallet.
- Current x402 buyer key is a server-side test key, not a user-granted delegated mission budget.
- 1Shot relay/status is represented only as a future WorkGraph branch and placeholder adapter.

### UI/Static Only

- Landing and create mission pages communicate the concept but do not yet drive a real wallet/delegation/persistence flow.
- MetaMask, ERC-7710, 1Shot, and Supabase files are placeholders.
- WorkGraph includes relay/permission concepts before those systems are implemented.
- README now points to this roadmap; broader landing, README, and deployment polish still belongs near demo hardening.

### Missing From Product Promise

- Connect wallet flow.
- MetaMask smart account / Advanced Permissions mission-budget grant.
- ERC-7710/delegation receipt and redemption path.
- 1Shot execution/relay/status proof.
- User-funded or user-delegated x402 payment authority.
- Real x402 for Wallet Behavior and Market Context so all three specialist agents are x402-paid on testnet.
- Persistent mission, WorkGraph, payment, relay, AI, and report records.
- Live Venice inference with available credits.
- Deployed testnet app with safe server secrets.
- Final demo script and README matching the real implemented path.

## 2. Target Full App Flow

The target is a single, complete Base Sepolia testnet product flow.

1. Landing page
   - Shows TaskMarket402 as a Mission Budget WorkGraph, not a marketplace.
   - Shows proof badges only for implemented systems: MetaMask permission, x402 payment, 1Shot relay, Venice verification, Base Sepolia.
   - Links directly into "Create mission."

2. Connect wallet
   - User connects MetaMask.
   - App confirms supported network, preferably Base Sepolia if all sponsor APIs support it in practice.
   - UI shows wallet address, chain, USDC test balance, and readiness checks.

3. Create mission
   - User enters target wallet/token/contract address.
   - User selects mission budget, max per agent, expiry, and allowed payment protocol.
   - Core policy validates the budget before any wallet request.

4. Grant permission/delegation
   - App creates or selects a mission delegate/session account.
   - App requests a scoped MetaMask Advanced Permission/ERC-7715 permission for limited USDC spending on the mission chain.
   - User approves in MetaMask.
   - App stores a client-safe permission receipt and server-side redacted metadata.

5. Mission budget setup
   - Core records `MissionBudgetPolicy`, permission receipt, remaining budget, expiry, and spending caps.
   - WorkGraph adds permission and mission-budget nodes.
   - No sponsor adapter can expand this policy.

6. Manager Agent planning
   - Venice live provider plans tasks when funded.
   - Gemini remains a development/fallback provider with explicit provenance.
   - Plan is validated against allowed agents and `maxPerAgent`.
   - WorkGraph records manager plan, task budgets, and blocked over-budget attempts.

7. Specialist agent execution
   - Contract Scanner, Wallet Behavior, and Market Context run as paid resources.
   - Each agent has server-side real-data logic and typed fallback outputs.
   - Agent outputs are mapped to the shared `AgentOutput` schema.

8. x402 payments
   - Contract Scanner remains the first live-proven x402 path.
   - Final target: Contract Scanner, Wallet Behavior, and Market Context all use real x402 on testnet.
   - Simulated/dev payment for Wallet Behavior and Market Context is acceptable only during development, not as the planned final state.
   - If a blocker prevents real x402 for all agents, the app must show blocked/unavailable states honestly and narrow final claims.
   - Payment proof, signatures, headers, and raw facilitator responses stay server-only.
   - WorkGraph records payment required, paid, output returned, and failure/fallback states.

9. 1Shot / delegated execution involvement
   - At least one mission-budget spend or payment-enabling action goes through 1Shot.
   - Recommended path: use MetaMask permission/delegation as source authority, construct a constrained delegated execution for a Contract Scanner payment or mission-budget transfer, submit/relay through 1Shot, poll status, and record transaction hash/status in WorkGraph.
   - If direct x402 header settlement cannot be natively relayed by 1Shot, use 1Shot for the delegated funding/spend step that makes the x402 buyer action possible, and label it precisely.

10. AI verification
    - The selected provider verifies each agent output and synthesizes the final report through the same provider-neutral AI contract.
    - Venice is preferred for final sponsor/demo mode.
    - Gemini is the active development provider and valid fallback provider.
    - If Venice remains `credits_billing`, final demo must not claim Venice live verification.
    - UI can show Gemini or mock fallback only with honest provider provenance.

11. Final report
    - Generated from specialist outputs only.
    - Preserves uncertainty and evidence.
    - Includes payment/permission provenance, but AI must not invent payment facts.

12. WorkGraph audit trail
    - Shows wallet permission, mission budget, manager plan, task budgets, x402 payment events, 1Shot relay/status, agent outputs, AI verification, report, and blocked/failure cases.
    - Each node/event states whether it is live, simulated, fallback, or pending.

## 3. Sponsor Alignment

| Sponsor / Tech | Final visible use | Priority | Risk / fallback |
| --- | --- | --- | --- |
| MetaMask Smart Accounts Kit / Delegation Toolkit | Wallet connection, permission request, mission budget authority, delegation receipt | Must-have | Risk: API/package changes and wallet UX friction. Fallback: documented demo with supported chain spike, but final product claim needs a real approval. |
| ERC-7715 / Advanced Permissions | User grants scoped spend/permission to a delegate/session account | Must-have | Risk: chain/token permission support details. Fallback: use the currently supported testnet/token path verified by docs and smoke. |
| ERC-7710 / delegation redemption | Delegated execution/redelegation for at least one mission-budget action | Must-have | Risk: exact redemption package/API shape. Fallback: narrow to one Contract Scanner spend path, not all agents. |
| 1Shot API | Relays or executes one delegated payment/funding action and provides status proof | Must-have | Risk: public docs/API shape and network support. Fallback: if direct x402 relay is impossible, use 1Shot for a real delegated funding/spend transaction and label precisely. |
| x402 | Real testnet payment for Contract Scanner, Wallet Behavior, and Market Context specialist resources | Must-have | Contract Scanner is already live-proven. Wallet Behavior and Market Context must be upgraded before final submission unless a documented blocker forces a narrowed claim. |
| Venice AI | Preferred live planning, verification, and report synthesis provider | Must-have for Venice sponsor claim | Current blocker is credits/billing. Gemini can keep development moving and remain a valid fallback, but public copy can say Venice-powered only when `AI_PROVIDER=venice` and live smoke passes. |
| Base Sepolia | Shared testnet for wallet authority, x402 USDC, agent data, and relay proof | Should-have / likely target | MetaMask and x402 docs support Base Sepolia. 1Shot Base Sepolia behavior must be verified before hard-locking. |
| Supabase | Durable mission/WorkGraph/audit persistence | Should-have | Can remain local/in-memory for one local smoke, but product-grade deployed app benefits strongly from Supabase. |
| Gemini | Active development and fallback AI provider behind the same provider-neutral contract | Nice-to-have | Must never be presented as Venice or used to make Venice sponsor claims. |

## 4. Architecture Gap Analysis

### Wallet Layer

Current: no wallet UI or wallet state. Placeholder adapter exists.

Target: `lib/adapters/wallet/metamask-permissions.ts` owns MetaMask/permission calls; UI components show wallet/network/readiness; server never receives user private keys.

Gap: add wagmi/viem wallet client setup, chain validation, USDC balance display, and permission request flow.

### Permission / Delegation Layer

Current: `erc7710-redelegation.ts` throws.

Target: model permission receipt, delegation, redelegation, redemption, expiry, spending cap, and WorkGraph events.

Gap: add core types for mission authority and sponsor adapter DTOs without importing MetaMask SDKs into core.

### Payment Layer

Current: Contract Scanner has real x402 via server buyer key; other agents use dev payment proof.

Target: x402 buyer authority is tied to the user-approved mission budget or a scoped delegated/session account. Contract Scanner, Wallet Behavior, and Market Context all use real x402 on testnet before final submission unless a documented blocker forces an honest narrowed claim.

Gap: replace server-buyer-only authority with delegated mission buyer path, add real x402 for Wallet Behavior and Market Context, and keep any fallback or blocked state clearly labeled.

### Agent Runtime Layer

Current: server runtime can run real-data agents and payment flow, but mission runs are mostly ephemeral and demo-oriented.

Target: mission runner persists each step, supports retry/resume, records sanitized errors, and does not let AI or sponsor adapters override core policy.

Gap: add mission-run state machine and persistence hooks.

### AI Layer

Current: provider-neutral layer exists; Gemini works; Venice blocked by billing.

Target: provider-neutral plan/verify/report for all providers. Venice is the preferred final provider; Gemini is the active development and fallback provider; mock is deterministic fallback. Core app code must not depend on Venice-specific behavior.

Gap: add funded Venice smoke before demo, record provider provenance per mission step, and persist AI result provenance.

### Persistence Layer

Current: no real persistence despite Supabase dependency/env placeholders.

Target: Supabase tables for missions, permission receipts, agent tasks, agent outputs, payment events, relay events, AI runs, final reports, and WorkGraph events.

Gap: add schema/migrations/server clients/RLS or a tightly scoped demo auth model.

### UI/UX Layer

Current: WorkGraph is strong for hybrid Phase 6; README now points to this roadmap, while landing/deployment polish still belongs near the final product pass.

Target: wallet-first mission flow, live run status, persisted audit trail, clear badges, deployment-safe demo.

Gap: add connect/grant/run states and near-final landing after sponsor paths work.

## 5. Core Technical Decision Points

### Should the user wallet directly fund x402 payments?

Recommended: the user wallet should fund or authorize the mission budget, but should not sign every specialist payment interactively. The product promise is one scoped mission permission, then autonomous execution.

Alternative: direct user wallet pays each x402 request. This is simpler but weakens the mission-budget/autonomous-agent premise.

### Should the app use a delegated smart account/session account?

Recommended: yes. Use MetaMask Advanced Permissions/ERC-7715 to grant a scoped USDC permission to a mission delegate/session account. That account becomes the bounded execution authority for mission spend.

Alternative: server buyer private key. This is acceptable only as a development smoke/fallback and should not be the final user-authorized product path.

### Where does 1Shot fit exactly?

Recommended: use 1Shot for one real delegated execution related to the Contract Scanner payment path. The WorkGraph should show request, relay id, status, and transaction hash.

Fallback if direct x402 settlement is not relay-compatible: use 1Shot for a real ERC-7710 delegated USDC transfer or funding step into the mission buyer/session account, then run x402 from that account. The UI must label that precisely as "1Shot delegated funding/spend for x402 path," not "1Shot settled x402" unless true.

### Does x402 payment happen through delegated authority or a server-side buyer account?

Recommended final: through delegated mission authority for the golden path. The current server-side buyer should remain a smoke-test/dev fallback until replaced or supplemented by a scoped delegated signer.

### What is the safest testnet architecture that still proves the promise?

Recommended: Base Sepolia end to end if 1Shot confirms support in implementation. MetaMask docs list Base Sepolia support, x402 docs support Base Sepolia with USDC, and current live x402 smoke already passes there.

Fallback: use a split-chain proof only if forced by 1Shot or MetaMask limitations, but this weakens the demo. If split-chain is required, WorkGraph must explicitly show which chain each proof occurred on.

### What should be persisted?

Persist missions, wallet address, chain id, mission budget policy, permission/delegation receipts, manager plan, agent task allocations, payment events, relay events, agent outputs, AI results, final reports, WorkGraph nodes/events, and sanitized diagnostics.

Do not persist private keys, raw payment headers, payment signatures, raw facilitator responses, prompt bodies containing secrets, or service keys.

### What can remain ephemeral for hackathon submission?

Ephemeral is acceptable for temporary readiness checks, local smoke scripts, draft planning state before mission submission, and non-critical browser UI state.

### What must not be mocked in the final version?

Do not mock the MetaMask permission approval, real x402 settlement for any specialist agent claimed as paid, the 1Shot relay/status proof, the final Venice live verification claim, or the WorkGraph events tied to those proofs.

### AI Provider Strategy

Keep the app provider-switchable through `AI_PROVIDER=venice | gemini | mock`.

- Venice is the preferred final sponsor/demo provider.
- Gemini is the active development provider and a valid fallback provider.
- Venice and Gemini must use the same provider-neutral AI contract for planning, verification, and final report synthesis.
- Core app code must not depend on Venice-specific behavior.
- Do not present Gemini or mock output as Venice.
- Public/demo copy may say "Venice-powered" only when `AI_PROVIDER=venice` and live Venice smoke passes.
- Every AI result persisted or shown in the UI should include `provider`, `providerRole`, `model`, `mode`, `status`, and `timestamp`.

## 6. Required Env / Config Plan

### Safe in `.env.example`

- `NEXT_PUBLIC_CHAIN_ID=84532`
- `NEXT_PUBLIC_CHAIN_NAME=Base Sepolia`
- `NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org`
- `BASE_RPC_URL=https://sepolia.base.org`
- `BASE_EXPLORER_URL=https://sepolia.basescan.org`
- `USDC_CONTRACT_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- `AI_PROVIDER=venice | gemini | mock`
- `VENICE_BASE_URL=https://api.venice.ai/api/v1`
- `VENICE_MODEL=<current funded Venice model>`
- `GEMINI_MODEL=gemini-2.5-flash`
- `X402_SETTLEMENT_NETWORK=eip155:84532`
- `X402_FACILITATOR_URL=https://x402.org/facilitator`
- `X402_CONTRACT_SCANNER_PRICE_USD=0.001`
- `X402_WALLET_BEHAVIOR_PRICE_USD=<future value>`
- `X402_MARKET_CONTEXT_PRICE_USD=<future value>`
- `X402_CONTRACT_SCANNER_URL=http://localhost:3000/api/agents/contract-scanner`
- `X402_LIVE_SMOKE=false`
- `METAMASK_DELEGATION_ENV=<documented environment value>`
- `ONESHOT_BASE_URL=<official API URL>`
- `NEXT_PUBLIC_SUPABASE_URL=<project url>`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`

### Local / Deployment Secret Only

- `VENICE_API_KEY`
- `GEMINI_API_KEY`
- `X402_BUYER_PRIVATE_KEY` while server-buyer fallback exists
- Future mission session/delegate private key material if server-side execution is used; prefer generated, scoped, encrypted, and testnet-only
- `X402_PAY_TO_ADDRESS` if the receiving address should not be public before demo
- `ONESHOT_API_KEY`
- `ONESHOT_PROJECT_ID` if private
- `SUPABASE_SERVICE_ROLE_KEY`
- Any wallet private key, mnemonic, payment signature, bearer token, or facilitator credential

### Future Optional

- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` if WalletConnect is added beyond MetaMask injected provider.
- `BASESCAN_API_KEY` / `ETHERSCAN_API_KEY` for richer explorer data.
- `DEXSCREENER_BASE_URL` only if overriding default public endpoint.
- Deployment URLs for production x402 resources.
- Observability/logging keys if needed.

## 7. Implementation Roadmap

### Phase 7 - Wallet and MetaMask Permission Spike

- Goal: prove wallet connection and scoped mission-budget permission on the target chain.
- Scope: MetaMask connect, chain readiness, mission budget policy preview, ERC-7715/Advanced Permission request, permission receipt DTO.
- Files likely to change: `lib/adapters/wallet/metamask-permissions.ts`, `lib/adapters/permission/*`, `lib/core/types.ts`, `app/missions/new/page.tsx`, `components/mission/*`, tests, `.env.example`, `docs/research/metamask-smart-accounts.md`.
- Becomes real: wallet connection and at least one scoped permission approval/receipt if docs and test wallet allow it.
- Still mocked/simulated: 1Shot, delegated x402 authority, non-Contract Scanner x402.
- Test plan: unit tests for policy-to-permission mapping and unsafe policy rejection; e2e wallet UI without requiring live wallet; opt-in manual wallet smoke.
- Smoke test: `pnpm smoke:metamask-permission` or manual checklist with no secret printing.
- Risk: high.
- Difficulty: high.
- External dependencies: MetaMask extension/account, Base Sepolia test USDC/ETH, current MetaMask package/API support.
- Rollback/fallback: keep existing no-wallet demo and mark permission unavailable.

### Phase 8 - Real x402 for All Specialist Agents

- Goal: upgrade Wallet Behavior and Market Context from simulated/dev payment to real x402 on testnet.
- Scope: add x402 route config, buyer calls, prices, payment events, smoke support, WorkGraph labels, and blocked/unavailable states for all specialist agents.
- Files likely to change: `app/api/agents/[agentKind]/route.ts`, `lib/adapters/payment/*`, `lib/runtime/paid-agent-flow.ts`, `lib/agents/*`, tests, `.env.example`, `docs/research/x402.md`.
- Becomes real: Contract Scanner, Wallet Behavior, and Market Context are all x402-paid specialist resources on testnet when env/funding are configured.
- Still mocked/simulated: development fallback only; not the planned final state.
- Test plan: mocked facilitator tests for each agent; route tests for no-payment/paid/failure states; runtime all-real/all-fallback coverage.
- Smoke test: opt-in live x402 smoke for each agent or one combined mission smoke, printing only sanitized payment state/status.
- Risk: medium-high.
- Difficulty: medium.
- External dependencies: USDC test funds, facilitator reliability, reachable agent URLs.
- Rollback/fallback: show blocked/unavailable states and narrow final claims; do not present simulated Wallet Behavior or Market Context payments as planned final behavior.

### Phase 9 - ERC-7710 / 1Shot Contract Scanner Golden Path

- Goal: replace the Contract Scanner server-buyer-only proof with a user-authorized delegated execution proof and 1Shot relay/status event.
- Scope: create mission delegate/session signer, map permission to delegation/redelegation, submit one delegated action through 1Shot, poll status, connect result to Contract Scanner x402 path.
- Files likely to change: `lib/adapters/permission/erc7710-redelegation.ts`, `lib/adapters/relayer/oneshot.ts`, `lib/adapters/payment/x402-client.ts`, `lib/runtime/paid-agent-flow.ts`, `lib/core/types.ts`, `app/api/*`, `components/mission/*`, tests, `docs/research/oneshot.md`, `docs/research/x402.md`.
- Becomes real: one MetaMask permission -> delegated action -> 1Shot status -> Contract Scanner paid output chain of evidence.
- Still mocked/simulated: no specialist payment should remain simulated if Phase 8 succeeds; emergency fallback states stay explicit.
- Test plan: unit tests for delegation DTO validation, sanitized 1Shot errors, relay status mapping, runtime fallback.
- Smoke test: opt-in `pnpm smoke:oneshot` with redacted relay id/status/tx hash only.
- Risk: very high.
- Difficulty: high.
- External dependencies: 1Shot API key/account, supported chain, test funds, current MetaMask delegation APIs.
- Rollback/fallback: show Contract Scanner real x402 plus MetaMask permission proof, with 1Shot unavailable clearly marked. Do not claim 1Shot if this fails.

### Phase 10 - Connect Delegated Permission Authority to Paid-Agent Execution

- Goal: stop treating the server-side x402 buyer key as the product authority and connect paid-agent execution to the user's scoped mission permission/delegation.
- Scope: derive or configure a mission delegate/session execution path, enforce mission budget before every x402 buyer action, debit/track budget after paid runs, and record authority provenance.
- Files likely to change: `lib/core/types.ts`, `lib/core/policy.ts`, `lib/adapters/permission/*`, `lib/adapters/payment/*`, `lib/runtime/*`, `app/api/missions/*`, tests.
- Becomes real: paid-agent execution is tied to user-authorized mission budget authority instead of only a server-side test buyer key.
- Still mocked/simulated: persistence may still be minimal until Phase 11; emergency server-buyer fallback can remain clearly labeled.
- Test plan: unit tests for budget enforcement, authority provenance, max-per-agent rejection, expired permission rejection, and safe fallback.
- Smoke test: opt-in delegated mission run smoke with redacted authority/payment states.
- Risk: very high.
- Difficulty: high.
- External dependencies: MetaMask permission success, delegation support, testnet funds, x402 reliability.
- Rollback/fallback: keep server-buyer x402 only as a dev/emergency fallback and do not claim user-authorized budget execution.

### Phase 11 - Minimal Persistence / Mission Audit Storage

- Goal: make missions and WorkGraph audit trail durable enough for a deployed hackathon product.
- Scope: schema/migrations, server-only persistence adapter, mission create/read/update APIs, event append path, local fallback if Supabase env missing.
- Files likely to change: `lib/adapters/persistence/*`, `lib/runtime/*`, `app/api/missions/*`, `app/missions/*`, `docs/research/supabase.md`, tests.
- Becomes real: stored mission records, permission/delegation metadata, payment events, relay events, AI provenance, agent outputs, and final reports.
- Still mocked/simulated: only sponsor paths that are explicitly blocked/unavailable.
- Test plan: unit tests with mocked Supabase client; route tests for no-env fallback; e2e reload persistence if local Supabase is configured.
- Smoke test: create mission, reload mission detail, confirm WorkGraph events persist.
- Risk: medium.
- Difficulty: medium.
- External dependencies: Supabase project for deployed demo.
- Rollback/fallback: in-memory/local ephemeral mode for demos, clearly labeled.

### Phase 12 - Venice Live Finalization and Provider-Switch Demo Polish

- Goal: make Venice the preferred live final AI provider while preserving provider-neutral Gemini/mock fallback.
- Scope: fund account, verify balance/`canConsume`, update default model if needed, strengthen provider provenance, polish provider-switch UI copy, and add final demo smoke.
- Files likely to change: `docs/research/venice-ai.md`, `docs/research/gemini-ai.md`, `scripts/smoke-venice.test.ts`, `lib/adapters/ai/venice.ts` only if docs/API require changes, UI copy/tests.
- Becomes real: Venice live planning, verification, and final synthesis when `AI_PROVIDER=venice` and smoke passes.
- Still mocked/simulated: Gemini/mock remain valid fallback providers with honest provenance.
- Test plan: existing unit tests plus smoke acceptance for live/fallback categories.
- Smoke test: `pnpm smoke:venice` must complete live steps before final Venice claims.
- Risk: medium.
- Difficulty: low-medium if credits are added.
- External dependencies: Venice API credits/allowance.
- Rollback/fallback: Gemini/mock are allowed for development and fallback, but final submission must not claim Venice live.

### Phase 13 - End-to-End Mission Runner

- Goal: one button produces a full persisted mission run.
- Scope: server action/API orchestration, run state machine, retries, idempotency, safe event persistence, UI progress states.
- Files likely to change: `lib/runtime/*`, `lib/core/*`, `app/api/missions/*`, `components/mission/*`, tests.
- Becomes real: create -> grant -> run agents -> pay -> relay -> verify -> report -> WorkGraph.
- Still mocked/simulated: only explicitly unavailable sponsor paths.
- Test plan: unit tests for state transitions and policy enforcement; e2e run with mocked sponsor adapters; opt-in live smoke for complete path.
- Smoke test: `pnpm smoke:mission-live` with redacted proof summary.
- Risk: high.
- Difficulty: high.
- External dependencies: all sponsor keys/funding.
- Rollback/fallback: resume from last persisted step; show failed/unavailable node.

### Phase 14 - Landing, README, and Deployment

- Goal: polish public-facing product only after the real workflow exists.
- Scope: landing page, README, demo script, screenshots, deployment config, smoke checklist, setup docs.
- Files likely to change: `app/page.tsx`, `README.md`, `docs/DEMO_SCRIPT.md`, `docs/BUILD_LOG.md`, screenshots if tracked, deployment docs.
- Becomes real: judge-ready entry point and instructions.
- Still mocked/simulated: only documented fallbacks.
- Test plan: e2e landing/create/mission run visibility; mobile checks; README command verification.
- Smoke test: deployed URL flow with funded testnet account.
- Risk: medium.
- Difficulty: medium.
- External dependencies: deployment secrets and testnet funds.
- Rollback/fallback: local-only demo with documented env setup.

### Phase 15 - Final Hardening and Submission

- Goal: reduce demo failure risk and lock claims.
- Scope: repeated live smokes, failure cases, no-secrets audit, final WorkGraph screenshots, final claim boundaries, sponsor badge accuracy.
- Files likely to change: docs and tests mostly.
- Becomes real: submission confidence.
- Still mocked/simulated: none that are claimed as real.
- Test plan: full command suite, live smokes, browser walkthrough.
- Smoke test: final local and deployed mission run.
- Risk: medium.
- Difficulty: medium.
- External dependencies: sponsor service reliability.
- Rollback/fallback: record backup demo video and sanitized proof logs.

## 8. Final Demo Definition

A judge should be able to:

1. Open the deployed app or local app.
2. See TaskMarket402 framed as a mission-budget WorkGraph.
3. Connect MetaMask on Base Sepolia or the verified target testnet.
4. Create a Wallet / Token Risk Report mission with a bounded USDC budget.
5. Approve one scoped MetaMask permission/delegation.
6. Start the mission run.
7. Watch Manager Agent planning and task budget splits.
8. See Contract Scanner, Wallet Behavior, and Market Context all accessed through real x402 on testnet.
9. See Contract Scanner remain the first live-proven x402 path, with all other agent payment states shown honestly.
10. See at least one 1Shot relay/status/transaction proof tied to an ERC-7710 delegated mission-budget action.
11. See AI verification and report synthesis through the selected provider.
12. See WorkGraph nodes/events for permission, budget, payment, relay, specialist output, AI verification, final report, and blocked over-budget payment.
13. Inspect a sanitized proof panel showing chain id, wallet address, permission id/hash, relay id/status, transaction hash, x402 payment state for each specialist agent, AI `provider`, `providerRole`, `model`, `mode`, `status`, `timestamp`, and persistence record id.

## 9. Honest Claim Boundaries

If the full plan succeeds, TaskMarket402 can honestly claim:

- It is a mission-budget WorkGraph for autonomous agent teams.
- A user grants scoped wallet authority through MetaMask/permission tooling.
- Agent work is budgeted by core policy before sponsor execution.
- Preferred final claim: Contract Scanner, Wallet Behavior, and Market Context are all x402-paid on testnet.
- Contract Scanner is the first live-proven x402 path; "only Contract Scanner real x402" is a temporary fallback or emergency narrowed claim, not the planned final product.
- At least one delegated mission-budget action uses 1Shot if Phase 9 is completed and live-proven.
- Venice plans/verifies/synthesizes only if `AI_PROVIDER=venice` and live Venice smoke succeeds with credits.
- Gemini or mock results are valid fallback/development results only when labeled with provider provenance.
- The WorkGraph records permission, payment, relay, output, verification, report, and blocked-payment events.

Do not claim:

- Wallet Behavior or Market Context use real x402 while they are still simulated/dev.
- Simulated/dev payment is the intended final payment state for Wallet Behavior or Market Context.
- Venice live inference while the account is `credits_billing` blocked.
- 1Shot involvement without a real relay/status/transaction proof.
- User-authorized mission-budget spend while using only the server-side x402 buyer key.
- Gemini or mock output is Venice output.
- MetaMask/ERC-7710 delegation while only static UI or placeholder adapters exist.
- Production security for key custody unless delegated/session key handling is reviewed and hardened.

## Critical Risks

- MetaMask Advanced Permissions and delegation APIs may require a narrower flow than the product wants. Keep Phase 7 small.
- Wallet Behavior and Market Context may expose edge cases that the Contract Scanner x402 path did not hit. Treat all-agent real x402 as a required final target, and use blocked/unavailable states only if a documented blocker remains.
- 1Shot may not support the exact direct x402 settlement shape. Plan for a real delegated funding/spend action that supports the x402 path if necessary.
- Server-held session/delegate keys are sensitive even when scoped. Use testnet-only keys, least authority, expiry, optional encryption, and no persistence unless required.
- Venice credits are a hard blocker for final Venice claims.
- Facilitator, RPC, and testnet faucet reliability can break live demos. Use retries, explicit fallback states, and recorded backup proof.
- Supabase persistence adds scope, but without persistence the WorkGraph audit trail is weaker for a product-grade app.
- README and landing page must be updated late so they do not overclaim during implementation.

## Must Not Fake

- Do not fake MetaMask approval screens or permission receipts.
- Do not fake ERC-7710/delegation redemption.
- Do not fake x402 settlement, transaction indicators, payment headers, or facilitator success.
- Do not keep simulated/dev payment for Wallet Behavior or Market Context as the planned final state.
- Do not fake 1Shot relay ids, statuses, or transaction hashes.
- Do not present Gemini or mock output as Venice.
- Do not present server-buyer x402 as user-delegated mission-budget spend unless delegation is actually wired.
- Do not hide fallback states behind success labels.
- Do not put secrets, signatures, raw headers, raw payment payloads, facilitator responses, or private keys into UI, docs, logs, commits, or Repomix bundles.

## Recommended Next Implementation Phase

Do Phase 7 next: wallet connection and MetaMask/Advanced Permissions mission-budget proof. This is the highest-risk dependency for the actual product promise. Do not start with landing polish, Supabase, or broad x402 expansion until the user-authorized mission-budget authority is proven.

## Recommended Next Prompt

Use `AGENTS.md`, `sponsor-docs-rag`, `research-gated-implementation`, `integration-spine-builder`, `runtime-verification`, `docs/research/metamask-smart-accounts.md`, and `graphify-out/GRAPH_REPORT.md`.

Build Phase 7 only: MetaMask wallet connection and scoped mission-budget permission proof.

Before editing:
- Re-read current MetaMask Smart Accounts Kit, Advanced Permissions, ERC-7715, ERC-7710, and supported-network docs.
- Inspect installed packages/types and confirm whether additional MetaMask packages are needed.
- Update `docs/research/metamask-smart-accounts.md` with exact package names, API shape, permission request fields, supported chain/token assumptions, env vars, failure modes, and uncertainties.
- Give a short file-level plan.

Scope:
- Add wallet connection/readiness UI for the create mission flow.
- Validate Base Sepolia or the verified target testnet.
- Add a server/client-safe mission budget permission request adapter boundary.
- Request one scoped mission budget permission/delegation using current MetaMask docs.
- Store only client-safe permission receipt metadata.
- Add WorkGraph/UI states for permission requested, permission granted, permission rejected, and permission unavailable.
- Keep x402 Contract Scanner behavior unchanged.
- Do not implement 1Shot yet.
- Do not implement ERC-7710 redemption beyond the minimum receipt/delegation shape needed for permission proof.
- Do not add Supabase unless needed for this phase.
- Do not expose private keys, signatures, raw wallet responses, or secrets.

Testing:
- Unit tests for policy-to-permission mapping and unsafe budget rejection.
- UI/e2e tests that render wallet readiness and permission states without requiring a live wallet.
- Optional manual or opt-in smoke for a real MetaMask permission approval with redacted output only.

Verification:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm verify`
- `pnpm build`
- `pnpm smoke:x402` with `X402_LIVE_SMOKE=true` to prove existing x402 path remains stable
- `pnpm smoke:venice`
- `pnpm smoke:gemini`
- `graphify update .`

Update `docs/BUILD_LOG.md`.

Final report:
- MetaMask docs/packages verified
- files changed
- permission API shape implemented
- wallet/readiness UI states
- tests/commands run
- remaining limitations
- confirm no 1Shot/Supabase/payment behavior changes were added
