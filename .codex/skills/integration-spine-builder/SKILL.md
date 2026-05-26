---
name: integration-spine-builder
description: "Use when implementing the golden path: MetaMask permission -> Manager Agent -> Contract Scanner Agent -> x402 payment -> 1Shot relay/status -> output -> Venice verification -> WorkGraph update."
---

Build one reliable spine before expanding breadth:
1. MetaMask scoped mission permission.
2. Manager Agent plan.
3. Contract Scanner Agent request.
4. x402 payment-required state.
5. ERC-7710/redelegation path.
6. 1Shot relay/status.
7. Specialist output.
8. Venice verification.
9. WorkGraph update for every state transition.

Keep failure states explicit, including blocked payment.
Update WorkGraph events at each step.
Use `sponsor-docs-rag` before writing any external integration code.
Do not implement MetaMask, ERC-7710, x402, 1Shot, Venice, or Base APIs from memory.
