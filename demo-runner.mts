/**
 * Demo Runner — fires 80+ x402 transactions across all 5 skill endpoints.
 * Run: npm run demo
 *
 * Uses 2 concurrent ephemeral wallets for throughput while staying under
 * rate limits. Each wallet cycles through all 5 endpoints.
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

const funderKey = process.env.BUYER_PRIVATE_KEY as `0x${string}`;
if (!funderKey) { console.error("Missing BUYER_PRIVATE_KEY"); process.exit(1); }

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;
const RPC = "https://rpc.testnet.arc.network";
const DEPOSIT = "2"; // 2 USDC per wallet
const TARGET_TXNS = 85;
const CONCURRENCY = 2; // parallel wallets

const ENDPOINTS = [
  { url: `${BASE_URL}/api/skills/chain-analyzer`, body: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" } },
  { url: `${BASE_URL}/api/skills/social-intel`, body: { query: "DeFi agent economy 2026" } },
  { url: `${BASE_URL}/api/skills/market-data`, body: { symbol: "ETH" } },
  { url: `${BASE_URL}/api/skills/code-auditor`, body: { contract: "SkillRegistry.sol" } },
  { url: `${BASE_URL}/api/skills/summarizer`, body: { text: "The Agent Skill Marketplace enables autonomous AI agents to discover and pay for skills on-chain. Built with Circle Nanopayments on Arc." } },
];

const funderAccount = privateKeyToAccount(funderKey);
const publicClient = createPublicClient({ chain: arcTestnet, transport: http(RPC) });
const funderWallet = createWalletClient({ account: funderAccount, chain: arcTestnet, transport: http(RPC) });

let totalCompleted = 0;
let totalFailed = 0;
let totalSpent = 0;
const startTime = Date.now();

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let i = 0; i < 5; i++) {
    try { return await fn(); }
    catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("nonce too low") || msg.includes("already known") || msg.includes("underpriced")) {
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${label}: max retries`);
}

async function setupWallet(id: number): Promise<GatewayClient> {
  const key = generatePrivateKey();
  const account = privateKeyToAccount(key);
  console.log(`[wallet-${id}] ${account.address}`);

  // Fund gas
  const gasTx = await withRetry(
    () => funderWallet.sendTransaction({ to: account.address, value: parseEther("0.02") }),
    `gas-${id}`,
  );
  await publicClient.waitForTransactionReceipt({ hash: gasTx });

  // Fund USDC
  const usdcTx = await withRetry(
    () => funderWallet.writeContract({
      address: ARC_USDC, abi: erc20Abi, functionName: "transfer",
      args: [account.address, parseUnits(DEPOSIT, 6)],
    }),
    `usdc-${id}`,
  );
  await publicClient.waitForTransactionReceipt({ hash: usdcTx });

  const gw = new GatewayClient({ chain: "arcTestnet", privateKey: key });
  await gw.deposit(DEPOSIT);
  console.log(`[wallet-${id}] Funded & deposited ${DEPOSIT} USDC`);
  return gw;
}

async function runWorker(gw: GatewayClient, id: number, txnsPerWorker: number) {
  let idx = 0;
  let consecutiveErrors = 0;

  for (let i = 0; i < txnsPerWorker; i++) {
    const ep = ENDPOINTS[idx % ENDPOINTS.length];
    idx++;
    const start = Date.now();

    try {
      const result = await gw.pay(ep.url, { method: "POST", body: ep.body });
      const ms = Date.now() - start;
      const amount = parseFloat(result.formattedAmount);
      totalCompleted++;
      totalSpent += amount;
      consecutiveErrors = 0;

      const skill = ep.url.split("/").pop();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[${totalCompleted + totalFailed}/${TARGET_TXNS}] w${id} ${skill} $${result.formattedAmount} ${ms}ms (${elapsed}s elapsed)`,
      );

      // Redeposit if needed
      if (i > 0 && i % 20 === 0) {
        try {
          const bal = await gw.getBalances();
          if (bal.gateway.available < 200_000n) {
            // Top up from funder
            const account = gw.account;
            const topUpTx = await withRetry(
              () => funderWallet.writeContract({
                address: ARC_USDC, abi: erc20Abi, functionName: "transfer",
                args: [account.address, parseUnits(DEPOSIT, 6)],
              }),
              `topup-${id}`,
            );
            await publicClient.waitForTransactionReceipt({ hash: topUpTx });
            await gw.deposit(DEPOSIT);
            console.log(`[wallet-${id}] Redeposited ${DEPOSIT} USDC`);
          }
        } catch (e) {
          console.warn(`[wallet-${id}] Redeposit check failed:`, (e as Error).message);
        }
      }
    } catch (err) {
      totalFailed++;
      consecutiveErrors++;
      const ms = Date.now() - start;
      console.error(`[${totalCompleted + totalFailed}/${TARGET_TXNS}] w${id} FAIL ${ms}ms: ${(err as Error).message.slice(0, 80)}`);

      if (consecutiveErrors >= 5) {
        console.error(`[wallet-${id}] 5 consecutive errors, stopping worker`);
        break;
      }
    }

    // Small delay between payments to avoid overwhelming the server
    await new Promise(r => setTimeout(r, 800));
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║          AgentForge Demo Runner — 80+ Transactions          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log(`Target: ${TARGET_TXNS} transactions, ${CONCURRENCY} parallel wallets`);
  console.log(`Endpoints: ${ENDPOINTS.length} skills\n`);

  // Setup wallets sequentially (to avoid nonce collisions during funding)
  console.log("Setting up wallets...");
  const gateways: GatewayClient[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    gateways.push(await setupWallet(i));
  }
  console.log(`\nAll wallets ready. Starting payments...\n`);

  const txnsPerWorker = Math.ceil(TARGET_TXNS / CONCURRENCY);

  // Run workers in parallel
  await Promise.all(gateways.map((gw, i) => runWorker(gw, i, txnsPerWorker)));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const tps = (totalCompleted / parseFloat(elapsed)).toFixed(2);

  console.log("\n━━━ Demo Complete ━━━");
  console.log(`  Completed: ${totalCompleted}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`  Total spent: $${totalSpent.toFixed(6)} USDC`);
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Throughput: ${tps} txns/sec`);

  // Withdraw remaining
  for (let i = 0; i < gateways.length; i++) {
    try {
      const bal = await gateways[i].getBalances();
      if (bal.gateway.available > 0n) {
        await gateways[i].withdraw(bal.gateway.formattedAvailable);
        console.log(`[wallet-${i}] Withdrawn remaining ${bal.gateway.formattedAvailable}`);
      }
    } catch { /* ignore */ }
  }

  process.exit(0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
