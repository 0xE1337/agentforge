import { NextRequest, NextResponse } from "next/server";
import { withGateway } from "@/lib/x402";
import { llmCall } from "@/lib/llm";

const handler = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const query = (body as { query?: string }).query ?? "crypto";

  // Try real LLM analysis
  const llmResult = await llmCall(
    `You are a crypto social media analyst. Output ONLY a JSON object with keys:
- overallSentiment (number 0-1)
- trendingTopics (array of {topic: string, sentiment: number 0-1, mentions: number})
- recommendation ("bullish" | "neutral" | "bearish")
- analysis (string, 2-3 sentences)
No markdown, no explanation.`,
    `Analyze current social media sentiment for: "${query}". Provide realistic simulated data based on your knowledge of crypto markets and social trends.`,
  );

  let result: Record<string, unknown>;

  if (llmResult) {
    try {
      const parsed = JSON.parse(llmResult.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
        overallSentiment?: number;
        trendingTopics?: Array<{ topic: string; sentiment: number; mentions: number }>;
        recommendation?: string;
        analysis?: string;
      };
      result = {
        query,
        overallSentiment: parsed.overallSentiment ?? 0.5,
        trendingTopics: parsed.trendingTopics ?? [],
        totalMentions: (parsed.trendingTopics ?? []).reduce((s, t) => s + (t.mentions ?? 0), 0),
        recommendation: parsed.recommendation ?? "neutral",
        analysis: parsed.analysis ?? "",
        model: "deepseek-chat",
      };
    } catch {
      result = { query, analysis: llmResult.slice(0, 500), model: "deepseek-chat" };
    }
  } else {
    // Fallback: mock data
    const topics = [
      { topic: "Arc Testnet Launch", sentiment: 0.82, mentions: 4521 },
      { topic: "Circle x402 Protocol", sentiment: 0.91, mentions: 2103 },
      { topic: "Agent Economy", sentiment: 0.76, mentions: 8934 },
      { topic: "DeFi Summer 2026", sentiment: 0.68, mentions: 12340 },
      { topic: "AI Agent Payments", sentiment: 0.88, mentions: 3217 },
    ];
    const selected = [...topics].sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3) + 2);
    const overallSentiment = selected.reduce((sum, t) => sum + t.sentiment, 0) / selected.length;

    result = {
      query,
      overallSentiment: parseFloat(overallSentiment.toFixed(2)),
      trendingTopics: selected,
      totalMentions: selected.reduce((sum, t) => sum + t.mentions, 0),
      recommendation: overallSentiment > 0.75 ? "bullish" : overallSentiment > 0.5 ? "neutral" : "bearish",
      model: "fallback",
    };
  }

  return NextResponse.json({
    skillId: 2,
    skill: "Social Intel",
    result,
    timestamp: new Date().toISOString(),
  });
};

export const POST = withGateway(handler, "$0.003", "/api/skills/social-intel");
