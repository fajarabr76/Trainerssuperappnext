'use server';

/**
 * Server Action to call OpenRouter API.
 * Designed to mirror the structure of generateGeminiContent for easy routing.
 */
export async function generateOpenRouterContent(options: {
  model?: string;
  systemInstruction?: string;
  contents: { role: string; parts: { text: string }[] }[];
  temperature?: number;
  responseMimeType?: string;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const modelId = options.model || 'z-ai/glm-4.5-air:free';

  if (!apiKey) {
    return { success: false, error: "OPENROUTER_API_KEY is not set in environment variables." };
  }

  try {
    // Map Gemini-style contents to OpenAI-style messages
    const messages: any[] = [];

    // Add system instruction if present
    let systemMsg = options.systemInstruction || "";
    
    // If JSON is requested, ensure system prompt is explicit about it
    if (options.responseMimeType === 'application/json') {
      systemMsg += "\n\nIMPORTANT: Respond in valid JSON format only.";
    }

    if (systemMsg) {
      messages.push({ role: 'system', content: systemMsg });
    }

    // Add conversation history
    for (const content of options.contents) {
      const role = content.role === 'model' ? 'assistant' : 'user';
      const text = content.parts.map(p => p.text).join(' ');
      messages.push({ role, content: text });
    }

    const maxAttempts = 4;
    let attempt = 0;
    let lastResponse: Response | null = null;

    while (attempt < maxAttempts) {
      attempt++;
      lastResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Trainers Superapp",
        },
        body: JSON.stringify({
          model: modelId,
          messages: messages,
          temperature: options.temperature ?? 0.7,
          response_format: (options.responseMimeType === 'application/json' && !modelId.includes(':free')) 
            ? { type: 'json_object' } 
            : undefined,
        }),
      });

      if (lastResponse.ok) break;

      // Handle 429 (busy / rate limit) with short backoff between attempts
      if (lastResponse.status === 429 && attempt < maxAttempts) {
        const delayMs = 2500 + attempt * 1500;
        console.warn(
          `[OpenRouter Action] Rate limited (429). Attempt ${attempt}/${maxAttempts}. Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      break;
    }

    if (!lastResponse || !lastResponse.ok) {
      const status = lastResponse?.status || 500;
      const errorText = lastResponse ? await lastResponse.text() : "No response from server";
      
      console.warn(`[OpenRouter Action] Error ${status}:`, errorText);

      if (status === 429) {
        return { success: false, error: "Server AI sedang sibuk karena banyak pengguna. Mohon tunggu 5-10 detik lalu coba lagi." };
      }
      if (status === 401) {
        return { success: false, error: "API Key OpenRouter tidak valid atau sudah kedaluwarsa." };
      }
      
      try {
        const errJson = JSON.parse(errorText);
        return { success: false, error: errJson.error?.message || `AI Error (${status})` };
      } catch {
        return { success: false, error: `Gagal menghubungi server AI (Error ${status}).` };
      }
    }

    const data = await lastResponse.json();

    if (data.error) {
      console.warn("[OpenRouter Action] API Error:", data.error);
      return { success: false, error: data.error.message || "Model AI tidak tersedia saat ini." };
    }

    const text = data.choices?.[0]?.message?.content || "";
    return { success: true, text };

  } catch (error: unknown) {
    console.warn("[OpenRouter Action] Exception:", error);
    return { success: false, error: "Terjadi kesalahan koneksi ke server AI. Periksa internet Anda." };
  }
}
