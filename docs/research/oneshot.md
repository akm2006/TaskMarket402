# 1Shot Research Notes

## Role In TaskMarket402

1Shot is the relayer/status layer for at least one ERC-7710/x402 payment path. Its status must be visible in the WorkGraph.

## Concepts To Verify Before Coding

- Current API base URL and authentication.
- JSON-RPC or REST method shape.
- Gas sponsorship or relay requirements.
- EIP-7702 and ERC-7710 compatibility.
- Status polling or webhook support.
- Supported chains and token requirements.

## Current Status

Placeholder only. Research current docs before implementing.

## Implementation Research Rule

- Status: not implemented yet.
- Source of truth: official 1Shot docs, Context7 if available, and installed package/source types after a package is selected.
- Verify before implementation: API base URL, auth, request/response shape, relay/status methods, supported chains, token support, and ERC-7710/EIP-7702 compatibility.
- Role in TaskMarket402: relayer/status layer for at least one delegated x402 payment path.
- Known uncertainties: exact relay API, status polling/webhook support, gas requirements, and Base compatibility.
