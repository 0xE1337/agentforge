"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface StepEvent {
  step: string;
  detail: string;
}

interface OrchestratorResult {
  task: string;
  aggregation: string;
  totalCost: string;
  totalLatencyMs: number;
  skillResults: Array<{ name: string; success: boolean; cost: string; latencyMs: number }>;
  ratings?: Array<{ name: string; rating: number; txHash: string }>;
  guard?: { budgetBefore: string; budgetAfter: string; guardTxns: number } | null;
}

const STEP_META: Record<string, { label: string; color: string; order: number }> = {
  setup: { label: "Wallet Setup", color: "text-slate-400", order: 0 },
  discovery: { label: "On-Chain Discovery", color: "text-sky-400", order: 1 },
  decompose: { label: "LLM Decomposition", color: "text-purple-400", order: 2 },
  guard: { label: "PaymentGuard", color: "text-amber-400", order: 3 },
  execute: { label: "x402 Execution", color: "text-emerald-400", order: 4 },
  fees: { label: "Revenue Split", color: "text-orange-400", order: 5 },
  aggregate: { label: "Aggregation", color: "text-blue-400", order: 6 },
  rate: { label: "On-Chain Rating", color: "text-rose-400", order: 7 },
};

const EXAMPLE_TASKS = [
  "Analyze ETH market and audit SkillRegistry for vulnerabilities",
  "What is the social sentiment around DeFi and summarize the key trends?",
  "Give me a full report: ETH price, social intel on AI agents, and summarize findings",
];

export function OrchestratorPanel() {
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [result, setResult] = useState<OrchestratorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async (taskText: string) => {
    if (!taskText.trim() || running) return;

    setRunning(true);
    setSteps([]);
    setResult(null);
    setError(null);
    setCurrentStep("setup");

    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskText }),
      });

      if (!res.ok || !res.body) {
        setError(`Server error: ${res.status}`);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "step") {
                setSteps((prev) => [...prev, data as StepEvent]);
                setCurrentStep((data as StepEvent).step);
                // Auto-scroll
                setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
              } else if (eventType === "result") {
                setResult(data as OrchestratorResult);
              } else if (eventType === "error") {
                setError((data as { message: string }).message);
              }
            } catch { /* skip malformed */ }
            eventType = "";
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }

    setRunning(false);
    setCurrentStep(null);
  }, [running]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Live Orchestrator</CardTitle>
        <p className="text-xs text-muted-foreground">
          Type a task — watch 6-step autonomous loop in real-time
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Task Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); run(task); }}
          className="flex gap-2"
        >
          <Input
            placeholder="e.g. Analyze ETH market and audit SkillRegistry..."
            value={task}
            onChange={(e) => setTask(e.target.value)}
            disabled={running}
            className="flex-1 text-sm"
          />
          <Button type="submit" disabled={running || !task.trim()} size="sm">
            {running ? "Running..." : "Run"}
          </Button>
        </form>

        {/* Example tasks */}
        {!running && !result && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_TASKS.map((t, i) => (
              <button
                key={i}
                onClick={() => { setTask(t); run(t); }}
                className="text-[10px] px-2 py-1 rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground"
              >
                {t.slice(0, 50)}...
              </button>
            ))}
          </div>
        )}

        {/* Step Pipeline */}
        {(running || steps.length > 0) && (
          <div className="flex gap-1 flex-wrap">
            {Object.entries(STEP_META).map(([key, meta]) => {
              const isActive = currentStep === key;
              const isDone = steps.some((s) => s.step === key);
              return (
                <Badge
                  key={key}
                  variant={isDone ? "default" : "outline"}
                  className={`text-[9px] ${isActive ? "animate-pulse ring-1 ring-primary" : ""} ${isDone ? "" : "opacity-40"}`}
                >
                  {isDone && !isActive ? "\u2713 " : ""}{meta.label}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Live Step Log */}
        {steps.length > 0 && (
          <div
            ref={scrollRef}
            className="rounded-md border bg-black/5 dark:bg-white/5 p-3 max-h-[200px] overflow-y-auto font-mono text-[11px] space-y-1"
          >
            {steps.map((s, i) => {
              const meta = STEP_META[s.step];
              return (
                <div key={i} className="flex gap-2">
                  <span className={`flex-shrink-0 ${meta?.color ?? "text-muted-foreground"}`}>
                    [{meta?.label ?? s.step}]
                  </span>
                  <span className="text-foreground/80">{s.detail}</span>
                </div>
              );
            })}
            {running && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Processing...
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            {/* Metrics row */}
            <div className="flex gap-3 text-xs">
              <div className="rounded-md border px-3 py-2 flex-1 text-center">
                <div className="font-mono font-bold text-emerald-400">${result.totalCost}</div>
                <div className="text-[9px] text-muted-foreground">Total Cost</div>
              </div>
              <div className="rounded-md border px-3 py-2 flex-1 text-center">
                <div className="font-mono font-bold text-sky-400">{(result.totalLatencyMs / 1000).toFixed(1)}s</div>
                <div className="text-[9px] text-muted-foreground">Total Time</div>
              </div>
              <div className="rounded-md border px-3 py-2 flex-1 text-center">
                <div className="font-mono font-bold text-purple-400">{result.skillResults.filter((r) => r.success).length}/{result.skillResults.length}</div>
                <div className="text-[9px] text-muted-foreground">Skills OK</div>
              </div>
              {result.guard && (
                <div className="rounded-md border px-3 py-2 flex-1 text-center">
                  <div className="font-mono font-bold text-amber-400">${result.guard.budgetAfter}</div>
                  <div className="text-[9px] text-muted-foreground">Guard Budget Left</div>
                </div>
              )}
            </div>

            {/* Ratings */}
            {result.ratings && result.ratings.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {result.ratings.map((r) => (
                  <div key={r.name} className="text-[10px] flex items-center gap-1">
                    <span className="text-muted-foreground">{r.name}:</span>
                    <span className="text-amber-400">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Aggregated response */}
            <div className="rounded-md border p-3 text-xs leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap">
              {result.aggregation}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive p-3 text-xs text-destructive">
            Error: {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
