# Eval: x402 payment-loop invariants

End-to-end invariants the payment loop must satisfy. Run against `npm run demo` on a funded Arc Testnet wallet.

## Invariants

1. **402 → signature → settlement**. Every skill call produces exactly one HTTP 402 response, exactly one `PAYMENT-SIGNATURE` header, and exactly one settled on-chain tx. No dangling authorizations.
2. **Per-call cost**. Each skill call costs its listed price ± $0.0001 USDC. Deviations imply broken pricing or a fee-model bug.
3. **Per-task cost cap**. A single user task must not spend more than $0.01 USDC total across all skill calls in its plan.
4. **On-chain settlement**. All payments settle on Arc (Chain ID `5042002`). No fallback chains.
5. **Transaction count**. `npm run demo` produces ≥ 50 on-chain transactions end-to-end. This is the hackathon minimum.
6. **Idempotency**. Re-running the same task does not double-spend — each planned skill call settles at most once per task id.

## Pass/fail

- All six invariants pass → `PASS`.
- Any invariant fails → `FAIL`, with the failing tx hash or request id recorded.

## How to record a run

```bash
DEMO_RUN_ID=$(date +%s) npm run demo 2>&1 | tee evals/runs/demo-$DEMO_RUN_ID.log
```

Write a one-line summary into `evals/runs/LOG.md` with: date, run id, tx count, total USDC spent, PASS/FAIL per invariant.
