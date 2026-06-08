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

## Phase 9 ERC-7710 / 1Shot Readiness

Sources re-checked on 2026-06-07:

- Official MetaMask Advanced Permissions guide for requesting and redeeming ERC-7715 permissions.
- Official MetaMask x402 buyer delegation guide.
- Installed `@metamask/smart-accounts-kit@1.6.0` package source/types.
- Official 1Shot Public Relayer/OpenRPC docs.
- Official x402 docs for Base Sepolia support.

### Current MetaMask API Shape

The MetaMask docs describe Advanced Permissions as ERC-7715 wallet permissions that are backed by ERC-7710 delegations. The current package exposes:

- `erc7715ProviderActions()` for `requestExecutionPermissions`.
- `erc7710WalletActions()` with `sendTransactionWithDelegation`.
- `erc7710BundlerActions()` with `sendUserOperationWithDelegation`.
- `redelegatePermissionContext` and `redelegatePermissionContextOpen`.
- Experimental `createx402DelegationProvider` from `@metamask/smart-accounts-kit/experimental`.

Installed type findings:

```ts
type SendTransactionWithDelegationParameters = SendTransactionParameters & {
  permissionContext: PermissionContext;
  delegationManager: Hex;
};

type SendUserOperationWithDelegationParameters = SendUserOperationParameters & {
  dependencies?: { factory: Hex; factoryData: Hex }[];
  calls: DelegatedCall[];
  publicClient: PublicClient;
};
```

The experimental x402 delegation provider accepts an account plus optional `parentPermissionContext`, caveats, redeemer constraints, expiry, and environment. It maps x402 `PaymentRequirements` into an encoded permission context payload for x402 payment handling.

### What Phase 7 Can Reuse

- Wallet connection and Base Sepolia readiness UI.
- Core budget validation and Base Sepolia USDC constants.
- `MissionBudgetPolicy` to ERC-20 periodic permission mapping.
- Sanitized receipt metadata and UI states.
- Manual proof pattern for sanitized wallet evidence.

What Phase 9 must add:

- A way to consume the raw MetaMask permission response transiently for execution. Phase 7 intentionally stores only sanitized metadata, which is correct for UI but insufficient for ERC-7710 redemption.
- A Contract Scanner-specific delegated execution path.
- 1Shot capability discovery before deciding the permission delegate/redeemer.
- Client-safe WorkGraph evidence for 1Shot relay/status/transaction proof.

### Recommended Phase 9 Permission Strategy

For the safest 1Shot public relayer path, request a fresh Contract Scanner scoped permission whose delegate/redeemer is the 1Shot Base Sepolia `targetAddress` returned by `relayer_getCapabilities`.

Reasoning:

- 1Shot docs say to use the returned `targetAddress` as the delegation `to` address; if it does not match, redemption can fail.
- Granting directly to the relayer target avoids storing an app-owned session/delegate private key for the first live proof.
- It keeps the Phase 9 proof focused on one delegated Contract Scanner action.

Fallback if the product must reuse an existing Phase 7 session permission:

- Use `redelegatePermissionContext` or `redelegatePermissionContextOpen` to redelegate from the app session/delegate to the 1Shot `targetAddress`.
- This requires a session/delegate signer. Use only a throwaway testnet key in `.env.local` or deployment secrets, and never print or persist it.

### Recommended Delegated Action

The first Phase 9 delegated action should be a narrow USDC transfer/funding step that enables the Contract Scanner x402 buyer path, not a broad approval and not a new payment policy.

The app should validate:

- Base Sepolia only.
- USDC only.
- Amount <= Contract Scanner sub-budget and mission budget.
- Relay fee + Contract Scanner x402 price stays within core policy.
- Expiry is present and future.
- Relayer capability token matches configured Base Sepolia USDC.

After the 1Shot action is confirmed, run the existing Contract Scanner x402 path. If the delegated action only funds the x402 buyer, label the WorkGraph as "1Shot delegated funding/spend proof" plus "real Contract Scanner x402 settlement." Do not claim direct user-delegated x402 settlement unless the x402 payment itself is made through MetaMask's x402 delegation client.

### Direct MetaMask x402 Delegation Option

MetaMask's x402 buyer delegation guide provides a more direct x402 path:

- Install/use `@metamask/x402` plus `@x402/core` and `@x402/fetch`.
- Create an `x402Erc7710Client`.
- Register it on an x402 core client.
- Use `wrapFetchWithPayment` for the paid Contract Scanner request.

This can make the x402 payment itself use ERC-7710-style delegation, but it does not by itself provide a 1Shot public relayer TaskId/status/transaction proof. For TaskMarket402 Phase 9, treat it as an option to test after the public 1Shot delegated action is proven, or combine it with a verified 1Shot x402 facilitator only if package/API compatibility and credentials are ready.

### Env Vars For Phase 9B

Safe for `.env.example`:

- `ONESHOT_RELAYER_URL=https://relayer.1shotapi.dev/relayers`
- `ONESHOT_CHAIN_ID=84532`
- `ONESHOT_STATUS_POLL_MS=2500`
- `ONESHOT_LIVE_SMOKE=false`
- `X402_CONTRACT_SCANNER_DELEGATED_MODE=disabled`
- `X402_DELEGATED_CONTRACT_SCANNER_BUYER_ADDRESS=`

Local/deployment secrets only:

- `X402_DELEGATED_CONTRACT_SCANNER_BUYER_PRIVATE_KEY`, if using a dedicated delegated-funded x402 buyer account.
- `METAMASK_SESSION_PRIVATE_KEY` or `MISSION_DELEGATE_PRIVATE_KEY`, only if using an app-owned session/redelegation path.
- `ONESHOT_API_KEY` and `ONESHOT_API_SECRET`, only if using the 1Shot x402 facilitator/API-key path instead of the public relayer path.

### Client-Safe Evidence

Safe to store/render:

- shortened wallet address
- chain id
- permission state
- sanitized permission receipt id/hash
- shortened/dehashed delegate/redeemer address
- 1Shot TaskId hash
- 1Shot status
- confirmed transaction hash
- x402 payment state and response status
- booleans for settlement present and transaction present

Never print, render, persist, or commit:

- raw permission context
- raw delegation payload
- raw wallet response
- signatures
- session/delegate private key
- x402 payment headers or payloads
- raw 1Shot responses
- raw facilitator responses

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

- Status: Phase 7 permission proof live-proven; Phase 9 ERC-7710/1Shot readiness researched; no delegated execution implemented yet.
- Source of truth: official MetaMask Smart Accounts Kit and Advanced Permissions docs, Context7, and installed package source/types.
- Verify before implementation: package names, permission request shape, supported network, extension support, session/delegate address handling, token address, raw permission context handling, ERC-7710 redemption shape, 1Shot target address, and sanitized receipt/evidence boundaries.
- Role in TaskMarket402: root mission-budget authority and scoped permission grant.
- Known uncertainties: live wallet support for Advanced Permissions on the connected account, whether the user has MetaMask production support or Flask, exact wallet UX copy, session account lifecycle, whether Phase 9 grants directly to the 1Shot target address or redelegates from an app session, and whether direct MetaMask x402 delegation should be combined with 1Shot after the relayer proof.
