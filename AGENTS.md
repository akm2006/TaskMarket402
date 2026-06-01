# TaskMarket402 Agent Constitution

## Project Identity

TaskMarket402 is a Mission Budget WorkGraph for autonomous agent teams. It turns one scoped MetaMask permission into an auditable mission budget that a Manager Agent can split across specialist agents.

## Final Locked Concept

A user creates a Wallet / Token Risk Report mission, grants one scoped MetaMask mission budget, a Manager Agent splits that budget into sub-budgets, specialist agents are paid through x402, at least one ERC-7710/x402 payment is relayed through 1Shot, Venice AI plans/verifies/synthesizes, and the WorkGraph shows every permission, payment, output, and result.

## Current Product Roadmap

`docs/PRODUCT_COMPLETION_PLAN.md` is the current source-of-truth roadmap for TaskMarket402. Older build-phase docs and build-log entries are historical context, not the current target.

- Final target: a working product-grade testnet app, not a mock demo.
- User connects MetaMask and grants scoped mission permission/delegation.
- Contract Scanner, Wallet Behavior, and Market Context must all use real x402 on testnet before final submission unless a documented blocker is found.
- Contract Scanner is already the first live-proven x402 path.
- 1Shot / ERC-7710 must be proven for at least one delegated mission-budget action.
- AI must remain provider-switchable through `AI_PROVIDER=venice | gemini | mock`.
- Venice is preferred for final sponsor/demo mode; Gemini is valid for development/fallback.
- Do not present Gemini or mock output as Venice.
- Landing page, README polish, and deployment docs come late, after the real flow exists.
- Never fake MetaMask approval, ERC-7710/delegation, x402 settlement, 1Shot proof, or Venice live output.

## What We Are Building

- Mission creation and mission-budget policy.
- Manager Agent planning and budget splitting.
- Specialist-agent work units: Contract Scanner, Wallet Behavior, Market Context.
- x402-protected specialist-agent payment flow.
- One real golden path through MetaMask permission, redelegation, x402, 1Shot, Venice verification, and WorkGraph update.
- WorkGraph as the primary product surface.

## What We Are Not Building

- A generic agent marketplace.
- An AI trading bot.
- A generic x402 wrapper.
- A simple wallet-connect demo.
- A fake payment demo.
- A generic chatbot.

## Non-Negotiable Architecture Rules

- Keep chain-agnostic core logic separate from sponsor-specific adapters.
- `lib/core/` owns mission, policy, WorkGraph, and orchestration types.
- `lib/adapters/` owns MetaMask, ERC-7710, x402, 1Shot, Venice, Base, and data API integrations.
- `lib/agents/` owns specialist-agent business logic.
- Core modules must not import sponsor SDKs directly.
- Sponsor integrations must not define product policy. They execute policy produced by core logic.
- Do not implement sponsor APIs from memory. Research current docs first.

## RAG-First Rule

For external APIs, SDKs, protocols, sponsor tools, chain configuration, package APIs, or anything likely to change, do not code from memory. Use Context7, official docs, local `docs/research/` notes, installed package source/types, or MCP tools first. Then write a short API-shape summary before implementation.

This applies especially to MetaMask Smart Accounts Kit, Advanced Permissions, ERC-7715, ERC-7710, EIP-7702, x402, 1Shot, Venice AI, Base chain configuration, viem/wagmi, Next.js App Router, React Flow, Supabase, and Playwright.

## Tool-Choice Rule

- Use Graphify to understand repo structure and cross-file relationships.
- Use Repomix to create a portable full-repo context bundle for external AI review.
- Use Context7 before implementing library or protocol integrations when docs are available there.
- Use official docs or web research for sponsor APIs not covered by Context7.
- Use Playwright MCP for exploratory UI checks.
- Use Playwright tests or CLI for repeatable UI verification.
- Use Next.js DevTools MCP for Next.js runtime and debugging issues.
- Use Supabase MCP only after a Supabase project exists and credentials are handled safely.
- Prefer CLI tools over MCPs when the CLI is simpler and more reliable.
- Avoid random extra MCPs that add token or noise overhead.

