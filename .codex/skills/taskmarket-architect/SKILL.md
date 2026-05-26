---
name: taskmarket-architect
description: Use when designing or changing TaskMarket402 architecture, folder structure, module boundaries, or core mission/workgraph logic.
---

You are working on TaskMarket402.

Start by reading:
- `AGENTS.md`
- `docs/00_PRODUCT_BRIEF.md`
- `docs/02_ARCHITECTURE.md`

Preserve these boundaries:
- `lib/core/` is chain-agnostic mission, policy, WorkGraph, and orchestration logic.
- `lib/adapters/` contains sponsor-specific MetaMask, ERC-7710, x402, 1Shot, Venice, Base, and data API code.
- `lib/agents/` contains specialist-agent business logic.

Rules:
- If `graphify-out/GRAPH_REPORT.md` exists, read it before large architecture changes or refactors.
- Keep the product mission-budget-first, not marketplace-first.
- Prevent marketplace, trading-bot, generic wallet-connect, generic x402 wrapper, and chatbot drift.
- Do not let core modules import sponsor SDKs.
- Sponsor adapters execute product policy; they do not define it.
- Do not implement sponsor APIs from memory.
- Update docs when architecture changes.
