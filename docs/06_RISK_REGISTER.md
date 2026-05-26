# Risk Register

## Sponsor API Drift

Risk: MetaMask, x402, 1Shot, or Venice APIs change.

Fallback: Use `sponsor-docs-rag` before implementation, update `docs/research/`, and build one integration at a time.

## Overbuilding The Marketplace

Risk: The product drifts into generic agent listings.

Fallback: Keep mission budget and WorkGraph as the primary UX.

## Fake Payment Perception

Risk: Judges see the demo as simulated payments.

Fallback: Make at least one sponsor-critical path real and show transaction, relay, or status evidence in the WorkGraph.

## Chain/Token Support

Risk: Base Sepolia or payment-token support does not match sponsor docs.

Fallback: Re-validate chain and token support before integration; keep core chain-agnostic.

## AI Output Quality

Risk: Venice output is unstructured or inconsistent.

Fallback: Use strict schemas, verification prompts, and deterministic fallback states.

## Demo Reliability

Risk: Live relayer, RPC, or API services fail during demo.

Fallback: Record proof, keep a blocked-payment case, and make failure states explicit in the WorkGraph without claiming success.
