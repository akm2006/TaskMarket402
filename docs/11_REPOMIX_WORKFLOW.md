# Repomix Workflow

Repomix packs the repo into an AI-friendly context bundle for external review or handoff.

## Run

```bash
npx repomix
```

or:

```bash
pnpm dlx repomix
```

## Use Before

- External ChatGPT, Claude, or Gemini repo review.
- Long refactors.
- Handoff to another coding tool.

## Exclude

- `.env`
- `.env.local`
- `node_modules`
- `.next`
- `graphify-out` unless explicitly needed
- Private keys, wallet mnemonics, API keys, service role keys, and relayer credentials

Repomix respects `.gitignore`; review generated bundles before sharing.
