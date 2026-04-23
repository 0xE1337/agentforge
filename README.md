# AgentForge — Agent Skill Marketplace on Arc

AI agents autonomously **discover**, **pay for**, and **rate** other agents' skills via Circle Nanopayments (x402 protocol) on Arc Testnet.

**Live demo**: https://agentforge-e1337.vercel.app
**Repository**: https://github.com/0xE1337/agentforge
**Hackathon**: Agentic Economy on Arc (lablab.ai, April 2026)
**Submission Track**: Agent-to-Agent Payment Loop
**Circle products used**: Nanopayments (x402), Circle Gateway (batched settlement), Arc Testnet (USDC-native L1), Arc Faucet

> **Why this track fits**: AgentForge is a multi-agent system in which an Orchestrator Agent autonomously decides which Skill Agents to call, pays each one via x402 without human approval, and rates them on-chain after the call completes. Every payment is initiated by an agent, not a user click — which is the defining characteristic of the Agent-to-Agent Payment Loop track. A single user task triggers ~10 on-chain payments across the 7-step pipeline, naturally exceeding the 50+ transaction requirement.

## What It Does

An on-chain **SkillRegistry** contract stores AI skills with pricing, metadata, and reputation scores. An **Orchestrator Agent** reads the registry, uses an LLM to decompose tasks into skill calls, pays for each skill via x402 nanopayments, aggregates results, and rates the skills on-chain.

**Full autonomous loop**: Discover → Decompose → Pay → Execute → Aggregate → Rate

## Architecture

```
                        ┌──────────────────┐
                        │  SkillRegistry   │  (Arc Testnet)
                        │  5 skills, rated │
                        └────────┬─────────┘
                                 │ read on-chain
                        ┌────────┴─────────┐
                        │   Orchestrator   │  (LLM: DeepSeek)
                        │  task decompose  │
                        └───┬───┬───┬──────┘
                   x402 pay │   │   │ x402 pay
              ┌─────────────┘   │   └──────────────┐
              ▼                 ▼                   ▼
     ┌──────────────┐  ┌──────────────┐   ┌──────────────┐
     │Chain Analyzer│  │ Social Intel │   │  Summarizer  │
     │   $0.005     │  │   $0.003     │   │   $0.001     │
     └──────────────┘  └──────────────┘   └──────────────┘
```

## Skill Catalog (On-Chain)

| # | Skill | Price | Tags | Endpoint |
|---|-------|-------|------|----------|
| 1 | Chain Analyzer | $0.005 | blockchain, analysis | `/api/skills/chain-analyzer` |
| 2 | Social Intel | $0.003 | social, intelligence | `/api/skills/social-intel` |
| 3 | Market Data | $0.002 | market, data | `/api/skills/market-data` |
| 4 | Code Auditor | $0.008 | security, audit | `/api/skills/code-auditor` |
| 5 | Summarizer | $0.001 | text, summary | `/api/skills/summarizer` |

Social Intel and Summarizer use real LLM calls (DeepSeek); others return structured mock data.

## Quick Start

```bash
npm install
npm run dev              # Start Next.js dev server
npm run orchestrator "Audit SkillRegistry and analyze DeFi sentiment"
npm run demo             # Fire 80+ x402 transactions
npm run agent            # Simple payment loop
```

## Margin Viability: Why Arc?

This project is **only economically viable on Arc**:

| | Traditional L1/L2 | Arc Testnet |
|---|---|---|
| Gas per txn | $0.02 – $0.50 | ~$0.001 (stablecoin-native) |
| Our cheapest skill | $0.001 (Summarizer) | $0.001 (Summarizer) |
| Gas-to-payment ratio | **2x–500x** (gas > payment) | **~1:1** (gas ≈ payment) |
| Viable for nanopayments? | No — gas exceeds the payment | **Yes** — margins preserved |

On Ethereum L1, a $0.001 payment would cost $0.50+ in gas — **500x the payment itself**. Even on L2s like Arbitrum/Base, gas is $0.01–0.05, still wiping out sub-cent margins. Arc's stablecoin-native architecture (USDC as gas token, sub-cent settlement) is the only environment where an agent paying $0.001 for a skill makes economic sense.

Additionally, Circle Gateway batches off-chain payment authorizations into single on-chain settlements, further amortizing costs. The agent never directly pays gas — the Gateway handles it.

## Contract

