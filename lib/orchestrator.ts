/**
 * Orchestrator Agent — discovers skills on-chain, decomposes tasks via LLM,
 * executes parallel x402 payments to skill endpoints, aggregates results.
 */

import { createPublicClient, createWalletClient, http, formatUnits } from "viem";
import type { Account } from "viem";
import {
  arcTestnet,
  SKILL_REGISTRY_ADDRESS, SKILL_REGISTRY_ABI,
  PAYMENT_GUARD_ADDRESS, PAYMENT_GUARD_ABI,
  MARKETPLACE_FEE_ADDRESS, MARKETPLACE_FEE_ABI,
} from "./contracts.ts";

// ── Types ──────────────────────────────────────────────────────────────

export interface OnChainSkill {
  id: number;
  name: string;
  description: string;
  endpoint: string;
  priceUSDC: string; // formatted, e.g. "0.005"
  tags: string[];
  avgRating: number;
  ratingCount: number;
}

export interface TaskPlan {
  task: string;
  selectedSkills: Array<{
    skillId: number;
    name: string;
    endpoint: string;
    reason: string;
    payload: Record<string, unknown>;
  }>;
  estimatedCost: string;
}

export interface SkillResult {
  skillId: number;
  name: string;
  endpoint: string;
  cost: string;
  latencyMs: number;
  success: boolean;
  data: unknown;
  error?: string;
}

export interface OrchestratorResult {
  task: string;
  plan: TaskPlan;
  results: SkillResult[];
  aggregation: string;
  totalCost: string;
  totalLatencyMs: number;
}

// ── On-chain Discovery ─────────────────────────────────────────────────

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export async function discoverSkills(): Promise<OnChainSkill[]> {
  const [ids, skills] = (await publicClient.readContract({
    address: SKILL_REGISTRY_ADDRESS,
    abi: SKILL_REGISTRY_ABI,
    functionName: "getActiveSkills",
  })) as [bigint[], Array<{
    owner: string;
    name: string;
    description: string;
    endpoint: string;
    priceUSDC: bigint;
    tags: string[];
    totalRating: bigint;
    ratingCount: bigint;
    active: boolean;
    createdAt: bigint;
  }>];

  return ids.map((id, i) => {
    const s = skills[i];
    const ratingCount = Number(s.ratingCount);
    return {
      id: Number(id),
      name: s.name,
      description: s.description,
      endpoint: s.endpoint,
      priceUSDC: formatUnits(s.priceUSDC, 6),
      tags: s.tags,
      avgRating: ratingCount > 0 ? Number(s.totalRating) / ratingCount : 0,
      ratingCount,
    };
  });
}

// ── LLM Task Decomposition ────────────────────────────────────────────

interface LLMClient {
  chat(messages: Array<{ role: string; content: string }>): Promise<string>;
}

