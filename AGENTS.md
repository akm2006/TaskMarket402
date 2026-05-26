# TaskMarket402 Agent Constitution

## Project Identity

TaskMarket402 is a Mission Budget WorkGraph for autonomous agent teams. It turns one scoped MetaMask permission into an auditable mission budget that a Manager Agent can split across specialist agents.

## Final Locked Concept

A user creates a Wallet / Token Risk Report mission, grants one scoped MetaMask mission budget, a Manager Agent splits that budget into sub-budgets, specialist agents are paid through x402, at least one ERC-7710/x402 payment is relayed through 1Shot, Venice AI plans/verifies/synthesizes, and the WorkGraph shows every permission, payment, output, and result.

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

1. Setup docs, AGENTS.md, skills, env template, and typed placeholders.
2. Build non-chain mission and WorkGraph MVP with mocks.
3. Implement Venice planning, verification, and synthesis after docs research.
4. Implement real-data specialist agents.
5. Implement x402 402 challenge flow for Contract Scanner first.
6. Implement one MetaMask + ERC-7710 + 1Shot golden path.
7. Harden README, demo script, failure case, and reliability.

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
4. One x402 payment.
5. One 1Shot relay/status.
6. Venice planning, verification, and synthesis.
7. WorkGraph audit trail.
8. One blocked payment failure case.
