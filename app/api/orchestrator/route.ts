import { NextRequest } from "next/server";
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
} from "@/lib/orchestrator";

const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;
const RPC = "https://rpc.testnet.arc.network";

/**
 * POST /api/orchestrator — SSE endpoint
 * Body: { task: string }
 * Streams orchestration steps as SSE events, then closes.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { task?: string };
  const task = (body.task ?? "").trim();
  if (!task) {
    return new Response(JSON.stringify({ error: "task is required" }), { status: 400 });
  }

  const funderKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  const hasLLMKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!funderKey || !hasLLMKey) {
    return new Response(
      JSON.stringify({
        error:
          "Missing server keys: BUYER_PRIVATE_KEY and (OPENAI_API_KEY or DEEPSEEK_API_KEY) are required.",
      }),
      { status: 500 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // Setup ephemeral wallet
        send("step", { step: "setup", detail: "Creating ephemeral agent wallet..." });
        const ephemeralKey = generatePrivateKey();
        const ephemeralAccount = privateKeyToAccount(ephemeralKey);
        const funderAccount = privateKeyToAccount(funderKey);

        const publicClient = createPublicClient({ chain: arcTestnet, transport: http(RPC) });
        const funderWallet = createWalletClient({
          account: funderAccount,
          chain: arcTestnet,
          transport: http(RPC),
        });

        // Fund ephemeral
        send("step", { step: "setup", detail: `Funding ${ephemeralAccount.address.slice(0, 10)}...` });
        const gasTx = await funderWallet.sendTransaction({
          to: ephemeralAccount.address,
          value: parseEther("0.01"),
        });
        await publicClient.waitForTransactionReceipt({ hash: gasTx });

        const usdcTx = await funderWallet.writeContract({
          address: ARC_USDC,
          abi: erc20Abi,
          functionName: "transfer",
          args: [ephemeralAccount.address, parseUnits("1", 6)],
        });
        await publicClient.waitForTransactionReceipt({ hash: usdcTx });

        // Gateway deposit
        const gateway = new GatewayClient({ chain: "arcTestnet", privateKey: ephemeralKey });
        await gateway.deposit("1");
        send("step", { step: "setup", detail: "Wallet funded, Gateway deposited. Starting orchestration..." });

        // Run orchestration with step streaming.
        // LLM client picks OpenAI primary → DeepSeek fallback from env, with
        // 15s per-provider timeout so a hanging upstream auto-fails over.
        const llm = createLLMClient();
        const result = await orchestrate({
          task,
          gateway,
          llm,
          baseURL: process.env.BASE_URL ?? "http://localhost:3000",
          account: ephemeralAccount,
          guardAgent: funderAccount,
          onStep: (step, detail) => {
            send("step", { step, detail });
          },
        });

        // Send final result
        send("result", {
          task: result.task,
          aggregation: result.aggregation,
          totalCost: result.totalCost,
          totalLatencyMs: result.totalLatencyMs,
          skillResults: result.results.map((r) => ({
            name: r.name,
            success: r.success,
            cost: r.cost,
            latencyMs: r.latencyMs,
          })),
          ratings: result.ratings?.map((r) => ({
            name: r.name,
            rating: r.rating,
            txHash: r.txHash.slice(0, 14) + "...",
          })),
          guard: result.guard
            ? {
                budgetBefore: result.guard.budgetBefore,
                budgetAfter: result.guard.budgetAfter,
                guardTxns: result.guard.txHashes.length,
              }
            : null,
        });

        // Cleanup
        try {
          const bal = await gateway.getBalances();
          if (bal.gateway.available > BigInt(0)) await gateway.withdraw(bal.gateway.formattedAvailable);
        } catch { /* ignore */ }

        send("done", {});
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