- **SkillRegistry**: [`0x27853b1D8c6E38A86B99597A2e5334c15F532f21`](https://testnet.arcscan.app/address/0x27853b1D8c6E38A86B99597A2e5334c15F532f21)
- **Network**: Arc Testnet (Chain ID: 5042002)
- **Features**: Register skills, update pricing, rate skills (1-5), governor emergency deactivation

## Circle Product Feedback

This feedback draws on hands-on experience: we built the AgentForge marketplace end-to-end on Arc Testnet, deployed three contracts, ran 119 successful x402 payment events through the Gateway, executed full 7-step orchestration loops where AI agents autonomously discovered, paid for, and rated other agents — and recorded both wins and friction along the way.

### Products Used (and why each was non-substitutable)

1. **Circle Nanopayments (x402 Protocol)** — the core payment layer. Every skill call is gated by `HTTP 402` → `PAYMENT-SIGNATURE` → settlement. The `@circle-fin/x402-batching` SDK handles the full lifecycle. We chose x402 specifically because it is the only protocol that lets a standard REST API become payable with **zero changes to the route shape itself** — wrapping the handler with `withGateway()` is the entire integration. Stripe-style sessions would require redirecting agents through hosted checkouts; on-chain payment channels would require state-channel management. x402 maps cleanly onto how an agent already speaks to APIs (HTTP).

2. **Circle Gateway (Batched Settlement)** — `GatewayClient` batches multiple off-chain payment authorizations into single on-chain settlements. This is what makes sub-cent payments economically viable. Without batching, each $0.001 call would trigger an independent on-chain tx and the gas-to-payment ratio would still be punishing even on Arc. Gateway is the unsung hero — it is what turns x402 from "cute idea" into "actual production economics".

3. **Arc Testnet (USDC-native L1)** — the settlement layer. USDC is both the gas token (native, 18 decimals) and the payment token (ERC-20, 6 decimals). The unification means an agent's wallet math is simple: one token, two precisions, no swaps. ~0.5s finality means the orchestrator can pay-then-call-then-rate inside a single user-facing request without staring at "pending" spinners. We tried earlier prototypes against Sepolia and Arbitrum Sepolia: the moment we wanted parallel sub-cent calls, both fell over economically. Arc is the only chain where the architecture in the README (cheapest skill at $0.001) is even legal, let alone practical.

4. **Arc Faucet** — funded ephemeral and persistent wallets throughout development. The 10 USDC/claim cap is generous given typical per-tx cost; we burned through ~3 USDC across 119 demo transactions and a dozen full orchestrator loops, including 3 contract deployments + dozens of `rateSkill` / `recordPayment` writes. Without the faucet our team would have stalled.

### What Worked Exceptionally Well

- **`gateway.pay(url)` ergonomics.** One function call. The 402 negotiation, signature generation, retry, batch-time selection, and settlement are all internal. We literally built the orchestrator's payment step as `Promise.all(plan.skills.map(s => gateway.pay(`${baseURL}${s.endpoint}`, { method: "POST", body: s.payload })))`. Five parallel paid calls in a single line — this is the SDK at its best.

- **Batching economics in real numbers.** Across our 119 settled transactions, the per-call payment cost ranged $0.001–$0.008 with negligible gas overhead. The same workload on Ethereum L1 would have cost ~$60 in gas alone (≈ $0.50 × 119); on a typical L2, ≈ $1.20 (≈ $0.01 × 119). On Arc with Gateway batching, our actual gas spend was a small fraction of one cent total. This is a 100×–1000× improvement and it makes a market structure (the Skill Marketplace) viable that is structurally impossible elsewhere.

- **HTTP 402 as the trigger is genuinely elegant.** Existing REST APIs, OpenAPI specs, retry tooling, and HTTP middleware all "just work" with x402. Our 5 skill endpoints kept their normal `POST` handlers; only one wrapper line changed. This is the cleanest primitive design we have seen in this space — it composes with everything in the modern web stack instead of asking developers to abandon it.

- **Sub-second finality unlocks the agent UX.** Our 7-step orchestration loop (discover → decompose → guard → execute → fees → aggregate → rate) completes in ~30 seconds wall clock for a 3-skill task. Of that, the on-chain steps (PaymentGuard checkAndRecord ×3, MarketplaceFee recordPayment ×3, rateSkill ×3) account for under 5 seconds total. An equivalent loop on a chain with 12s blocks would fold in 30+ seconds of just-waiting per task — agents would feel sluggish to humans and the UX would die.

- **The mental model "agent never directly pays gas" is the right abstraction.** Because Gateway intermediates settlement, the agent code never thinks about gas estimation, EIP-1559 priority fees, or nonce management for payment txs. It only thinks about USDC. This is how an agent should reason about money — the same way a human thinks "I paid $5", not "I paid $5 plus a 0.000003 BTC miner fee".

### Concrete Improvement Suggestions

These are the friction points we hit while shipping, ranked by how much faster the next builder would move if they were fixed.

1. **Combined "fund + deposit" helper for ephemeral wallets.** Today, spawning a fresh agent wallet requires three separate transactions: (a) send native USDC for gas, (b) `transfer` ERC-20 USDC for the deposit, (c) `gateway.deposit(amount)`. Each one waits for a receipt. Our `orchestrator.mts` has a `withNonceRetry` wrapper just to handle the timing collisions between (a) and (b). A `gateway.fundAndDeposit(account, amount)` helper that bundles the three would save ~10 seconds of latency per ephemeral wallet creation and remove the nonce-collision class of bugs from agent code entirely.

2. **Tighter TypeScript types on `BatchFacilitatorClient`.** `verify()` and `settle()` return shapes are loosely typed (we ended up reading them as `unknown` and narrowing manually). The client-side `PayResult<T>` generic is great; the server-side equivalents deserve the same treatment. Specifically: `SettleResult` should expose `transaction: \`0x${string}\``, `payer: \`0x${string}\``, and a discriminated union for success vs partial-failure cases.

3. **Rate-limit visibility.** During our 80+ tx demo we hit Gateway API rate limits. The error returned a generic 429 with an opaque message — no `Retry-After` header, no error code we could pattern-match against. Agents that self-pace based on rate-limit signals (the polite default) cannot do so today. A typed error class like `GatewayRateLimitError` with `retryAfterMs: number` would let agent runtimes implement backoff cleanly.

4. **Server-side documentation parity.** `GatewayClient` (client/buyer side) is well-documented; `BatchFacilitatorClient` (server/seller side, used inside `withGateway()`) is much sparser. Most developers building "marketplace of services" patterns are on the seller side. A worked example showing `verify` → `settle` → record-to-database → respond, with error-handling for partial settlement, would meaningfully unblock that audience.

5. **Build-time module evaluation friction.** Frameworks like Next.js evaluate API route modules at build time to collect page metadata. Any module-level instantiation that depends on runtime secrets crashes the build (we hit this with our Supabase client inside `lib/x402.ts`). A pattern we'd love to see in Circle SDK examples: *defer all client construction to first request* (lazy init), so that build-time CI without secrets doesn't blow up. This is documentation/example shape, not a code change to the SDK.

6. **First-class agent-spend primitives.** We had to build `PaymentGuard.sol` ourselves to express "this agent may spend at most $0.10 per hour, only on these specific skills, and a governor can emergency-stop everything". This is generic infrastructure that every serious agent-economy app will reinvent. A Circle-blessed `SpendingPolicy` contract or off-chain Gateway-level policy primitive (declarative caps + allowlist) would be widely used.

7. **Skill / service discovery standard.** We built `SkillRegistry.sol` because we needed an on-chain catalog. The pattern (registry of x402 endpoints with metadata + ratings) is something many marketplace projects will want. Even a non-binding ERC-style schema for "x402 service registry" entries (name, endpoint, price, tags, rating, owner) would let agents traverse multiple marketplaces interoperably instead of being siloed per-app.

8. **Settlement events via WebSocket / SSE.** Our dashboard polls Supabase for settlement events because we don't have a push channel from Gateway. A WebSocket or SSE feed of settlement events for a given seller (`gateway.subscribeToSettlements(sellerAddress)`) would let dashboards and accounting systems stay live without pulling from a database mirror.

### Net Verdict

x402 + Gateway + Arc is the first stack we have used where building an autonomous agent economy was an actual day-of-shipping engineering exercise rather than a year-of-research one. The primitives compose, the economics work, and the SDK gets out of the way. Every friction listed above is about **speed of next adopter**, not about whether the products are correct — they are. We will keep building on this stack regardless of hackathon outcome.

## Tech Stack

- **Chain**: Arc Testnet (5042002) — stablecoin-native L1
- **Payments**: Circle Nanopayments, x402, `@circle-fin/x402-batching`
- **Contract**: Solidity 0.8.26, Foundry
- **Frontend**: Next.js 16, React 19, shadcn/ui, Tailwind CSS
- **Backend**: Supabase (realtime payment events)
- **AI**: DeepSeek (task decomposition, summarization, sentiment analysis)
- **Agent**: Custom orchestrator with on-chain skill discovery

## License

**MIT** — see [LICENSE](./LICENSE).

This project incorporates code from [`circlefin/arc-nanopayments`](https://github.com/circlefin/arc-nanopayments), which is licensed under Apache 2.0. The starter provides the Next.js scaffolding, x402 middleware (`lib/x402.ts`), Supabase integration, and shadcn UI components — those files retain their original Apache 2.0 license per the [NOTICE](./NOTICE) file.

Original work in this repo (MIT-licensed): the `contracts/` Solidity layer (SkillRegistry, PaymentGuard, MarketplaceFee), `app/api/skills/` and `app/api/orchestrator/` endpoints, the orchestrator pipeline (`lib/orchestrator.ts`, `lib/llm.ts`, `lib/contracts.ts`, `orchestrator.mts`, `demo-runner.mts`), and the dashboard components under `components/dashboard/` (`activity-feed`, `agent-network`, `orchestrator-panel`, `stats-cards`), plus `components/login-card.tsx` and `components/skill-catalog.tsx`.
