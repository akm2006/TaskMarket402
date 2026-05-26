# MCP And Tools

## Use Now

- Context7 MCP or ctx7 docs workflow for current library and framework docs.
- Playwright MCP for exploratory browser checks.
- Next.js DevTools MCP for Next.js runtime diagnostics and docs-aware debugging.
- Graphify for local repo structure and cross-file relationships.
- Repomix for portable full-repo AI review bundles.

## Use Later

- Supabase MCP after a Supabase project exists and credentials are handled safely.
- GitHub MCP only if PR, issue, or workflow automation is needed.

## Prefer CLI When Easier

- `git` and `gh`.
- `pnpm`.
- Playwright tests or CLI for repeatable browser verification.
- Supabase CLI after Supabase is added.
- Railway or Vercel CLI for deployment workflows.

## Avoid Now

- Random memory MCPs.
- Multi-agent orchestration MCPs.
- Wallet, private-key, or signing MCPs.
- Tools requiring secrets in repo config.
- Redundant MCPs when the CLI is simpler and more reliable.

## Current Command References

- Context7 local MCP: `npx -y @upstash/context7-mcp@latest`.
- Playwright MCP: `npx @playwright/mcp@latest`.
- Next.js DevTools MCP: `npx -y next-devtools-mcp@latest`.

Verify exact command and client config if the environment differs. Do not store API keys or tokens in repo config.
