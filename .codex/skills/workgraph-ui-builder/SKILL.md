---
name: workgraph-ui-builder
description: Use when building the WorkGraph UI, mission page, agent cards, payment nodes, event log, or final report UX.
---

The WorkGraph is the hero.

It must show:
- mission budget
- Manager Agent
- specialist agents
- sub-budget edges
- x402 payment nodes
- 1Shot relay status
- Venice verification nodes
- final report node
- blocked payment node

Prefer React Flow when building the graph. Make states visually distinct: planned, running, payment_required, paid, relayed, verified, blocked, failed, completed.

Every node should have inspectable details.
Before using React Flow APIs, check current docs through Context7, official docs, or installed package types.
After implementation, verify UI behavior with Playwright MCP for exploration or Playwright CLI/tests for repeatable checks.
