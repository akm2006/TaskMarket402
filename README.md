# TaskMarket402

TaskMarket402 turns one MetaMask permission into an auditable mission budget for autonomous agent teams.

## Problem

Autonomous agents can plan work, call APIs, and generate reports, but user-controlled payment and auditability are still weak. Normal wallet UX asks users to approve every action, while generic agent marketplaces do not show how authority, budget, payments, and outputs connect.

## Solution

TaskMarket402 is a Mission Budget WorkGraph. A user creates a mission, grants one scoped MetaMask mission budget, a Manager Agent splits that budget into sub-budgets, specialist agents are paid through x402, at least one ERC-7710/x402 payment is relayed through 1Shot, Venice AI plans/verifies/synthesizes, and the WorkGraph shows every permission, payment, output, and result.

The locked MVP mission is a Wallet / Token Risk Report.

## Demo Flow

1. User creates a wallet/token risk mission with a 3 USDC mission budget.
2. User approves one scoped MetaMask permission.
3. Manager Agent plans subtasks with Venice AI.
4. Manager allocates sub-budgets to Contract Scanner, Wallet Behavior, and Market Context agents.
5. Specialist agents expose x402-protected paid resources.
6. One golden path executes through MetaMask permission, redelegation, x402 payment, 1Shot relay/status, specialist output, Venice verification, and WorkGraph update.
7. Venice synthesizes the final risk report.
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

1. Repo foundation and docs.
2. Non-chain mission and WorkGraph MVP with mock states.
3. Venice adapter after current docs are researched.
4. Real-data specialist agents.
5. x402 challenge flow for Contract Scanner first.
6. MetaMask + 1Shot golden path.
7. Demo hardening and blocked payment case.

## Agent Workflow Docs

- `docs/07_AGENT_WORKFLOW.md`: normal Codex/Claude workflow.
- `docs/08_RESEARCH_PROTOCOL.md`: research-gated implementation flow.
- `docs/09_MCP_AND_TOOLS.md`: MCP and CLI tool guidance.
- `docs/10_GRAPHIFY_WORKFLOW.md`: Graphify workflow.
- `docs/11_REPOMIX_WORKFLOW.md`: Repomix handoff workflow.

## Current Status

This repo is in setup phase. Sponsor integrations are placeholders until researched and implemented. Do not claim MetaMask, x402, 1Shot, Venice, or Base integration works yet.
