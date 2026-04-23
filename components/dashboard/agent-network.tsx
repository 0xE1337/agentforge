"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaymentEvent } from "@/hooks/use-transactions";

interface AgentNetworkProps {
  events: PaymentEvent[];
}

const SKILLS = [
  { name: "Chain Analyzer", endpoint: "chain-analyzer", color: "#38bdf8", price: "$0.005" },
  { name: "Social Intel", endpoint: "social-intel", color: "#34d399", price: "$0.003" },
  { name: "Market Data", endpoint: "market-data", color: "#c084fc", price: "$0.002" },
  { name: "Code Auditor", endpoint: "code-auditor", color: "#f87171", price: "$0.008" },
  { name: "Summarizer", endpoint: "summarizer", color: "#fbbf24", price: "$0.001" },
];

export function AgentNetwork({ events }: AgentNetworkProps) {
  const skillStats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      const skill = e.endpoint.split("/").pop() ?? "";
      map[skill] = (map[skill] ?? 0) + 1;
    }
    return map;
  }, [events]);

  const maxCount = Math.max(1, ...Object.values(skillStats));
  const cx = 160, cy = 130;
  const radius = 95;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Agent Network</CardTitle>
        <p className="text-xs text-muted-foreground">Orchestrator + 5 Skill Agents on Arc Testnet</p>
      </CardHeader>
      <CardContent className="flex justify-center">
        <svg width={320} height={270} className="overflow-visible">
          {/* Connection lines */}
          {SKILLS.map((skill, i) => {
            const angle = (i / SKILLS.length) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            const count = skillStats[skill.endpoint] ?? 0;
            const opacity = count > 0 ? 0.3 + (count / maxCount) * 0.7 : 0.15;
            const width = count > 0 ? 1 + (count / maxCount) * 2.5 : 0.5;

            return (
              <line
                key={skill.endpoint}
                x1={cx} y1={cy} x2={x} y2={y}
                stroke={skill.color}
                strokeWidth={width}
                opacity={opacity}
                strokeDasharray={count === 0 ? "4 4" : undefined}
              />
            );
          })}

          {/* Orchestrator node (center) */}
          <circle cx={cx} cy={cy} r={22} fill="#1e293b" stroke="#64748b" strokeWidth={2} />
          <text x={cx} y={cy - 4} textAnchor="middle" fill="#e2e8f0" fontSize={8} fontWeight="bold">
            Orchestrator
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle" fill="#94a3b8" fontSize={7} fontFamily="monospace">
            LangChain
          </text>

          {/* Skill agent nodes */}
          {SKILLS.map((skill, i) => {
            const angle = (i / SKILLS.length) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            const count = skillStats[skill.endpoint] ?? 0;
            const nodeRadius = 16 + Math.min(count / 5, 8);

            return (
              <g key={skill.endpoint}>
                {/* Pulse ring for active skills */}
                {count > 0 && (
                  <circle cx={x} cy={y} r={nodeRadius + 4} fill="none" stroke={skill.color} strokeWidth={1} opacity={0.3}>
                    <animate attributeName="r" from={nodeRadius + 2} to={nodeRadius + 10} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                <circle cx={x} cy={y} r={nodeRadius} fill="#0f172a" stroke={skill.color} strokeWidth={1.5} />
                <text x={x} y={y - 4} textAnchor="middle" fill={skill.color} fontSize={7} fontWeight="bold">
                  {skill.name}
                </text>
                <text x={x} y={y + 6} textAnchor="middle" fill="#94a3b8" fontSize={7} fontFamily="monospace">
                  {skill.price}
                </text>
                {count > 0 && (
                  <text x={x} y={y + 16} textAnchor="middle" fill="#64748b" fontSize={6} fontFamily="monospace">
                    {count} txns
                  </text>
                )}
              </g>
            );
          })}

          {/* Legend */}
          <text x={4} y={260} fill="#64748b" fontSize={8} fontFamily="monospace">
            x402 nanopayments on Arc (Chain {5042002})
          </text>
        </svg>
      </CardContent>
    </Card>
  );
}
