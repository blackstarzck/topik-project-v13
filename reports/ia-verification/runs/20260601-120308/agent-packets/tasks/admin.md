## Task Packet

- Agent: phase5-prod-rerun (practice-writing=wf_542a55f0-9fe; onboarding/feedback/library/admin=wf_91800358-d3f; public-auth reused from wf_f27db2eb-29f, evidence-stable)/admin
- Role: IA-first UX shard reviewer (admin)
- Objective: Review assigned IA screens against docs/IA descriptions, source, collected evidence, and screenshots; recommend labels (cannot finalize PASS).
- Audience: admin
- Accepted scope: IA codes H-01, X-08, X-10
- Out of scope: finalizing PASS, editing product source, editing JSON evidence.
- Docs consulted: docs/ai-workflow/ia-ai-first-ux-review-checklist.md, docs/IA/*/description.md for owned IA.
- Exact read scope: reports/ia-verification/runs/20260601-120308/phase5-evidence-digest.json, docs/IA/**, src/app/**, src/components/**, screenshots/**.
- Exact write scope: result packet only (returned via workflow result, imported by coordinator).
- Required verification: read screenshots to verify CTA/state claims; apply checklist 6.1-6.9 + section 9 no-pass rules.
- Expected output: one IA review card per owned IA (schema-validated).
- Context ledger path: docs/ai-workflow/runs/2026/06/01/20260601-1203-ia-full-audit-run.md
