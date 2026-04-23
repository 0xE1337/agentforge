import { NextRequest, NextResponse } from "next/server";
import { withGateway } from "@/lib/x402";
import { llmCall } from "@/lib/llm";

const handler = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const text = (body as { text?: string }).text ?? "";
  const words = text.split(/\s+/).filter(Boolean);

  // Try real LLM summarization
  const llmSummary = await llmCall(
    "You are a concise summarizer. Output ONLY a JSON object with keys: summary (string, 1-3 sentences), keyTopics (array of 3-5 strings). No markdown, no explanation.",
    `Summarize this text:\n\n${text}`,
  );

  let result: Record<string, unknown>;

  if (llmSummary) {
    try {
      const parsed = JSON.parse(llmSummary.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
        summary?: string;
        keyTopics?: string[];
      };
      const summaryWords = (parsed.summary ?? "").split(/\s+/).length;
      result = {
        summary: parsed.summary ?? "Unable to summarize.",
        keyTopics: parsed.keyTopics ?? [],
        originalLength: words.length,
        summaryLength: summaryWords,
        compressionRatio: words.length > 0
          ? parseFloat((summaryWords / words.length).toFixed(2))
          : 0,
        model: "deepseek-chat",
      };
    } catch {
      // LLM returned non-JSON, use raw text
      result = {
        summary: llmSummary.slice(0, 500),
        keyTopics: [],
        originalLength: words.length,
        summaryLength: llmSummary.split(/\s+/).length,
        compressionRatio: 0,
        model: "deepseek-chat",
      };
    }
  } else {
    // Fallback: simple extractive summary
    const sentences = text.split(/[.!?]+/).filter(Boolean).map((s) => s.trim());
    const keySentences = sentences.slice(0, Math.min(3, sentences.length));
    result = {
      summary: keySentences.length > 0
        ? keySentences.join(". ") + "."
        : "No content provided to summarize.",
      keyTopics: [...new Set(words.filter((w) => w.length > 5))].slice(0, 5),
      originalLength: words.length,
      summaryLength: keySentences.join(". ").split(/\s+/).length,
      compressionRatio: words.length > 0
        ? parseFloat((keySentences.join(". ").split(/\s+/).length / words.length).toFixed(2))
        : 0,
      model: "fallback",
    };
  }

  return NextResponse.json({
    skillId: 5,
    skill: "Summarizer",
    result,
    timestamp: new Date().toISOString(),
  });
};

export const POST = withGateway(handler, "$0.001", "/api/skills/summarizer");
