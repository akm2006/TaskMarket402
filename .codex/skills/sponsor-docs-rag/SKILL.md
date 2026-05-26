---
name: sponsor-docs-rag
description: Use before coding MetaMask, x402, 1Shot, Venice, Base, viem/wagmi, Supabase, ERC-7715, ERC-7710, or EIP-7702 integrations.
---

Use this before coding MetaMask, x402, 1Shot, Venice, Base, viem/wagmi, Supabase, ERC-7715, ERC-7710, EIP-7702, or any sponsor/API integration.

Before implementation:
1. Check existing `docs/research/*.md` notes.
2. Use Context7 when it covers the package or framework.
3. Use official docs when Context7 does not cover the sponsor API or protocol.
4. Check installed package source/types when useful.
5. Summarize exact API shape, package names, request/response shape, network support, payment assets, signing, auth, and failure states.
6. Update the relevant `docs/research/*.md` file with findings and known uncertainty.
7. Implement the smallest working slice.

Do not guess APIs from memory.
Do not paste secrets into code, docs, or logs.
