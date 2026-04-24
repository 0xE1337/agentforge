/**
 * Shared LLM client for skill endpoints.
 *
 * Tries providers in order: DeepSeek (primary), OpenAI (fallback).
 * Both speak the same OpenAI-compatible /chat/completions shape, so a single
 * request body works for either. Returns null only if every configured
 * provider fails or none is configured.
 */

interface Provider {
  name: string;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
}

const providers: Provider[] = [
  {
    name: "deepseek",
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: "deepseek-chat",
  },
  {
    name: "openai",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  },
];

async function callProvider(
  provider: Provider,
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
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
    console.warn(`[llm] ${provider.name} threw: ${message}; trying next`);
    return null;
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
