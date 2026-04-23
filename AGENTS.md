# AGENTS.md — AgentForge

Project-rooted instructions for Claude Code and other coding agents working in this repo. Trust this file over README scaffolding when they disagree about *how* to work inside the codebase.

## What this repo is

**AgentForge** is an on-chain Agent Skill Marketplace on Arc Testnet. An Orchestrator Agent reads a `SkillRegistry` contract, decomposes a user task into skill calls via an LLM (DeepSeek), pays each skill via Circle Nanopayments / x402, aggregates results, and rates the skills on-chain. Every payment is agent-initiated, not user-click — the defining property of the "Agent-to-Agent Payment Loop" track.

Stack:

- **Framework**: Next.js 16 (App Router) + React 19
- **Contracts**: Solidity 0.8.26 in `contracts/`, built with Foundry (Cancun EVM)
- **Payments**: `@circle-fin/x402-batching`, `@x402/core`, `@x402/evm`
- **Agent**: Custom orchestrator in `orchestrator.mts` + `lib/orchestrator.ts`, using `deepagents` + LangChain OpenAI wrapper against DeepSeek
- **Chain RPC**: Arc Testnet (Chain ID `5042002`, RPC `https://rpc.testnet.arc.network`)
- **DB**: Supabase (realtime payment events)
- **UI**: shadcn/ui + Tailwind v4

## Entry points you will actually touch

| Path | Role |
|------|------|
| `app/page.tsx` | Landing page |
| `app/dashboard/page.tsx` | Live orchestrator + transaction dashboard |
| `app/api/orchestrator/route.ts` | Server endpoint: task → skill calls → on-chain rate |
| `app/api/skills/*/route.ts` | The 5 x402-gated skill endpoints |
| `orchestrator.mts` | Node entrypoint — runs the orchestrator from the CLI |
| `demo-runner.mts` | Fires 80+ x402 transactions for the demo |
| `agent.mts` | Simpler single-agent payment loop |
| `lib/orchestrator.ts` | Task-decompose → skill discovery → parallel pay/call → aggregate |
| `lib/contracts.ts` | viem reads/writes against `SkillRegistry` |
| `lib/llm.ts` | DeepSeek wrapper (via LangChain OpenAI compat) |
| `contracts/src/` | `SkillRegistry.sol`, `PaymentGuard.sol`, `MarketplaceFee.sol` |
| `components/dashboard/` | `stats-cards`, `activity-feed`, `agent-network`, `orchestrator-panel` |

## Commands

```bash
npm install

# Next.js app
npm run dev                                         # http://localhost:3000
npm run build
npm run lint

# Agent / orchestrator (require .env.local)
npm run agent
npm run orchestrator "Audit SkillRegistry and analyze DeFi sentiment"
npm run demo                                        # 80+ x402 transactions

# Contracts (from ./contracts)
cd contracts && forge build
cd contracts && forge test
```

Use `--experimental-transform-types --no-warnings` flags — these `.mts` files rely on Node's native TS transform; do not convert to `.ts` compiled by tsc.

## Environment

Secrets live in `.env.local` (gitignored). Copy from `.env.example` and fill in. Required keys:

- Arc RPC / chain config
- Buyer wallet private key (funded with USDC on Arc Testnet)
- Skill seller wallet(s)
- Supabase URL + anon/service keys
- DeepSeek API key (OpenAI-compatible base URL)

Faucet: `https://faucet.circle.com` (Arc Testnet, 10 USDC per claim). Explorer: `https://testnet.arcscan.app`.

## Deployed addresses (Arc Testnet, Chain ID 5042002)

- **SkillRegistry**: `0x27853b1D8c6E38A86B99597A2e5334c15F532f21`
- **PaymentGuard**: `0x80a5FfE02BFB34dF0C05541c47b77182391bE3B1`
- **Arc Testnet USDC (ERC-20)**: `0x3600000000000000000000000000000000000000` (6 decimals)
- Arc's native USDC gas token: 18 decimals

## Conventions

- **TypeScript strict** (`tsconfig.json`); ES module style everywhere (`.ts`, `.tsx`, `.mts`)
- **Path alias**: `@/*` → project root
- **UI**: prefer composing shadcn primitives under `components/ui/`; new dashboard widgets go under `components/dashboard/`
- **Client vs server**: App Router defaults to server components. Only add `"use client"` when you need hooks, state, or browser-only APIs. The orchestrator and contract reads must stay server-side — they use private keys.
- **Commits**: Conventional prefix (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`). Attribution is globally suppressed per user settings — don't add `Co-authored-by` lines.
- **No mutation**: prefer new objects over in-place mutation (see `.claude/rules/coding-style.md`).

## Hackathon constraints that override normal judgment

- **Per-action pricing must stay ≤ $0.01 USDC**. If you add a new skill, keep its price in that bucket.
- **All payment-bearing transactions must settle on Arc**. Do not add fallback chains.
- **Demo must produce 50+ on-chain transactions** — `demo-runner.mts` is the source of truth; do not regress the transaction count.
- **Deadline**: submission on 2026-04-25. Bias toward shipping over refactor until that ships.

## What to NOT do

- Do not commit `.env*` files, deployed keystores under `contracts/script/deployments/`, or anything in `.next/`. `.gitignore` is authoritative.
- Do not move or rename `SkillRegistry` — it is deployed at the address above and the frontend + orchestrator read from it directly.
- Do not swap the agent runtime from DeepSeek without also updating `lib/llm.ts` and the cost model in the README.
- Do not animate layout-bound CSS properties (`width`, `height`, `top`, `margin`). Use `transform`, `opacity`, `clip-path` only. See `.claude/rules/coding-style.md`.

## Skills / rules available to agents

Project-local skills live under `.claude/skills/` (35 of them, from the ECC core bundle) and rules under `.claude/rules/`. Notable ones for this project:

- `search-first` — mandatory research-before-code workflow
- `tdd-workflow` — TDD for new logic
- `verification-loop` — post-change verification
- `security-review` — any change touching wallet keys, x402 signatures, or contract calls
- `frontend-design` + `frontend-patterns` — dashboard work
- `deep-research` + `exa-search` — x402 / Arc / LangChain research

See `.claude/rules/code-review.md` for the review checklist and severity ladder.
