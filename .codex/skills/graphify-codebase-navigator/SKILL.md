---
name: graphify-codebase-navigator
description: Use before large refactors, cross-file debugging, architecture changes, or codebase structure analysis.
---

Use Graphify for local repo structure and cross-file relationships.

Workflow:
1. Read `AGENTS.md`.
2. Read `graphify-out/GRAPH_REPORT.md` if it exists.
3. If Graphify is not installed, document install steps from `docs/10_GRAPHIFY_WORKFLOW.md`.
4. For large architecture phases, run `graphify .` if available. If the installed CLI reports `unknown command '.'`, run `graphify update .`.
5. Use Graphify findings to focus file reads and avoid broad, noisy scans.

Do not treat Graphify as a replacement for Context7, official docs, sponsor docs, or package source/types.
