# 1Shot Research Notes

## Role In TaskMarket402

1Shot is the relayer/status layer for at least one ERC-7710/x402 payment path. Its status must be visible in the WorkGraph.

## Sources Checked

- Official 1Shot Public Relayer docs, checked 2026-06-07:
  - `https://1shotapi.com/docs/api-reference/public-relayer`
  - `https://1shotapi.com/docs/quickstarts/gas-sponsorship-eip7710`
  - `https://1shotapi.com/docs/relayer/get-started/permission-context`
- Official 1Shot x402 docs, checked 2026-06-07:
  - `https://docs.1shotapi.com/x402/index.html`
- Official 1Shot OpenRPC spec, checked 2026-06-07:
  - `https://1shotapi.com/openrpc/openrpc.json`
- Official x402 network/token docs and Context7 `/coinbase/x402`, checked 2026-06-07.
- Installed package metadata, checked 2026-06-07:
  - `@1shotapi/x402-facilitator@2.0.0`
  - no current `@1shotapi/client` package found through npm metadata.

## API Shape Summary

1Shot has two relevant but separate surfaces:

1. Public Relayer JSON-RPC:
   - Mainnet endpoint: `https://relayer.1shotapi.com/relayers`.
   - Testnet endpoint: `https://relayer.1shotapi.dev/relayers`.
   - OpenRPC methods verified from the live spec:
     - `relayer_getCapabilities`
     - `relayer_getFeeData`
     - `relayer_estimate7710Transaction`
     - `relayer_send7710Transaction`
     - `relayer_getStatus`
   - `relayer_send7710Transaction` submits one ERC-7710 delegated transaction bundle and returns a TaskId.
   - The send params include `chainId` and `transactions`; each transaction includes a `permissionContext` delegation chain and `executions` with `target`, `value`, and encoded `data`.
   - `relayer_getStatus` returns a task status and, when confirmed, a receipt object that may include a transaction hash.

2. 1Shot x402 facilitator:
   - Official docs say 1Shot can facilitate x402 payments for EIP-3009-compatible tokens on supported EVM networks after provisioning and funding a 1Shot server wallet, importing the token method, and creating API credentials.
   - The documented Node package is `@1shotapi/x402-facilitator`, exporting `create1ShotAPIFacilitatorClient`.
   - The current npm metadata for `@1shotapi/x402-facilitator@2.0.0` depends on older x402 package versions than this repo currently uses (`@x402/*@2.14.0`). Do not install it until package compatibility is re-checked against the exact integration point.

## Base Sepolia Readiness

A no-secret live capabilities check against the testnet public relayer returned:

- HTTP status: `200`.
- Chain id: `84532`.
- Result present: `true`.
- Token count: `1`.
- Token symbol: `USDC`.
- `feeCollector` present: `true`.
- `targetAddress` present: `true`.

This means Base Sepolia is available for the 1Shot public relayer path. x402 docs also list Base Sepolia `eip155:84532` with USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` and the test facilitator `https://x402.org/facilitator`.

## Phase 9 Recommended Architecture

Phase 9 should prove the Contract Scanner golden path only:

MetaMask scoped permission -> ERC-7710 delegated USDC action -> 1Shot relay/status/transaction proof -> Contract Scanner x402 call -> WorkGraph evidence.

The safest first delegated action is a Base Sepolia USDC transfer that enables the Contract Scanner x402 buyer path. It should not attempt to make Wallet Behavior or Market Context delegated through 1Shot in this phase.

Recommended flow:

1. Fetch `relayer_getCapabilities` for chain `84532` and select the returned USDC token plus relayer `targetAddress`.
2. Request a fresh MetaMask scoped mission permission for the Contract Scanner proof where the permission redeemer/delegate is the returned 1Shot `targetAddress`.
3. Build a narrow ERC-7710 transaction bundle that transfers only the Contract Scanner-funded amount, plus the required 1Shot fee transfer, within the user-granted USDC budget.
4. Call `relayer_estimate7710Transaction` before send.
5. If estimate returns a changed `requiredPaymentAmount`, update the fee execution and re-run estimate before submitting. Do not send stale fee quotes.
6. Submit the bundle with `relayer_send7710Transaction`.
7. Poll `relayer_getStatus` every 2-3 seconds until terminal status, or use a webhook in a later persistence phase.
8. Only after 1Shot confirmation, run the existing Contract Scanner x402 payment path. The WorkGraph should show the 1Shot action as "delegated funding/spend proof" and the x402 action as the actual Contract Scanner paid-resource settlement.
9. Store/render only client-safe evidence: capability chain id, token symbol/address hash, relayer target address hash or shortened address, TaskId hash, status, transaction hash if confirmed, x402 payment state, x402 response status, settlement-present boolean, and transaction-present boolean.

This path proves user-authorized delegated mission-budget movement and preserves the already-live x402 Contract Scanner resource. It is not the same as claiming direct user-delegated x402 settlement unless the x402 payment itself is also made with MetaMask's x402 delegation buyer.

## Direct x402 + 1Shot Assessment

1Shot directly supports x402 facilitation through a separate API/key/server-wallet flow, but that is not the same as the no-signup public relayer/status path.

For Phase 9B, do not make the 1Shot x402 facilitator the primary path unless these are verified immediately before coding:

- A 1Shot API key/secret and provisioned funded server wallet are available.
- The target token method is imported/configured in the 1Shot account.
- `@1shotapi/x402-facilitator` is compatible with this repo's current `@x402/*` packages or a current official alternative exists.
- The integration can produce sanitized transaction/status evidence suitable for the WorkGraph.

Fallback if direct 1Shot x402 facilitation is blocked: use the public relayer for the delegated USDC funding/spend proof, then run the existing real Contract Scanner x402 path with honest UI labels.

