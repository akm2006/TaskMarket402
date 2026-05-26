# MetaMask Smart Accounts Research Notes

## Role In TaskMarket402

MetaMask is the root authority layer for the mission budget. The desired permission is scoped by budget, duration, allowed use, and mission ID.

## Concepts To Verify Before Coding

- Smart Accounts Kit package names and current setup.
- Advanced Permissions API shape.
- ERC-7715 permission request format.
- ERC-7710 or redelegation support.
- EIP-7702 requirements and supported networks.
- Base Sepolia and Base mainnet support.

## Current Status

Placeholder only. Research current docs before implementing.

## Implementation Research Rule

- Status: not implemented yet.
- Source of truth: official MetaMask Smart Accounts Kit and Advanced Permissions docs, Context7 if available, and installed package source/types after packages are selected.
- Verify before implementation: package names, permission request shape, ERC-7715 support, ERC-7710/redelegation support, EIP-7702 requirements, signing flow, supported networks, and session/budget constraints.
- Role in TaskMarket402: root mission-budget authority and scoped permission grant.
- Known uncertainties: current Advanced Permissions API shape, Base support, token-spend constraints, and redelegation mechanics.
