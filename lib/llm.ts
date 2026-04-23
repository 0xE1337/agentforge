/**
 * Shared LLM client for skill endpoints.
 * Uses DeepSeek (OpenAI-compatible). Falls back gracefully if no API key.
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE = "https://api.deepseek.com/v1/chat/completions";

export async function llmCall(
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  if (!DEEPSEEK_API_KEY) return null;

  try {
    const res = await fetch(DEEPSEEK_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 512,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