## Graphify Rule

Before large architecture changes, cross-file debugging, or refactors, read `graphify-out/GRAPH_REPORT.md` if it exists. After major architecture phases, run `graphify .` if the installed Graphify CLI supports it; otherwise use the verified local fallback `graphify update .`. Graphify is for local codebase understanding, not external API documentation.

## Repomix Rule

Use Repomix before asking another AI tool/chat to review the whole repo, before long refactors, or before handoff to another coding tool. Never include secrets in a Repomix bundle.

## Build Order

Follow `docs/PRODUCT_COMPLETION_PLAN.md` for the current phase order. The next planned phases are MetaMask scoped permission proof, real x402 for all specialist agents, 1Shot / ERC-7710 proof for one delegated mission-budget action, delegated authority wired into paid-agent execution, minimal persistence, Venice live finalization, end-to-end runner, then landing/README/deployment hardening.

## Research-Before-Integration Rule

Before coding MetaMask, ERC-7715, ERC-7710, EIP-7702, x402, 1Shot, Venice, Base-specific logic, viem/wagmi, React Flow, Supabase, Playwright, or Next.js App Router behavior:

1. Check existing `docs/research/` notes.
2. Fetch current docs through Context7, official docs, or package source/types.
3. Summarize the relevant API shape.
4. Identify network, token, permission, signing, authentication, and runtime assumptions.
5. Update `docs/research/`.
6. Only then implement the smallest working slice.

## MCP Usage Rule

- Use Context7 or the ctx7 docs workflow for current library/framework documentation.
- Use official sponsor docs when Context7 does not cover the protocol or API.
- Use Playwright MCP for one-off browser exploration and UI inspection.
- Use Playwright CLI/tests for repeatable checks.
- Use Next.js DevTools MCP for Next.js runtime diagnostics after starting the dev server.
- Add Supabase MCP only after the project exists; do not store credentials in repo config.
- Do not add wallet, private-key, or secret-bearing MCPs to this repo.

## Runtime Verification Rule

After UI, API route, Next.js runtime, or browser-visible changes:

1. Run available static checks, normally `pnpm lint` and `pnpm typecheck`.
2. Run tests if configured and safe.
3. Use Playwright MCP or Playwright CLI for browser verification when UI behavior changed.
4. Use Next.js DevTools MCP for runtime errors, route issues, or dev-server diagnostics when available.
5. Do not claim an integration or UI flow works until it has been verified.

## BUILD_LOG Update Rule

Append `docs/BUILD_LOG.md` after every major session. Include what changed, research performed, commands run, validation results, warnings, and the next recommended prompt.

## No-Secrets Rule

- Never commit private keys, API keys, wallet mnemonics, Supabase service keys, or relayer credentials.
- Use `.env.local` for local secrets and `.env.example` for safe variable names.
- Demo flags must not bypass sponsor-critical proof in final demo.

## Quality Rules

- Prefer TypeScript types and small modules.
- Keep placeholder modules explicit and typed.
- Run `pnpm lint` and `pnpm typecheck` before handing off.
- Record major sessions in `docs/BUILD_LOG.md`.
- Do not claim sponsor integrations work until they are implemented and verified.

## UI Rules

- WorkGraph is the hero.
- The WorkGraph must show mission budget, Manager Agent, specialist agents, sub-budgets, x402 payment nodes, 1Shot status, Venice verification, final report, and blocked payment.
- UI should make budget state and payment state immediately visible.
- Avoid positioning the product as a marketplace; show mission-budget auditability first.

## Demo Standard

The final demo must prove:

1. One MetaMask mission budget.
2. One Manager Agent splitting work.
3. One sub-budget/redelegation path.
4. Real x402 payment for Contract Scanner, Wallet Behavior, and Market Context.
5. One 1Shot relay/status.
6. AI planning, verification, and synthesis through the selected provider, with Venice claimed only when `AI_PROVIDER=venice` and live smoke passes.
7. WorkGraph audit trail.
8. One blocked payment failure case.