/** Create an OpenAI-compatible LLM client (works with DeepSeek) */
export function createLLMClient(opts: {
  apiKey: string;
  baseURL?: string;
  model?: string;
}): LLMClient {
  const model = opts.model ?? "deepseek-chat";
  const baseURL = opts.baseURL ?? "https://api.deepseek.com";

  return {
    async chat(messages) {
      const res = await fetch(`${baseURL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({ model, messages, temperature: 0.3 }),
      });
      if (!res.ok) throw new Error(`LLM API error: ${res.status} ${await res.text()}`);
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices[0].message.content;
    },
  };
}

export async function decomposeTask(
  llm: LLMClient,
  task: string,
  skills: OnChainSkill[],
): Promise<TaskPlan> {
  const skillCatalog = skills
    .map(
      (s) =>
        `  [${s.id}] ${s.name} ($${s.priceUSDC}) — ${s.description} | tags: ${s.tags.join(", ")}`,
    )
    .join("\n");

  const prompt = `You are an AI orchestrator. Given a user task, select which skills to invoke and build a payload for each.

AVAILABLE SKILLS (from on-chain SkillRegistry):
${skillCatalog}

USER TASK: "${task}"

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "selectedSkills": [
    {
      "skillId": <number>,
      "name": "<skill name>",
      "reason": "<one sentence why this skill is needed>",
      "payload": { <key-value pairs to send as POST body> }
    }
  ]
}

Rules:
- Select 2-4 skills that together can address the task.
- Each payload must match what the skill expects.
- Chain Analyzer expects: { "address": "0x..." }
- Social Intel expects: { "query": "search terms" }
- Market Data expects: { "symbol": "TOKEN" }
- Code Auditor expects: { "contract": "ContractName.sol" }
- Summarizer expects: { "text": "text to summarize" }`;

  const response = await llm.chat([{ role: "user", content: prompt }]);

  // Extract JSON from response (handle potential markdown wrapping)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("LLM did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]) as {
    selectedSkills: Array<{
      skillId: number;
      name: string;
      reason: string;
      payload: Record<string, unknown>;
    }>;
  };

  // Enrich with endpoint info and calculate cost
  const enriched = parsed.selectedSkills.map((sel) => {
    const skill = skills.find((s) => s.id === sel.skillId);
    return {
      ...sel,
      endpoint: skill?.endpoint ?? `/api/skills/unknown`,
    };
  });

  const totalCost = enriched.reduce((sum, sel) => {
    const skill = skills.find((s) => s.id === sel.skillId);
    return sum + parseFloat(skill?.priceUSDC ?? "0");
  }, 0);

  return {
    task,
    selectedSkills: enriched,
    estimatedCost: totalCost.toFixed(6),
  };
}

// ── Parallel Skill Execution (via x402 GatewayClient) ──────────────────

export interface GatewayPayResult<T = unknown> {
  data: T;
  formattedAmount: string;
  transaction: string;
  status: number;
}

export interface GatewayLike {
  pay<T = unknown>(
    url: string,
    opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown },
  ): Promise<GatewayPayResult<T>>;
}

export async function executeSkills(
  gateway: GatewayLike,
  plan: TaskPlan,
  baseURL: string,
): Promise<SkillResult[]> {
  const calls = plan.selectedSkills.map(async (sel): Promise<SkillResult> => {
    const url = `${baseURL}${sel.endpoint}`;
    const start = Date.now();

    try {
      const result = await gateway.pay(url, {
        method: "POST",
        body: sel.payload,
      });

      return {
        skillId: sel.skillId,
        name: sel.name,
        endpoint: sel.endpoint,
        cost: result.formattedAmount,
        latencyMs: Date.now() - start,
        success: true,
        data: result.data,
      };
    } catch (err) {
      return {
        skillId: sel.skillId,
        name: sel.name,
        endpoint: sel.endpoint,
        cost: "0",
        latencyMs: Date.now() - start,
        success: false,
        data: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  return Promise.all(calls);
}

// ── PaymentGuard Integration ───────────────────────────────────────────

export interface GuardCheckResult {
  allowed: boolean;
  budgetBefore: string;
  budgetAfter?: string;
  blockedSkills: string[];
  txHashes: string[];
}

export async function checkAndRecordGuard(
  account: Account,
  plan: TaskPlan,
  skills: OnChainSkill[],
): Promise<GuardCheckResult> {
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  // Read current budget
  const budgetBefore = (await publicClient.readContract({
    address: PAYMENT_GUARD_ADDRESS,
    abi: PAYMENT_GUARD_ABI,
    functionName: "getRemainingBudget",
    args: [account.address],
  })) as bigint;

  const blockedSkills: string[] = [];
  const txHashes: string[] = [];

  for (const sel of plan.selectedSkills) {
    const skill = skills.find((s) => s.id === sel.skillId);
    if (!skill) continue;

    // Check if skill is allowed
    const allowed = (await publicClient.readContract({
      address: PAYMENT_GUARD_ADDRESS,
      abi: PAYMENT_GUARD_ABI,
      functionName: "isSkillAllowed",
      args: [account.address, BigInt(sel.skillId)],
    })) as boolean;

    if (!allowed) {
      blockedSkills.push(sel.name);
      continue;
    }

    // Record spend on-chain (this also checks budget)
    try {
      const priceRaw = BigInt(Math.round(parseFloat(skill.priceUSDC) * 1e6));
      const txHash = await walletClient.writeContract({
        address: PAYMENT_GUARD_ADDRESS,
        abi: PAYMENT_GUARD_ABI,
        functionName: "checkAndRecord",
        args: [account.address, BigInt(sel.skillId), priceRaw],
      });
      txHashes.push(txHash);
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("SpendingCapExceeded")) {
        blockedSkills.push(`${sel.name} (budget exceeded)`);
      } else if (msg.includes("SkillNotAllowed")) {
        blockedSkills.push(`${sel.name} (not in allowlist)`);
      } else {
        blockedSkills.push(`${sel.name} (guard error)`);
      }
    }
  }

  // Read budget after
  const budgetAfter = (await publicClient.readContract({
    address: PAYMENT_GUARD_ADDRESS,
    abi: PAYMENT_GUARD_ABI,
    functionName: "getRemainingBudget",
    args: [account.address],
  })) as bigint;

  return {
    allowed: blockedSkills.length === 0,
    budgetBefore: formatUnits(budgetBefore, 6),
    budgetAfter: formatUnits(budgetAfter, 6),
    blockedSkills,
    txHashes,
  };
}

// ── Revenue Split Recording ────────────────────────────────────────────

export interface FeeSplitResult {
  skillId: number;
  name: string;
  ownerShare: string;
  platformShare: string;
  txHash: string;
}

export async function recordFeeSplits(
  account: Account,
  results: SkillResult[],
): Promise<FeeSplitResult[]> {
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  const splits: FeeSplitResult[] = [];

  for (const r of results) {
    if (!r.success || !r.cost) continue;

    const amountRaw = BigInt(Math.round(parseFloat(r.cost) * 1e6));
    if (amountRaw === BigInt(0)) continue;

    try {
      const txHash = await walletClient.writeContract({
        address: MARKETPLACE_FEE_ADDRESS,
        abi: MARKETPLACE_FEE_ABI,
        functionName: "recordPayment",
        args: [BigInt(r.skillId), account.address, amountRaw],
      });

      // Calculate split for display (5% platform fee)
      const platformShare = (amountRaw * BigInt(500)) / BigInt(10000);
      const ownerShare = amountRaw - platformShare;

      splits.push({
        skillId: r.skillId,
        name: r.name,
        ownerShare: formatUnits(ownerShare, 6),
        platformShare: formatUnits(platformShare, 6),
        txHash,
      });
    } catch {
      // Non-critical, skip
    }
  }

  return splits;
}

// ── Result Aggregation ─────────────────────────────────────────────────

export async function aggregateResults(
  llm: LLMClient,
  task: string,
  results: SkillResult[],
): Promise<string> {
  const resultSummary = results
    .map((r) => {
      if (!r.success) return `[${r.name}] FAILED: ${r.error}`;
      return `[${r.name}] (${r.latencyMs}ms, $${r.cost}):\n${JSON.stringify(r.data, null, 2)}`;
    })
    .join("\n\n");

  const prompt = `You are an AI orchestrator aggregating results from multiple skill agents.

ORIGINAL TASK: "${task}"

SKILL RESULTS:
${resultSummary}

Synthesize these results into a cohesive, actionable response for the user. Be concise but comprehensive. If any skills failed, note what information is missing.`;

  return llm.chat([{ role: "user", content: prompt }]);
}

// ── On-chain Rating ────────────────────────────────────────────────────

export interface RatingResult {
  skillId: number;
  name: string;
  rating: number;
  txHash: string;
}

export async function rateSkillsOnChain(
  account: Account,
  results: SkillResult[],
): Promise<RatingResult[]> {
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  const ratings: RatingResult[] = [];

  for (const r of results) {
    if (!r.success) continue;

    // Rate based on latency + success: 4-5 for fast, 3 for slow, skip failures
    const rating = r.latencyMs < 5000 ? 5 : r.latencyMs < 10000 ? 4 : 3;

    try {
      const txHash = await walletClient.writeContract({
        address: SKILL_REGISTRY_ADDRESS,
        abi: SKILL_REGISTRY_ABI,
        functionName: "rateSkill",
        args: [BigInt(r.skillId), rating],
      });

      ratings.push({ skillId: r.skillId, name: r.name, rating, txHash });
    } catch (err) {
      // AlreadyRated is expected if same wallet rated before — not an error
      const msg = (err as Error).message ?? "";
      if (msg.includes("AlreadyRated")) {
        ratings.push({ skillId: r.skillId, name: r.name, rating, txHash: "already-rated" });
      }
      // else skip silently
    }
  }

  return ratings;
}

// ── Full Orchestration Pipeline ────────────────────────────────────────

export async function orchestrate(opts: {
  task: string;
  gateway: GatewayLike;
  llm: LLMClient;
  baseURL: string;
  account?: Account;
  /** Persistent agent identity for PaymentGuard (may differ from ephemeral payment account) */
  guardAgent?: Account;
  onStep?: (step: string, detail: string) => void;
}): Promise<OrchestratorResult & { ratings?: RatingResult[]; guard?: GuardCheckResult; feeSplits?: FeeSplitResult[] }> {
  const { task, gateway, llm, baseURL, account, guardAgent, onStep } = opts;
  const totalStart = Date.now();

  // Step 1: Discover skills from on-chain registry
  onStep?.("discovery", "Reading SkillRegistry on Arc Testnet...");
  const skills = await discoverSkills();
  onStep?.("discovery", `Found ${skills.length} active skills`);

  // Step 2: Decompose task into skill calls
  onStep?.("decompose", "Analyzing task and selecting skills...");
  const plan = await decomposeTask(llm, task, skills);
  onStep?.(
    "decompose",
    `Selected ${plan.selectedSkills.length} skills, est. cost: $${plan.estimatedCost}`,
  );

  // Step 3: PaymentGuard check (if guardAgent provided)
  let guard: GuardCheckResult | undefined;
  if (guardAgent) {
    onStep?.("guard", "Checking PaymentGuard on-chain...");
    guard = await checkAndRecordGuard(guardAgent, plan, skills);
    if (guard.blockedSkills.length > 0) {
      onStep?.("guard", `BLOCKED: ${guard.blockedSkills.join(", ")}`);
    } else {
      onStep?.("guard", `Approved. Budget: $${guard.budgetBefore} → $${guard.budgetAfter} (${guard.txHashes.length} guard txns)`);
    }
  }

  // Step 4: Execute skills in parallel via x402
  onStep?.("execute", `Calling ${plan.selectedSkills.length} skills in parallel via x402...`);
  const results = await executeSkills(gateway, plan, baseURL);
  const succeeded = results.filter((r) => r.success).length;
  onStep?.("execute", `${succeeded}/${results.length} skills succeeded`);

  // Step 5: Record revenue splits on-chain (if guardAgent provided)
  let feeSplits: FeeSplitResult[] | undefined;
  if (guardAgent) {
    onStep?.("fees", "Recording revenue splits on-chain (5% platform fee)...");
    feeSplits = await recordFeeSplits(guardAgent, results);
    if (feeSplits.length > 0) {
      const totalPlatform = feeSplits.reduce((s, f) => s + parseFloat(f.platformShare), 0);
      onStep?.("fees", `${feeSplits.length} splits recorded. Platform revenue: $${totalPlatform.toFixed(6)}`);
    }
  }

  // Step 6: Aggregate results
  onStep?.("aggregate", "Synthesizing results...");
  const aggregation = await aggregateResults(llm, task, results);
  onStep?.("aggregate", "Done");

  // Step 7: Rate skills on-chain (if account provided)
  let ratings: RatingResult[] | undefined;
  if (account) {
    onStep?.("rate", "Rating skills on-chain...");
    ratings = await rateSkillsOnChain(account, results);
    const rated = ratings.filter((r) => r.txHash !== "already-rated").length;
    onStep?.("rate", `${rated} skills rated on-chain`);
  }

  const totalCost = results
    .reduce((sum, r) => sum + parseFloat(r.cost || "0"), 0)
    .toFixed(6);

  return {
    task,
    plan,
    results,
    aggregation,
    totalCost,
    totalLatencyMs: Date.now() - totalStart,
    ratings,
    guard,
    feeSplits,
  };
}
