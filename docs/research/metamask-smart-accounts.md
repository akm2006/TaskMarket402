# MetaMask Smart Accounts Research Notes

## Role In TaskMarket402

MetaMask is the root user-authority layer for the mission budget. Phase 7 proves wallet connection, Base Sepolia readiness, and a scoped mission-budget permission receipt. It does not prove delegated x402 execution, 1Shot relay, or ERC-7710 redemption yet.

## Sources Checked

- Official MetaMask Smart Accounts Kit supported networks docs, checked 2026-06-02.
- Official Advanced Permissions / ERC-7715 execution guide and wallet-client reference, checked 2026-06-02.
- Official ERC-20 token permissions guide, checked 2026-06-02.
- Official ERC-7710 bundler action reference, checked only to bound what Phase 7 must not implement.
- Context7 Smart Accounts Kit docs for current examples.
- Installed package source/types for `@metamask/smart-accounts-kit@1.6.0`.

## Package And Import Shape

- Package: `@metamask/smart-accounts-kit@1.6.0`.
- Peer dependency: `viem` `^2.31.4`; this repo currently has a compatible `viem` version.
- Phase 7 client import:
  - `erc7715ProviderActions` from `@metamask/smart-accounts-kit/actions`.
  - `createWalletClient` and `custom` from `viem`.
- Official docs extend a Viem wallet client with `erc7715ProviderActions()` and call `requestExecutionPermissions`.

## Permission API Shape

The installed 1.6.0 types define `RequestExecutionPermissionsParameters` as an array of permission request objects with this relevant shape:

```ts
{
  chainId: number
  from?: Address | null
  to: Address
  expiry?: number | null
  redeemer?: readonly Address[] | null
  payee?: readonly Address[] | null
  permission: {
    type: "erc20-token-periodic"
    data: {
      tokenAddress: Address
      periodAmount: bigint
      periodDuration: number
      startTime?: number
      justification?: string
    }
    isAdjustmentAllowed?: boolean
  }
}
```

Important installed-type finding: use `to` for the session/delegate account. Some examples and older wording say "signer" conceptually, but the current package request parameter is `to`.

The permission response includes delegation context data such as `context`, `dependencies`, and `delegationManager`. TaskMarket402 must store/render only sanitized metadata in Phase 7, such as a receipt id/hash, chain id, wallet address, delegate address, token, budget amount, period, expiry, and state. Do not render raw context, dependency data, signatures, wallet payloads, or headers.

## Supported Network Assumptions

- Base Sepolia is listed as supported for MetaMask Smart Accounts and Advanced Permissions in the current docs.
- Phase 7 target chain: Base Sepolia, chain id `84532`.
- Target token: Base Sepolia USDC, currently `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- Live behavior still depends on the user wallet, extension version, account type, and whether Advanced Permissions are enabled for that account.
- MetaMask provider network checks should use `eth_chainId`. If the provider reports the wrong chain, the UI can prompt `wallet_switchEthereumChain` for Base Sepolia (`0x14a34`) and use `wallet_addEthereumChain` if MetaMask reports the chain is missing.

## Mission Budget Mapping

TaskMarket402 maps `MissionBudgetPolicy` to an ERC-20 periodic permission:

- `policy.totalBudgetUsd` -> `periodAmount` in USDC base units.
- `policy.chainId` -> request `chainId`.
- USDC token -> `permission.data.tokenAddress`.
- Mission duration -> `periodDuration`.
- Expiry -> request `expiry`.
- Session/delegate public address -> request `to`.
- Product reason -> `permission.data.justification`.

Core policy remains authoritative. MetaMask adapters may request a permission only after core rejects unsafe policies:

- Wrong chain.
- Invalid or non-positive total budget.
- `maxPerAgentUsd` greater than total budget.
- Unsupported token.
- Missing or invalid expiry.
- Missing or invalid delegate/session address.

## Env Vars

Safe for `.env.example`:

- `NEXT_PUBLIC_CHAIN_ID=84532`
- `NEXT_PUBLIC_CHAIN_NAME=base-sepolia`
- `NEXT_PUBLIC_BASE_RPC_URL=`
- `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- `NEXT_PUBLIC_METAMASK_SESSION_ACCOUNT_ADDRESS=`
- `NEXT_PUBLIC_MISSION_PERMISSION_PERIOD_SECONDS=3600`

Server/local only or future:

- `METAMASK_DELEGATION_ENV=` is still a placeholder for later environment selection.
- No MetaMask private key, wallet mnemonic, or session-account private key should be stored for Phase 7.

## Failure Modes

- MetaMask provider missing.
- User rejects connection or permission request.
- Wallet is on the wrong network.
- MetaMask UI appears to show Base Sepolia but the connected dapp provider still reports `eth_chainId=0x1`; refresh/recheck the provider session and use the explicit Base Sepolia switch button.
- Base Sepolia RPC balance reads fail.
- USDC balance call fails or token address is wrong.
- The wallet does not support `wallet_requestExecutionPermissions`.
- Advanced Permissions are not enabled for the connected account.
- Session/delegate address is missing or invalid.
- Package/docs mismatch between examples and installed types.

All failures should return client-safe states: `wallet_not_connected`, `wallet_connected`, `wrong_network`, `permission_requested`, `permission_granted`, `permission_rejected`, or `permission_unavailable`.

## Current Status

Phase 7 implementation target:

- Wallet connection/readiness UI.
- Base Sepolia chain check.
- ETH and USDC readiness read where practical.
- Scoped mission-budget permission request through MetaMask Advanced Permissions when supported.
- Sanitized permission receipt metadata only.

Out of scope for Phase 7:

- ERC-7710 redemption or execution.
- 1Shot relay/status.
- User-authorized x402 execution.
- Server-side custody or wallet private-key handling.
- New x402 behavior.

## Implementation Research Rule

- Status: Phase 7 permission proof in progress; no delegated execution implemented yet.
- Source of truth: official MetaMask Smart Accounts Kit and Advanced Permissions docs, Context7, and installed package source/types.
- Verify before implementation: package names, permission request shape, supported network, extension support, session/delegate address handling, token address, and sanitized receipt boundaries.
- Role in TaskMarket402: root mission-budget authority and scoped permission grant.
- Known uncertainties: live wallet support for Advanced Permissions on the connected account, whether the user has MetaMask production support or Flask, exact wallet UX copy, session account lifecycle, and how the later ERC-7710/1Shot execution path should consume the permission context.
