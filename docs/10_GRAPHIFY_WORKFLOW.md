# Graphify Workflow

Graphify is for local repo structure, dependency relationships, and cross-file understanding. It is not a replacement for Context7, official docs, or sponsor API research.

## Install Options

```bash
uv tool install graphifyy
pipx install graphifyy
pip install graphifyy
```

The package name is `graphifyy`; the CLI command is `graphify`.

## Setup

```bash
graphify install --project --platform codex
```

## Run

```bash
graphify .
```

PowerShell note: use `graphify .`, not `/graphify .`.

Verified local fallback: the installed CLI in this repo may require subcommands. If `graphify .` reports `unknown command '.'`, run:

```bash
graphify update .
```

## Expected Outputs

- `graphify-out/graph.html`
- `graphify-out/GRAPH_REPORT.md`
- `graphify-out/graph.json`

## Repo Rule

Read `graphify-out/GRAPH_REPORT.md` before large refactors if it exists. Run `graphify .` after large architecture phases if the CLI supports it; otherwise run `graphify update .`.
