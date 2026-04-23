import { NextRequest, NextResponse } from "next/server";
import { withGateway } from "@/lib/x402";

const tokens: Record<string, { price: number; name: string }> = {
  BTC: { price: 98450, name: "Bitcoin" },
  ETH: { price: 3820, name: "Ethereum" },
  USDC: { price: 1.0, name: "USD Coin" },
  SOL: { price: 178, name: "Solana" },
  ARC: { price: 2.45, name: "Arc" },
};

const handler = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const symbol = ((body as { symbol?: string }).symbol ?? "ETH").toUpperCase();
  const token = tokens[symbol] ?? tokens["ETH"];

  const change24h = (Math.random() - 0.5) * 10;
  const volume24h = Math.floor(Math.random() * 5000000000);

  return NextResponse.json({
    skillId: 3,
    skill: "Market Data",
    result: {
      symbol,
      name: token.name,
      priceUSD: parseFloat((token.price * (1 + change24h / 100)).toFixed(2)),
      change24h: parseFloat(change24h.toFixed(2)),
      volume24h,
      marketCap: Math.floor(token.price * (Math.random() * 1e9 + 1e8)),
      high24h: parseFloat((token.price * 1.03).toFixed(2)),
      low24h: parseFloat((token.price * 0.97).toFixed(2)),
    },
    timestamp: new Date().toISOString(),
  });
};

export const POST = withGateway(handler, "$0.002", "/api/skills/market-data");
