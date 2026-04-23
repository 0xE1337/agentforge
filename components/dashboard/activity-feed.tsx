"use client";

import { useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PaymentEvent } from "@/hooks/use-transactions";

interface ActivityFeedProps {
  events: PaymentEvent[];
  maxItems?: number;
}

const SKILL_COLORS: Record<string, string> = {
  "chain-analyzer": "text-sky-400",
  "social-intel": "text-emerald-400",
  "market-data": "text-purple-400",
  "code-auditor": "text-red-400",
  "summarizer": "text-amber-400",
};

function formatTimeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function shortenAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function ActivityFeed({ events, maxItems = 20 }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const display = events.slice(0, maxItems);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [events.length]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Live Activity</CardTitle>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-muted-foreground">
              {events.length} events
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <div ref={scrollRef} className="overflow-y-auto max-h-[400px]">
          {display.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-muted-foreground font-mono">
                Waiting for transactions...
              </span>
              <span className="text-[10px] text-muted-foreground">
                Run <code className="bg-muted px-1 rounded">npm run agent</code> to generate payments
              </span>
            </div>
          )}
          {display.map((event, idx) => {
            const skill = event.endpoint.split("/").pop() ?? "unknown";
            const colorClass = SKILL_COLORS[skill] ?? "text-muted-foreground";

            return (
              <div
                key={event.id}
                className="flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 transition-colors"
                style={idx === 0 ? { animation: "fadeIn 0.3s ease-out" } : undefined}
              >
                <div className="mt-1.5 flex-shrink-0">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-mono font-semibold ${colorClass}`}>
                      {skill}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      ${event.amount_usdc}
                    </Badge>
                  </div>

                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      from {shortenAddr(event.payer)}
                    </span>
                    {event.gateway_tx && (
                      <a
                        href={`https://testnet.arcscan.app/tx/${event.gateway_tx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-primary hover:underline"
                      >
                        tx:{event.gateway_tx.slice(0, 8)}...
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 text-[10px] font-mono text-muted-foreground">
                  {formatTimeAgo(event.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
