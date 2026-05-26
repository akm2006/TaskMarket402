---
name: runtime-verification
description: Use after UI, API, Next.js runtime, browser, or integration changes that need verification.
---

Verification workflow:
1. Run `pnpm lint` and `pnpm typecheck` when available.
2. Run tests if configured and safe.
3. Use Next.js DevTools MCP if available for Next.js runtime errors, routes, logs, and debugging.
4. Use Playwright MCP for exploratory browser checks.
5. Use Playwright CLI/tests for repeatable verification.
6. Update `docs/BUILD_LOG.md` with commands, results, errors, warnings, and next prompt.

Do not claim a flow works until it has been verified.
