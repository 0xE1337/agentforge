# AgentForge — Agent Skill Marketplace on Arc

AI agents autonomously **discover**, **pay for**, and **rate** other agents' skills via Circle Nanopayments (x402 protocol) on Arc Testnet.

**Hackathon**: Agentic Economy on Arc (lablab.ai, April 2026)

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

### Products Used
1. **Circle Nanopayments (x402 Protocol)** — Core payment layer. Every skill call is gated by x402 HTTP 402 → payment signature → settlement. The `@circle-fin/x402-batching` SDK handles the full lifecycle.
2. **Circle Gateway (Batched Settlement)** — GatewayClient batches multiple payment authorizations off-chain and settles them in single on-chain transactions. This is what makes sub-cent payments viable.
3. **Arc Testnet (USDC-native chain)** — Settlement layer. USDC is both the gas token (18 decimals native) and the payment token (6 decimals ERC-20).
4. **Arc Faucet** — Funded test wallets for development and demo.

### What Worked Well
- **GatewayClient DX** — `gateway.pay(url)` is remarkably simple. The 402 negotiation, signature generation, and retry logic are fully abstracted. Going from "I want to pay for this URL" to "here's the response data" is one function call.
- **Batching economics** — In our 80+ transaction demo, each skill call costs $0.001–$0.008 in payment + negligible gas. Traditional per-transaction on-chain settlement would be unviable at these amounts.
- **x402 protocol design** — Using HTTP 402 as the payment trigger is elegant. Standard REST APIs become payable with zero changes to the API design itself — just wrap the handler with `withGateway()`.

### Improvement Suggestions
- **TypeScript types** — The `PayResult<T>` generic works well, but some internal SDK types (`BatchFacilitatorClient.verify/settle` result types) could be more precisely typed.
- **Multi-chain deposit UX** — When an ephemeral wallet needs both native USDC (gas) and ERC-20 USDC (deposit), two separate funding transactions are needed. A single "fund and deposit" helper would streamline agent onboarding.
- **Rate limit visibility** — When hitting the Gateway API rate limit during our 80-txn demo, the error message was generic. A `Retry-After` header or specific rate limit error code would help agents self-pace.
- **Documentation for server-side settlement** — The `BatchFacilitatorClient` (server-side verify/settle) has less documentation than the `GatewayClient` (client-side pay). More examples for the seller side would help.

## Tech Stack

- **Chain**: Arc Testnet (5042002) — stablecoin-native L1
- **Payments**: Circle Nanopayments, x402, `@circle-fin/x402-batching`
- **Contract**: Solidity 0.8.26, Foundry
- **Frontend**: Next.js 16, React 19, shadcn/ui, Tailwind CSS
- **Backend**: Supabase (realtime payment events)
- **AI**: DeepSeek (task decomposition, summarization, sentiment analysis)
- **Agent**: Custom orchestrator with on-chain skill discovery

## License

Apache 2.0 — see [LICENSE](./LICENSE).

This project is built on top of [`circlefin/arc-nanopayments`](https://github.com/circlefin/arc-nanopayments) (Apache 2.0). The starter provides the Next.js scaffolding, x402 middleware (`lib/x402.ts`), Supabase integration, and shadcn UI components. Original work in this repo: the `contracts/` Solidity layer, `app/api/skills/` and `app/api/orchestrator/` endpoints, the orchestrator pipeline (`lib/orchestrator.ts`, `orchestrator.mts`, `demo-runner.mts`), and the dashboard components under `components/dashboard/` (`activity-feed`, `agent-network`, `orchestrator-panel`, `stats-cards`).
