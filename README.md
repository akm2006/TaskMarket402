# TaskMarket402

TaskMarket402 turns one MetaMask permission into an auditable mission budget for autonomous agent teams.

## Problem

Autonomous agents can plan work, call APIs, and generate reports, but user-controlled payment and auditability are still weak. Normal wallet UX asks users to approve every action, while generic agent marketplaces do not show how authority, budget, payments, and outputs connect.

## Solution

TaskMarket402 is a Mission Budget WorkGraph. A user creates a mission, grants one scoped MetaMask mission budget, a Manager Agent splits that budget into sub-budgets, specialist agents are paid through x402, at least one ERC-7710/x402 payment is relayed through 1Shot, Venice AI plans/verifies/synthesizes, and the WorkGraph shows every permission, payment, output, and result.

The locked MVP mission is a Wallet / Token Risk Report.

## Current Roadmap

The current source-of-truth roadmap is [`docs/PRODUCT_COMPLETION_PLAN.md`](docs/PRODUCT_COMPLETION_PLAN.md). TaskMarket402 is now aimed at a working product-grade testnet app, not a mostly mocked demo.

Current direction:

- The user connects MetaMask and grants scoped mission permission/delegation.
- Contract Scanner, Wallet Behavior, and Market Context must all use real x402 on testnet before final submission unless a documented blocker is found.
- Contract Scanner is already the first live-proven x402 path.
- 1Shot / ERC-7710 must be proven for at least one delegated mission-budget action.
- AI remains provider-switchable through `AI_PROVIDER=venice | gemini | mock`; Venice is preferred for final sponsor/demo mode, while Gemini is valid for development/fallback.
- Landing page, README polish, and deployment docs come late, after the real flow exists.

## Demo Flow

1. User creates a wallet/token risk mission with a 3 USDC mission budget.
2. User approves one scoped MetaMask permission.
3. Manager Agent plans subtasks through the selected provider-neutral AI provider.
4. Manager allocates sub-budgets to Contract Scanner, Wallet Behavior, and Market Context agents.
5. All three specialist agents expose real x402-protected paid resources on testnet.
6. One delegated mission-budget action proves the MetaMask / ERC-7710 / 1Shot path.
7. The selected AI provider verifies outputs and synthesizes the final risk report; public demo copy should say Venice-powered only when `AI_PROVIDER=venice` and live Venice smoke passes.
8. WorkGraph shows the budget trail, payment trail, output trail, and one blocked payment case.

## Sponsor Tech Mapping

- MetaMask Smart Accounts / Advanced Permissions: root mission-budget authority and scoped permission request flow.
- ERC-7715: permission request concept for asking the wallet for bounded authority.
- ERC-7710: delegated execution/redelegation concept for spending within scoped authority.
- EIP-7702: account-delegation foundation relevant to smart-account-style execution.
- x402: HTTP payment protocol for paid specialist-agent resources.
- 1Shot: relayer/status layer for at least one ERC-7710/x402 payment path.
- Venice AI: planning, verification, and final report synthesis through an OpenAI-compatible adapter.
- Base Sepolia / Base mainnet: recommended test/demo chain path unless current docs prove another chain is better.

## Architecture Overview

Core logic is chain-agnostic:

- `lib/core/mission.ts`
- `lib/core/policy.ts`
- `lib/core/workgraph.ts`
- `lib/core/agent-orchestrator.ts`
- `lib/core/types.ts`

Sponsor and data integrations live behind adapters:

- `lib/adapters/ai/venice.ts`
- `lib/adapters/wallet/metamask-permissions.ts`
- `lib/adapters/permission/erc7710-redelegation.ts`
- `lib/adapters/payment/x402-client.ts`
- `lib/adapters/payment/x402-server.ts`
- `lib/adapters/relayer/oneshot.ts`
- `lib/adapters/data/base-rpc.ts`
- `lib/adapters/data/etherscan.ts`
- `lib/adapters/data/dexscreener.ts`

Specialist agents live in `lib/agents/`.

## Setup

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
```

## Environment

Copy `.env.example` to `.env.local` and fill values only when implementing the relevant integration. Do not commit secrets.

## Build Phases

The current phase order lives in [`docs/PRODUCT_COMPLETION_PLAN.md`](docs/PRODUCT_COMPLETION_PLAN.md). Older phase docs and build-log entries remain historical context.

Near-term roadmap:

1. MetaMask wallet + scoped mission permission proof.
2. Real x402 for all specialist agents.
3. 1Shot / ERC-7710 delegated Contract Scanner golden path.
4. Connect delegated permission authority to paid-agent execution.
5. Minimal persistence / mission audit storage.
6. Venice live finalization and provider-switch demo polish.
7. End-to-end mission runner.
8. Landing / README / deployment.
9. Final hardening.

## Agent Workflow Docs

- `docs/07_AGENT_WORKFLOW.md`: normal Codex/Claude workflow.
- `docs/08_RESEARCH_PROTOCOL.md`: research-gated implementation flow.
- `docs/09_MCP_AND_TOOLS.md`: MCP and CLI tool guidance.
- `docs/10_GRAPHIFY_WORKFLOW.md`: Graphify workflow.
- `docs/11_REPOMIX_WORKFLOW.md`: Repomix handoff workflow.

## Current Status

Phase 6 hybrid demo hardening is complete. Contract Scanner has a live-proven real x402 path on Base Sepolia; Wallet Behavior and Market Context still need to be upgraded to real x402 for the planned final product. MetaMask, ERC-7710, 1Shot, Supabase persistence, wallet UI, and delegated mission-budget execution are not implemented yet. Venice exists as a provider adapter but live inference still requires a funded/usable Venice account before making Venice-powered demo claims.
