# Base Chain Research Notes

## Role In TaskMarket402

Base Sepolia is the recommended integration and testing network. Base mainnet is the likely final demo network if sponsor docs, payment assets, and relayer support line up.

## Concepts To Verify Before Coding

- Current Base Sepolia chain ID and RPC recommendations.
- USDC or test stablecoin address for payment demos.
- Explorer URLs.
- MetaMask Smart Accounts support.
- x402 network support.
- 1Shot network support.

## Current Status

Phase 3 uses Base read-only RPC for self-owned specialist-agent data. No wallet signing, MetaMask permission, payment, x402, 1Shot, or settlement logic is implemented here.

## Current API Shape

- Official public Base RPC endpoints:
  - Mainnet chain ID `8453`, HTTP RPC `https://mainnet.base.org`.
  - Sepolia chain ID `84532`, HTTP RPC `https://sepolia.base.org`.
- Official docs warn public endpoints are rate-limited and not suitable for production traffic.
- viem server-side read strategy:
  - `createPublicClient({ chain, transport: http(rpcUrl) })`
  - `getCode({ address })` for contract bytecode.
  - `getBalance({ address })` for native ETH balance in wei.
  - `getTransactionCount({ address })` for nonce / outgoing transaction count.
  - `isAddress()` / `getAddress()` for EVM address validation and checksum normalization.

## Environment Variables

- `BASE_CHAIN_ID`: optional server-side chain override; defaults to `84532`.
- `BASE_RPC_URL`: optional server-side RPC override.
- `NEXT_PUBLIC_CHAIN_ID` and `NEXT_PUBLIC_BASE_RPC_URL`: existing public config values may be used only as non-secret fallbacks.

## Failure / Fallback Behavior

- Invalid target address: return typed fallback output; do not call RPC.
- Unsupported chain ID: return typed fallback output.
- RPC network/rate-limit/provider failure: return typed fallback output with sanitized evidence.
- Empty bytecode is a valid real-data result for EOAs; it is not treated as a provider failure.

## Implementation Research Rule

- Status: Phase 3 read-only data agent implementation in progress.
- Source of truth: official Base docs, Context7 viem docs, and installed viem package source/types.
- Verify before implementation: current chain IDs, RPC recommendations, explorer URLs, payment token addresses, MetaMask support, x402 support, and 1Shot support.
- Role in TaskMarket402: likely test/demo network for the golden path if sponsor support aligns.
- Known uncertainties: final demo chain choice, USDC/test-token availability, public RPC rate limits, and cross-sponsor compatibility.
