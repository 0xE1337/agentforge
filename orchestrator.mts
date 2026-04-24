/**
 * Orchestrator Agent CLI — demonstrates the full Agent Skill Marketplace loop:
 *   1. Read skills from on-chain SkillRegistry (Arc Testnet)
 *   2. Decompose user task via LLM
 *   3. Pay for + call skills in parallel via x402 nanopayments
 *   4. Aggregate results
 */

import { GatewayClient } from "@circle-fin/x402-batching/client";
import {
  createWalletClient,
  createPublicClient,
  http,
  erc20Abi,
  parseUnits,
  parseEther,
} from "viem";
import { arcTestnet } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  orchestrate,
  createLLMClient,
} from "./lib/orchestrator.ts";

// ── Config ─────────────────────────────────────────────────────────────

const funderKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
if (!funderKey) {
  console.error("Missing BUYER_PRIVATE_KEY in .env.local");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY) {
  console.error("Missing OPENAI_API_KEY or DEEPSEEK_API_KEY in .env.local");
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;
const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
const DEPOSIT_AMOUNT = "1";

// ── Sample tasks for demo ──────────────────────────────────────────────

const DEMO_TASKS = [
  "Analyze the security and market position of Uniswap (address 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984), including social sentiment and current token price",
  "Audit the SkillRegistry smart contract and provide a market overview of ETH with social sentiment analysis",
  "Give me a comprehensive report on the current state of DeFi: market data for ETH and BTC, social sentiment around DeFi Summer 2026, and summarize the findings",
];

// ── Wallet Setup ───────────────────────────────────────────────────────

const ephemeralKey = generatePrivateKey();
const ephemeralAccount = privateKeyToAccount(ephemeralKey);
const funderAccount = privateKeyToAccount(funderKey);

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_TESTNET_RPC),
});

const funderWallet = createWalletClient({
  account: funderAccount,
  chain: arcTestnet,
  transport: http(ARC_TESTNET_RPC),
});

async function withNonceRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err as Error).message ?? "";
      const isNonceError =
        msg.includes("replacement transaction underpriced") ||
        msg.includes("nonce too low") ||
        msg.includes("already known");
      if (!isNonceError || attempt === 4) throw err;
      const delay = 1000 + Math.random() * 2000;
      console.log(`  ${label}: nonce collision, retrying...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  const taskArg = process.argv.slice(2).join(" ").trim();
  const task = taskArg || DEMO_TASKS[Math.floor(Math.random() * DEMO_TASKS.length)];

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║          AgentForge Orchestrator — Skill Marketplace        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Step 0: Fund ephemeral wallet
  console.log(`[wallet] Ephemeral agent: ${ephemeralAccount.address}`);
  console.log(`[wallet] Funder: ${funderAccount.address}`);
  console.log("[wallet] Funding ephemeral wallet...");

  const gasTx = await withNonceRetry(
    () => funderWallet.sendTransaction({
      to: ephemeralAccount.address,
      value: parseEther("0.01"),
    }),
    "Gas",
  );
  await publicClient.waitForTransactionReceipt({ hash: gasTx });
  console.log(`[wallet] Gas funded`);

  const usdcTx = await withNonceRetry(
    () => funderWallet.writeContract({
      address: ARC_TESTNET_USDC,
      abi: erc20Abi,
      functionName: "transfer",
      args: [ephemeralAccount.address, parseUnits(DEPOSIT_AMOUNT, 6)],
    }),
    "USDC",
  );
  await publicClient.waitForTransactionReceipt({ hash: usdcTx });
  console.log(`[wallet] ${DEPOSIT_AMOUNT} USDC transferred`);

  // Step 0b: Create GatewayClient and deposit
  const gateway = new GatewayClient({
    chain: "arcTestnet",
    privateKey: ephemeralKey,
  });

  console.log("[wallet] Depositing into Gateway...");
  const deposit = await gateway.deposit(DEPOSIT_AMOUNT);
  console.log(`[wallet] Deposited! TX: ${deposit.depositTxHash.slice(0, 14)}...`);
  const balances = await gateway.getBalances();
  console.log(`[wallet] Gateway balance: ${balances.gateway.formattedAvailable}\n`);

  // Run the full orchestration pipeline (discover → decompose → guard → execute → aggregate → rate).
  // LLM client picks OpenAI primary → DeepSeek fallback from env, with 15s
  // per-provider timeout so a hanging upstream auto-fails over.
  const llm = createLLMClient();

  const outcome = await orchestrate({
    task,
    gateway,
    llm,
    baseURL: BASE_URL,
    account: ephemeralAccount,
    guardAgent: funderAccount,
    onStep: (step, detail) => {
      const labels: Record<string, string> = {
        discovery: "Step 1: On-Chain Skill Discovery",
        decompose: "Step 2: LLM Task Decomposition",
        guard: "Step 3: PaymentGuard Safety Check",
        execute: "Step 4: Parallel x402 Skill Execution",
        fees: "Step 5: Revenue Split Recording",
        aggregate: "Step 6: Result Aggregation",
        rate: "Step 7: On-Chain Skill Rating",
      };
      const label = labels[step] ?? step;
      if (detail.startsWith("Found") || detail.startsWith("Selected") || detail.includes("succeeded") || detail.includes("rated") || detail.startsWith("Approved") || detail.startsWith("BLOCKED") || detail.includes("splits recorded")) {
        console.log(`\n━━━ ${label} ━━━`);
      }
      console.log(`  ${detail}`);
    },
  });

  // Print aggregated result
  console.log("\n━━━ Aggregated Result ━━━");
  console.log(outcome.aggregation);

  // Print ratings
  if (outcome.ratings && outcome.ratings.length > 0) {
    console.log("\n━━━ On-Chain Ratings ━━━");
    for (const r of outcome.ratings) {
      const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
      const tx = r.txHash === "already-rated" ? "(already rated)" : r.txHash.slice(0, 14) + "...";
      console.log(`  ${r.name}: ${stars} — ${tx}`);
    }
  }

  // Summary
  console.log("\n━━━ Summary ━━━");
  console.log(`  Task: ${task.slice(0, 80)}...`);
  console.log(`  Skills used: ${outcome.results.filter((r) => r.success).length}/${outcome.results.length}`);
  console.log(`  Total cost: $${outcome.totalCost}`);
  console.log(`  On-chain ratings: ${outcome.ratings?.filter((r) => r.txHash !== "already-rated").length ?? 0}`);
  console.log(`  PaymentGuard: budget $${outcome.guard?.budgetBefore ?? "N/A"} → $${outcome.guard?.budgetAfter ?? "N/A"}`);
  console.log(`  Full loop: discover → decompose → guard → pay → aggregate → rate`);

  // Cleanup — withdraw remaining balance
  try {
    const remaining = await gateway.getBalances();
    if (remaining.gateway.available > 0n) {
      console.log(`\n[wallet] Withdrawing remaining ${remaining.gateway.formattedAvailable}...`);
      await gateway.withdraw(remaining.gateway.formattedAvailable);
      console.log("[wallet] Withdrawn.");
    }
  } catch {
    // Non-critical, ignore
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
