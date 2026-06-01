# Build Phases

## Current Roadmap Source

`docs/PRODUCT_COMPLETION_PLAN.md` is the current source-of-truth roadmap. This file records the original setup-era phase structure and remains useful historical context, but new planning should follow the product completion plan.

Current roadmap summary:

1. MetaMask wallet + scoped mission permission proof.
2. Real x402 for all specialist agents.
3. 1Shot / ERC-7710 delegated Contract Scanner golden path.
4. Connect delegated permission authority to paid-agent execution.
5. Minimal persistence / mission audit storage.
6. Venice live finalization and provider-switch demo polish.
7. End-to-end mission runner.
8. Landing / README / deployment.
9. Final hardening.

## Historical Setup-Era Plan

## Phase 0: Engineering Foundation

Create Next.js foundation, docs, AGENTS.md, Codex skills, env template, and typed placeholders. No real sponsor integrations.

## Phase 1: Non-Chain MVP

Build mission creation, mission detail, mock manager planning, mock specialist outputs, WorkGraph UI, event log, final report placeholder, and blocked payment state.

## Phase 2: Venice

Research current Venice docs. Implement typed `planMission`, `verifyAgentOutput`, and `synthesizeFinalReport` methods with schema validation and fallbacks.

## Phase 3: Real-Data Agents

Implement Contract Scanner, Wallet Behavior, and Market Context agents using public data APIs where possible. Keep outputs structured and verifiable.

## Phase 4: x402 Contract Scanner Flow

Research current x402 buyer and seller flow. Implement one x402-protected Contract Scanner path first.

## Phase 5: MetaMask + 1Shot Golden Path

Research current MetaMask Advanced Permissions, ERC-7715, ERC-7710, EIP-7702, and 1Shot docs. Implement one reliable payment path only.

## Phase 6: Demo Hardening

Freeze features. Add blocked payment case, demo script, reliability checks, screenshots, and clear README instructions.
