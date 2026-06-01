# IA Review Profiles

This directory contains the canonical IA-to-checklist routing map for remediation work.

## Files

- [ia-review-profile-map.json](./ia-review-profile-map.json): all 34 current IA entries, route metadata, required packs, specialist routing, required evidence, human confirmation flags, and deferred-scope guards.

## Rules

- The profile map is an orchestration aid. It does not replace `docs/sitemap.md`, `docs/Wireframe/README.md`, or [ia-page-implementation-verification.md](../../../ai-workflow/ia-page-implementation-verification.md).
- IA execution agents must copy the matching profile row into their task packet.
- If the profile map conflicts with active source docs, record `DOC-GAP` and update the profile map only through an explicit docs change.
- `requiredSpecialists` is the minimum routing set for the IA item. The IA execution agent may call more specialists when evidence reveals new risk.
- `humanConfirmationRequired` means AI-generated notes are not enough for closure.
