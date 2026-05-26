# Agent Workflow

Use this workflow for normal Codex or Claude sessions in this repo.

1. Read `AGENTS.md`.
2. Read only the relevant project docs for the task, usually `docs/00_PRODUCT_BRIEF.md`, `docs/02_ARCHITECTURE.md`, and the matching `docs/research/*.md` file.
3. Select the relevant `.codex/skills/*/SKILL.md` skill.
4. Before external integrations, research the current API shape with Context7, official docs, local research notes, package source/types, or MCP tools.
5. Implement one bounded phase. Do not build app features outside the requested phase.
6. Run available checks: `pnpm lint`, `pnpm typecheck`, and tests when configured and safe.
7. For UI or runtime changes, use Playwright MCP for exploration, Playwright CLI/tests for repeatable checks, and Next.js DevTools MCP for Next.js runtime diagnostics when available.
8. Update `docs/BUILD_LOG.md` with changes, commands, warnings, and next prompt.
9. After large architecture phases, run Graphify. Prefer `graphify .` if supported; use `graphify update .` if the installed CLI requires subcommands.
10. Use Repomix when handing the repo to another AI tool or asking for full-repo review.

Do not implement fast-changing external APIs from memory. Do not add secrets.
