# Architecture

## Core Boundary

`lib/core/` is chain-agnostic. It owns mission definitions, budget policy, WorkGraph state, and orchestration decisions. It must not import MetaMask, x402, 1Shot, Venice, or chain SDKs directly.

## Adapter Boundary

`lib/adapters/` is sponsor-specific and infrastructure-specific. Adapters execute core decisions and translate external APIs into typed internal results.

## Specialist Agent Boundary

`lib/agents/` contains domain-specific work. Agents receive typed mission context and return structured outputs that Venice can verify.

## Intended Structure

```text
lib/core/
  mission.ts
  policy.ts
  workgraph.ts
  agent-orchestrator.ts
  types.ts

lib/adapters/
  ai/venice.ts
  wallet/metamask-permissions.ts
  permission/erc7710-redelegation.ts
  payment/x402-client.ts
  payment/x402-server.ts
  relayer/oneshot.ts
  data/base-rpc.ts
  data/etherscan.ts
  data/dexscreener.ts

lib/agents/
  contract-scanner.ts
  wallet-behavior.ts
  market-context.ts
```

## Golden Path

1. User creates a mission with a mission budget.
2. MetaMask permission adapter requests scoped authority.
3. Manager Agent plans subtasks.
4. Policy module validates sub-budget allocations.
5. Contract Scanner Agent returns x402 payment required.
6. x402 client prepares payment state.
7. ERC-7710 redelegation adapter prepares delegated execution.
8. 1Shot adapter relays or tracks status.
9. Contract Scanner returns output.
10. Venice verifies the output.
11. WorkGraph records permission, budget, payment, relay, verification, output, and final report nodes.

## Persistence

Supabase is expected later for missions, WorkGraph events, payment states, agent outputs, and final reports. It is not required during this setup pass.
