"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { PaymentEvent } from "@/hooks/use-transactions";

interface StatsCardsProps {
  events: PaymentEvent[];
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 64, h = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity={0.7} />
    </svg>
  );
}

export function StatsCards({ events }: StatsCardsProps) {
  const stats = useMemo(() => {
    const totalTxns = events.length;
    const totalVolume = events.reduce((s, e) => s + parseFloat(e.amount_usdc || "0"), 0);

    // Per-skill breakdown
    const bySkill: Record<string, { count: number; volume: number }> = {};
    for (const e of events) {
      const skill = e.endpoint.split("/").pop() ?? "unknown";
      if (!bySkill[skill]) bySkill[skill] = { count: 0, volume: 0 };
      bySkill[skill].count++;
      bySkill[skill].volume += parseFloat(e.amount_usdc || "0");
    }

    const activeSkills = Object.keys(bySkill).length;

    // Unique payers
    const uniquePayers = new Set(events.map((e) => e.payer)).size;

    // Sparkline: txns per minute (last 10 buckets)
    const txnSparkline: number[] = [];
    if (events.length > 0) {
      const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const start = new Date(sorted[0].created_at).getTime();
      const end = new Date(sorted[sorted.length - 1].created_at).getTime();
      const bucketSize = Math.max((end - start) / 10, 1000);
      const buckets = new Array(10).fill(0) as number[];
      for (const e of sorted) {
        const t = new Date(e.created_at).getTime();
        const idx = Math.min(9, Math.floor((t - start) / bucketSize));
        buckets[idx]++;
      }
      txnSparkline.push(...buckets);
    }

    // Volume sparkline
    const volSparkline: number[] = [];
    if (events.length > 0) {
      const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const start = new Date(sorted[0].created_at).getTime();
      const end = new Date(sorted[sorted.length - 1].created_at).getTime();
      const bucketSize = Math.max((end - start) / 10, 1000);
      const buckets = new Array(10).fill(0) as number[];
      for (const e of sorted) {
        const t = new Date(e.created_at).getTime();
        const idx = Math.min(9, Math.floor((t - start) / bucketSize));
        buckets[idx] += parseFloat(e.amount_usdc || "0");
      }
      volSparkline.push(...buckets);
    }

    return { totalTxns, totalVolume, activeSkills, uniquePayers, bySkill, txnSparkline, volSparkline };
  }, [events]);

  const cards = [
    {
      label: "Total Transactions",
      value: stats.totalTxns.toString(),
      sub: `${stats.uniquePayers} unique payer${stats.uniquePayers !== 1 ? "s" : ""}`,
      color: "text-sky-400",
      sparkColor: "#38bdf8",
      sparkline: stats.txnSparkline,
    },
    {
      label: "Total Volume",
      value: `$${stats.totalVolume.toFixed(4)}`,
      sub: "USDC paid via x402",
      color: "text-emerald-400",
      sparkColor: "#34d399",
      sparkline: stats.volSparkline,
    },
    {
      label: "Active Skills",
      value: stats.activeSkills.toString(),
      sub: "On-chain registered",
      color: "text-purple-400",
      sparkColor: "#c084fc",
      sparkline: Object.values(stats.bySkill).map((s) => s.count),
    },
    {
      label: "Avg Cost/Txn",
      value: stats.totalTxns > 0 ? `$${(stats.totalVolume / stats.totalTxns).toFixed(4)}` : "$0",
      sub: "Per-action nanopayment",
      color: "text-amber-400",
      sparkColor: "#fbbf24",
      sparkline: stats.volSparkline.map((v, i) => stats.txnSparkline[i] > 0 ? v / stats.txnSparkline[i] : 0),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <Sparkline data={card.sparkline} color={card.sparkColor} />
            </div>
            <div className={`font-mono text-2xl font-semibold ${card.color}`}>
              {card.value}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {card.label}
            </div>
            {card.sub && (
              <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                {card.sub}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
