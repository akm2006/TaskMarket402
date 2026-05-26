# Sponsor Tech

## MetaMask Smart Accounts / Advanced Permissions

MetaMask is the user authority layer. The intended UX is one scoped mission permission, such as a 3 USDC budget valid for a limited time and restricted to mission payments. This prevents the agent from receiving broad wallet control.

## ERC-7715

ERC-7715 is treated as the permission request concept: the app asks the wallet for bounded authority. Future implementation must verify the current MetaMask API shape before coding.

## ERC-7710

ERC-7710 is treated as the delegated execution/redelegation concept: the app uses approved authority to execute a bounded payment. Future implementation must verify exact transaction and delegation requirements before coding.

## EIP-7702

EIP-7702 is relevant because it lets externally owned accounts participate in smart-account-style delegated behavior. It should be documented as part of the MetaMask and 1Shot integration path after current docs are checked.

## x402

x402 is the agent payment layer. Specialist agents expose paid HTTP resources. A Manager Agent requests a resource, receives a `402 Payment Required` response, prepares payment, retries or settles through the payment adapter, and receives the specialist output.

## 1Shot

1Shot is the relayer/status layer for at least one delegated payment path. It should be visible in the WorkGraph as relay submitted, pending, confirmed, or failed status.

## Venice AI

Venice AI is the planning, verification, and synthesis layer. It is not just a chatbot. It should produce structured plans, verify specialist outputs, and synthesize the final Wallet / Token Risk Report.

## Base Sepolia / Base Mainnet

Base Sepolia is the recommended build and test network. Base mainnet is the likely final demo network if sponsor docs and available token support make it practical. Chain choice must be re-validated before integration.
