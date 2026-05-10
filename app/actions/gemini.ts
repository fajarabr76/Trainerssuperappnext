'use server';

import { GoogleGenAI, Content, Schema, SpeechConfig } from "@google/genai";
import { createClient } from "@/app/lib/supabase/server";
import { consumeRateLimit } from "@/app/lib/rate-limit";
import { randomUUID } from "crypto";
import { logAiUsage, type UsageContext } from "@/app/lib/ai-usage";
import { getProviderFromModelId } from "@/app/lib/ai-models";

export interface GeminiResponse {
  success: boolean;
  text?: string;
  audioData?: string;
  error?: string;
}

// SDK format response bisa berubah antar versi @google/genai —
// helper ini memastikan ekstraksi text kompatibel lintas versi.
function resolveResponseText(
  response: {
    text?: unknown;
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; inlineData?: unknown }> };
    }>;
  }
): string {
  // v1.x lama: text adalah function
  if (typeof response.text === "function") {
    return (response as { text: () => string }).text();
  }
  // v1.29+: text sudah berupa string langsung
  if (typeof response.text === "string") {
    return response.text;
  }
  // Fallback manual ke candidates[0].content.parts
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const joined = parts.map((p) => p.text ?? "").join("");
  return joined;
}

export async function generateGeminiContent(options: {
  model?: string;
  systemInstruction?: string;
  contents: Content[];
  responseMimeType?: string;
  responseSchema?: Schema;
  temperature?: number;
  responseModalities?: string[];
  speechConfig?: SpeechConfig;
  usageContext?: UsageContext;
  userId?: string;
  abortSignal?: AbortSignal;
}): Promise<GeminiResponse> {
  try {
    const supabase = await createClient();
    const [{ data: { user } }, { data: { session } }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);

    const authenticatedUserId = user?.id || session?.user?.id || null;

    if (options.userId && authenticatedUserId && options.userId !== authenticatedUserId) {
      console.warn(
        `[Gemini Action] options.userId "${options.userId}" mismatched with auth user "${authenticatedUserId}".`
      );
    }

    // Rate limit: 30 requests per minute per user.
    // CRITICAL SECURITY: The rate limit key MUST only use server-verified identity.
    // If we use options.userId here, an unauthenticated attacker can bypass limits by rotating IDs.
    const rateLimitKey = authenticatedUserId ? `gemini:${authenticatedUserId}` : `gemini:anon`;
    const rateLimit = await consumeRateLimit({
      key: rateLimitKey,
      limit: authenticatedUserId ? 30 : 5, // Stricter limit for unauthenticated/anon requests
      windowMs: 60 * 1000,
    });



    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Rate limit exceeded. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }
    const ai = new GoogleGenAI({ apiKey });
    const modelName = options.model || "gemini-3.1-flash-lite";

    const buildRequest = (withSystemInstruction: boolean) => ({
      model: modelName,
      contents: withSystemInstruction
        ? options.contents
        : injectSystemInstructionIntoContents(options.contents, options.systemInstruction),
      config: {
        systemInstruction: withSystemInstruction ? options.systemInstruction : undefined,
        responseMimeType: options.responseMimeType,
        responseSchema: options.responseSchema,
        temperature: options.temperature ?? 0.7,
        responseModalities: options.responseModalities as string[],
        speechConfig: options.speechConfig,
        abortSignal: options.abortSignal,
      }
    });

    let response;
    try {
      response = await ai.models.generateContent(buildRequest(true));
    } catch (firstError: unknown) {
      const err = firstError as { message?: string };
      const isDeveloperInstructionUnsupported =
        typeof err?.message === 'string' &&
        err.message.includes('Developer instruction is not enabled');

      if (!isDeveloperInstructionUnsupported || !options.systemInstruction) {
        throw firstError;
      }

      console.warn(
        `[Gemini Action] Model "${modelName}" does not support developer instruction. Retrying without systemInstruction.`
      );
      response = await ai.models.generateContent(buildRequest(false));
    }

    let audioData: string | undefined;
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          audioData = part.inlineData.data;
          break;
        }
      }
    }

    if (options.usageContext && authenticatedUserId) {
      const usage = (response as { usageMetadata?: unknown })?.usageMetadata;
      if (usage && typeof usage === 'object') {
        const u = usage as Record<string, unknown>;
        const inputTokens = typeof u.promptTokenCount === 'number' ? u.promptTokenCount : 0;
        const outputTokens = typeof u.candidatesTokenCount === 'number' ? u.candidatesTokenCount : 0;
        const totalTokens = typeof u.totalTokenCount === 'number' ? u.totalTokenCount : inputTokens + outputTokens;

        if (inputTokens > 0 || outputTokens > 0) {
          const modelName = options.model || "gemini-3.1-flash-lite";
          const provider = getProviderFromModelId(modelName);
          const requestId = `gemini-${randomUUID()}`;

          await logAiUsage({
            requestId,
            userId: authenticatedUserId,
            provider: provider as 'gemini' | 'openrouter',
            modelId: modelName,
            usageContext: options.usageContext,
            tokens: { inputTokens, outputTokens, totalTokens },
          });
        } else {
          console.warn('[Gemini Action] Token metadata missing from response. Usage not logged.');
        }
      } else {
        console.warn('[Gemini Action] Token metadata missing from response. Usage not logged.');
      }
    }

    return {
      success: true,
      text: resolveResponseText(response),
      audioData
    };
  } catch (error: unknown) {
    console.error("[Gemini Action] Error generating content:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function injectSystemInstructionIntoContents(contents: Content[], systemInstruction?: string): Content[] {
  if (!systemInstruction) return contents;

  // Generate a unique boundary for this specific request to prevent spoofing
  const boundary = `BLOCK_${randomUUID().replace(/-/g, '')}`;
  
  const instructionText = `
[SYSTEM_CONTEXT_START:${boundary}]
${systemInstruction}
[SYSTEM_CONTEXT_END:${boundary}]

[USER_INPUT_START:${boundary}]
`;
  const footerText = `\n[USER_INPUT_END:${boundary}]`;

  const cloned = Array.isArray(contents) ? [...contents] : [];

  const firstUserIndex = cloned.findIndex((c) => c?.role === 'user' && Array.isArray(c?.parts));
  if (firstUserIndex >= 0) {
    const firstUser = { ...cloned[firstUserIndex] };
    const firstParts = Array.isArray(firstUser.parts) ? [...firstUser.parts] : [];
    
    // Normalize user input and wrap it
    const firstTextPartIndex = firstParts.findIndex((p) => typeof p?.text === 'string');
    if (firstTextPartIndex >= 0) {
      // Sanitize: Strip any attempts to close our unique boundary early or mimic it
      let sanitizedText = firstParts[firstTextPartIndex].text || "";
      sanitizedText = sanitizedText.replace(new RegExp(`\\[USER_INPUT_END:${boundary}\\]`, 'g'), '');
      sanitizedText = sanitizedText.replace(/\[USER_INPUT_(START|END):BLOCK_[0-9a-f]+\]/g, '');
      
      firstParts[firstTextPartIndex] = {
        ...firstParts[firstTextPartIndex],
        text: `${instructionText}${sanitizedText.trim()}${footerText}`,
      };
    } else {
      firstParts.unshift({ text: instructionText });
      firstParts.push({ text: footerText });
    }

    firstUser.parts = firstParts;
    cloned[firstUserIndex] = firstUser;
    return cloned;
  }

  return [{ role: 'user', parts: [{ text: instructionText }, { text: footerText }] }, ...cloned];
}
