/**
 * Shared LLM client for skill endpoints.
 *
 * Tries providers in order: OpenAI (primary), DeepSeek (fallback).
 * Both speak the same OpenAI-compatible /chat/completions shape, so a single
 * request body works for either. Each provider gets a hard 15s timeout via
 * AbortController so a hanging upstream falls back instead of stalling the
 * whole orchestrator.
 *
 * Returns null only if every configured provider fails or none is configured.
 */

interface Provider {
  name: string;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
}

const PROVIDER_TIMEOUT_MS = 15_000;

const providers: Provider[] = [
  {
    name: "openai",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  },
  {
    name: "deepseek",
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    apiKey: process.env.DEEPSEEK_API_KEY,
    // "deepseek-chat" is DeepSeek's rolling alias (auto-tracks latest stable).
    // Override via DEEPSEEK_MODEL to pin a specific version
    // (e.g. "deepseek-v4", "deepseek-reasoner") per their published model list.
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  },
];

async function callProvider(
  provider: Provider,
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const res = await fetch(provider.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 512,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(
        `[llm] ${provider.name} returned ${res.status}; trying next provider`,
      );
      return null;
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reason = controller.signal.aborted
      ? `timeout after ${PROVIDER_TIMEOUT_MS}ms`
      : message;
    console.warn(`[llm] ${provider.name} failed (${reason}); trying next`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function llmCall(
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  for (const provider of providers) {
    if (!provider.apiKey) continue;
    const result = await callProvider(provider, systemPrompt, userPrompt);
    if (result !== null) return result;
  }
  return null;
}
