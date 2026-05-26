# Hackathon Requirements

## Sponsor-Critical Path

The project must eventually prove this path:

MetaMask permission -> redelegation -> x402 payment -> 1Shot relay/status -> specialist output -> Venice verification -> WorkGraph update.

## Required Concepts

- MetaMask Smart Accounts / Advanced Permissions provide scoped user authority.
- ERC-7715 represents permission requests.
- ERC-7710 represents delegated execution or redelegation using permission.
- EIP-7702 is relevant to making externally owned accounts behave more like smart accounts.
- x402 provides paid HTTP resources for specialist agents.
- 1Shot relays or tracks at least one delegated payment path.
- Venice AI plans, verifies outputs, and synthesizes the final report.
- Base Sepolia is the recommended testnet; Base mainnet is the likely final demo chain unless current docs prove another option is better.

## Must Be Real In Final Demo

- One user-approved mission budget.
- One Manager Agent split into sub-budgets.
- One x402 payment.
- One 1Shot relay/status path.
- Venice planning, verification, and synthesis.
- WorkGraph updates for each major step.

## Can Be Simplified

- Only one mission type is needed.
- Only one specialist path needs the full sponsor-critical implementation first.
- Other specialist outputs can start as structured mocks, then move to real public data.
- Supabase can remain schema-ready until persistence is necessary.

## Must Not Drift Into

- Generic API marketplace.
- Generic wallet connector.
- Trading bot.
- Unbounded AI agent executor.
- Chat-only AI assistant.
