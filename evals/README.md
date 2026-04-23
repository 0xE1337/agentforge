# Evals

Behavior-level evals for the orchestrator. These are **not** unit tests — they describe prompts/tasks the orchestrator should handle and the invariants the response must satisfy. They document expected agent behavior and serve as regression anchors when we swap LLMs or tune the task-decomposition prompt.

Run mode is captured per-file. Current inventory:

| File | What it exercises | Mode |
|------|-------------------|------|
| `orchestrator-routing.jsonl` | Task → Skill routing correctness for the 5 on-chain skills | manual / CI-smoke |
| `payment-loop.md` | End-to-end x402 payment-loop invariants | manual (needs funded testnet wallet) |

## How to run (manual)

```bash
# Routing eval: score which skills the orchestrator picks for each input task
npm run orchestrator -- "$(jq -r '.input' evals/orchestrator-routing.jsonl | head -1)"

# Full payment-loop eval: requires Arc Testnet wallet with >= 1 USDC
ARC_CHAIN_ID=5042002 npm run demo
```

## Scoring conventions

- **Routing**: exact-match on the `expected_skills` set, plus ordering tolerance (set equality, not list equality).
- **Payment loop**: hard gates — every request must produce a settled on-chain tx within 30s, and the aggregate cost must stay ≤ $0.01 per user task. Regressions block the demo.

## Adding a new eval case

1. Append a JSONL row to `orchestrator-routing.jsonl` with `{ input, expected_skills, rationale }`.
2. Keep `rationale` short — it documents *why* this routing is correct, so future-you can tell signal from noise when the orchestrator deviates.
3. Do not add cases that depend on random LLM output unless you also add the tolerance rules in the scoring section above.