## Required Env Vars For Phase 9B

Likely safe for `.env.example`:

- `ONESHOT_RELAYER_URL=https://relayer.1shotapi.dev/relayers`
- `ONESHOT_CHAIN_ID=84532`
- `ONESHOT_STATUS_POLL_MS=2500`
- `ONESHOT_LIVE_SMOKE=false`
- `X402_CONTRACT_SCANNER_DELEGATED_MODE=disabled`
- `X402_DELEGATED_CONTRACT_SCANNER_BUYER_ADDRESS=`

Local/deployment secrets only:

- `X402_DELEGATED_CONTRACT_SCANNER_BUYER_PRIVATE_KEY`, if the delegated transfer funds a dedicated x402 buyer account.
- `ONESHOT_API_KEY` and `ONESHOT_API_SECRET`, only if using the 1Shot x402 facilitator or authenticated Dev Platform APIs.
- Any session/delegate private key, only if the implementation chooses redelegation from an app-owned session account instead of granting the permission directly to the 1Shot `targetAddress`.

No 1Shot API key appears required for the public relayer path. A 1Shot API key/secret is required for the 1Shot x402 facilitator/server-wallet path.

## Phase 9B Files Likely To Change

- `lib/adapters/relayer/oneshot.ts`: JSON-RPC client for capabilities, estimate, send, and status.
- `lib/adapters/permission/erc7710-redelegation.ts`: permission-context handling or redelegation helpers if not granting directly to the relayer target address.
- `lib/core/mission-permission.ts`: client-safe Phase 9 receipt/evidence DTOs and validation helpers.
- `lib/adapters/payment/x402-client.ts`: optional dedicated delegated Contract Scanner buyer config.
- `lib/runtime/paid-agent-flow.ts` or a new `lib/runtime/delegated-contract-scanner-flow.ts`: orchestrate the Contract Scanner-only delegated path.
- Mission UI and WorkGraph components: show `permission_granted`, `oneshot_relay_submitted`, `oneshot_confirmed`, `real_x402_paid`, and failure states.
- `scripts/smoke-oneshot-contract-scanner.test.ts`: opt-in live smoke.
- `.env.example`: safe variable names only.
- Unit/e2e tests around adapter DTOs, failure categories, and UI evidence.

## Test Plan

Unit tests should mock all live network and relayer calls:

- `relayer_getCapabilities` maps Base Sepolia USDC and target address.
- Missing capability result returns `oneshot_unavailable`.
- Invalid chain returns `wrong_network` / unsupported chain.
- Estimate failure returns sanitized `oneshot_estimate_failed`.
- Send failure returns sanitized `oneshot_send_failed`.
- Status timeout returns sanitized `oneshot_status_timeout`.
- Confirmed status maps only TaskId/status/transaction hash to client-safe DTOs.
- Raw permission context, signatures, payment headers, and request bodies are never rendered or persisted.
- Existing all-agent x402 path remains stable; Wallet Behavior and Market Context remain real x402 but not delegated/1Shot in Phase 9.

E2E tests should use mocked DTOs:

- Contract Scanner shows 1Shot delegated proof states.
- Wallet Behavior and Market Context still show real x402-paid without 1Shot/delegated claims.
- No user-authorized x402 claim appears unless the delegated path state is confirmed.

## Smoke Test Plan

Add an opt-in smoke command such as `pnpm smoke:oneshot`.

Requirements:

- It must require `ONESHOT_LIVE_SMOKE=true`.
- It must require Base Sepolia chain id `84532`.
- It must call `relayer_getCapabilities` first and print only sanitized capability fields.
- It must submit only if a fresh MetaMask permission/redelegation context is available.
- It must print only sanitized fields: chain id, token symbol, relayer target address shortened/hash, TaskId hash, relay status, transaction hash if confirmed, Contract Scanner x402 payment state, response status, and failure category.

It must not print private keys, raw wallet responses, raw permission context, delegation payloads, signatures, x402 payment headers, payment payloads, request headers, raw 1Shot responses, or facilitator responses.

## Risks And Fallbacks

- Current Phase 7 stores only sanitized permission receipts. Phase 9 execution needs the raw permission context transiently. The app must consume it without rendering, logging, persisting, or committing it.
- The 1Shot public relayer `targetAddress` must be used as the permission delegate/redeemer or the action must be redelegated to it; otherwise redemption can fail.
- Fee estimation can change the required payment execution. Phase 9 must re-estimate with a fresh quote and stop on mismatch instead of guessing.
- Direct 1Shot x402 facilitator integration may require account setup, API credentials, a provisioned/funded server wallet, token-method import, and package compatibility fixes.
- If 1Shot relay fails, keep Contract Scanner real x402 behavior available but label the delegated path as unavailable/failed.
- If the delegated action only funds the x402 buyer, do not claim direct user-delegated x402 settlement. Claim only a 1Shot-proven delegated funding/spend step plus real Contract Scanner x402 settlement.

## Implementation Research Rule

- Status: Phase 9 readiness researched; no code implemented yet.
- Source of truth: official 1Shot Public Relayer docs/OpenRPC, official 1Shot x402 docs, official x402 docs, Context7 x402 docs, and package source/types after any package is selected.
- Verify before implementation: capability shape, estimate/send/status method shape, exact target address, fee quote context, token support, whether the app grants directly to 1Shot targetAddress or redelegates, and whether direct 1Shot x402 facilitator package compatibility is acceptable.
- Role in TaskMarket402: relayer/status proof for at least one Contract Scanner delegated mission-budget action.
- Known uncertainties: exact live fee sizing, whether direct 1Shot x402 facilitator should be used in addition to the public relayer, whether the Phase 9 permission should be fresh or redelegated from the Phase 7 session account, and how best to store transient raw permission context without persistence.
