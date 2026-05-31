# Public Data Agents Research Notes

## Role In TaskMarket402

Phase 3 replaces static specialist-agent mock outputs with server-side, self-owned data agents. These agents produce useful Wallet / Token Risk Report evidence before payment, wallet, relayer, x402, 1Shot, MetaMask, or Supabase integrations are added.

## Sources Checked

- viem docs through Context7: `/wevm/viem`
- Installed viem package types under `node_modules/viem/_types`
- Base RPC docs: `https://docs.base.org/base-chain/api-reference/rpc-overview`
- Base network information: `https://docs.base.org/base-chain/quickstart/connecting-to-base`
- DexScreener API reference: `https://docs.dexscreener.com/api/reference`
- Etherscan V2 docs: `https://docs.etherscan.io/introduction`
- Etherscan txlist endpoint: `https://docs.etherscan.io/api-reference/endpoint/txlist`
- Etherscan V2 migration: `https://docs.etherscan.io/v2-migration`
- Etherscan rate limits: `https://docs.etherscan.io/resources/rate-limits`

## Selected Data Sources

### Base RPC via viem

- Purpose: address validation, contract-vs-EOA detection, bytecode size, native balance, and transaction count.
- Package API:
  - `createPublicClient({ chain, transport: http(rpcUrl) })`
  - `getCode({ address })`
  - `getBalance({ address })`
  - `getTransactionCount({ address })`
  - `isAddress(address)` and `getAddress(address)`
- Chain config:
  - Base mainnet `8453`, `https://mainnet.base.org`
  - Base Sepolia `84532`, `https://sepolia.base.org`
- Fallbacks:
  - invalid address
  - unsupported chain
  - public RPC rate limit or network failure

### Etherscan V2 Account API

- Purpose: optional wallet behavior transaction-history enrichment.
- Base URL: `https://api.etherscan.io/v2/api`
- Required env var: `ETHERSCAN_API_KEY`
- Request shape:
  - `chainid`
  - `module=account`
  - `action=txlist`
  - `address`
  - `startblock=0`
  - `endblock=999999999`
  - `page=1`
  - `offset=20`
  - `sort=desc`
  - `apikey`
- Response shape:
  - `status`
  - `message`
  - `result[]` with fields such as `hash`, `from`, `to`, `value`, `timeStamp`, `isError`, `methodId`, and `functionName`
- Rate limits:
  - Free tier: 3 calls/second and up to 100,000 calls/day on selected chains.
  - Free tier record limit changes are scheduled for July 1, 2026, so keep offsets conservative.
- Fallbacks:
  - missing `ETHERSCAN_API_KEY`
  - rate limit
  - invalid or unsupported chain
  - empty transaction history
  - malformed or failed API response

### DexScreener Public API

- Purpose: market context for token addresses.
- Base URL: `https://api.dexscreener.com`
- Endpoint selected:
  - `GET /token-pairs/v1/{chainId}/{tokenAddress}`
- Chain ID assumption:
  - DexScreener uses a string chain ID; Base is expected as `base`.
  - This must stay configurable because the official docs show the parameter but do not enumerate every chain slug on the endpoint page.
- Response shape:
  - top-level array of pair objects.
  - pair fields include `chainId`, `dexId`, `pairAddress`, `baseToken`, `quoteToken`, `priceUsd`, `txns`, `volume`, `priceChange`, `liquidity`, `fdv`, `marketCap`, and `pairCreatedAt`.
- Rate limits:
  - token-pair endpoints are documented at 300 requests/minute.
- Fallbacks:
  - invalid address
  - no pairs
  - rate limit
  - network/provider failure
  - malformed response

## Environment Variables

- `BASE_CHAIN_ID`: optional server chain ID; default `84532`.
- `BASE_RPC_URL`: optional server RPC override.
- `ETHERSCAN_API_KEY`: optional transaction-history enrichment.
- `ETHERSCAN_BASE_URL`: optional Etherscan V2 base URL override; default `https://api.etherscan.io/v2/api`.
- `DEXSCREENER_BASE_URL`: optional DexScreener base URL override; default `https://api.dexscreener.com`.
- `DEXSCREENER_CHAIN_ID`: optional DexScreener chain slug; default `base`.

## Agent Output Strategy

- Contract Scanner Agent:
  - Uses Base RPC.
  - Reports whether bytecode exists, code size, native balance, and transaction count.
  - Does not perform source-code verification or bytecode decompilation in Phase 3.
- Wallet Behavior Agent:
  - Uses Base RPC for native balance and transaction count.
  - Optionally uses Etherscan V2 for recent normal transactions when `ETHERSCAN_API_KEY` is configured.
  - Falls back to RPC-only evidence if the explorer key is missing or the explorer fails.
- Market Context Agent:
  - Uses DexScreener token-pairs endpoint.
  - Reports strongest pair by liquidity when available.
  - Falls back when no pair is found or the target is not a token tracked by DexScreener.

## Current Status

Phase 3 implementation in progress. Public data agent outputs must be typed `AgentOutput` values and must label their source as `real-data`, `fallback`, or `mock` in client-safe DTOs/evidence.

## Implementation Research Rule

- Status: Phase 3 implementation in progress.
- Source of truth: official Base, Etherscan, DexScreener docs; Context7 viem docs; installed viem package types.
- Verify before runtime use: env handling, address validation, Base chain selection, DexScreener chain slug, explorer response status parsing, and fallback behavior.
- Role in TaskMarket402: produce useful self-owned specialist evidence before payment/wallet/relayer integrations.
- Known uncertainties: public RPC reliability, account-specific Etherscan access for Base chain ID, DexScreener chain slug coverage, rate-limit behavior, and whether the demo target has live Base/DexScreener activity.
