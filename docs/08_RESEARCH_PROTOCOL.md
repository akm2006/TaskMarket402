# Research Protocol

Use this flow before implementing any fast-changing external API, SDK, protocol, chain configuration, package API, or sponsor integration.

1. Identify the external API, protocol, SDK, package, or runtime behavior.
2. Check existing `docs/research/` notes.
3. Use Context7 if library or framework docs are available there.
4. Use official online docs for sponsor APIs, protocols, and chain-specific requirements not covered by Context7.
5. Check installed package types or source when useful.
6. Write a short API-shape summary before coding. Include package names, functions, request/response shape, network/token assumptions, auth, signing, and failure states.
7. Record findings in `docs/research/<topic>.md`.
8. Only then implement the smallest working slice.
9. Add uncertainty and fallback notes if docs are incomplete or disagree.

Research notes must distinguish verified current facts from assumptions.
