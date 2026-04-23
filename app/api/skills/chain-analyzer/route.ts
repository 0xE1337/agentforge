import { NextRequest, NextResponse } from "next/server";
import { withGateway } from "@/lib/x402";

const mockAddresses = [
  "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
];

const handler = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const address = (body as { address?: string }).address ??
    mockAddresses[Math.floor(Math.random() * mockAddresses.length)];

  const txCount = Math.floor(Math.random() * 5000) + 100;
  const totalVolume = (Math.random() * 1000000).toFixed(2);
  const topInteractions = [
    { protocol: "Uniswap V3", count: Math.floor(txCount * 0.3) },
    { protocol: "Aave V3", count: Math.floor(txCount * 0.15) },
    { protocol: "OpenSea", count: Math.floor(txCount * 0.1) },
  ];

  return NextResponse.json({
    skillId: 1,
    skill: "Chain Analyzer",
    result: {
      address,
      transactionCount: txCount,
      totalVolumeUSD: totalVolume,
      topInteractions,
      riskScore: Math.random() > 0.8 ? "high" : Math.random() > 0.5 ? "medium" : "low",
      lastActive: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
};

export const POST = withGateway(handler, "$0.005", "/api/skills/chain-analyzer");
