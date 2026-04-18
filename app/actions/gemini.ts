'use server';

import { GoogleGenAI, Content, Schema, SpeechConfig } from "@google/genai";

export interface GeminiResponse {
  success: boolean;
  text?: string;
  audioData?: string;
  error?: string;
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
}): Promise<GeminiResponse> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }
    const ai = new GoogleGenAI({ apiKey });
    const modelName = options.model || "gemini-1.5-flash";

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

        return {
        success: true,
        text: response.text(),
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

  const instructionText = `[System Instruction]\n${systemInstruction}\n\n[User Request]\n`;
  const cloned = Array.isArray(contents) ? [...contents] : [];

  const firstUserIndex = cloned.findIndex((c) => c?.role === 'user' && Array.isArray(c?.parts));
  if (firstUserIndex >= 0) {
    const firstUser = { ...cloned[firstUserIndex] };
    const firstParts = Array.isArray(firstUser.parts) ? [...firstUser.parts] : [];
    const firstTextPartIndex = firstParts.findIndex((p) => typeof p?.text === 'string');

    if (firstTextPartIndex >= 0) {
      firstParts[firstTextPartIndex] = {
        ...firstParts[firstTextPartIndex],
        text: `${instructionText}${firstParts[firstTextPartIndex].text}`,
      };
    } else {
      firstParts.unshift({ text: instructionText });
    }

    firstUser.parts = firstParts;
    cloned[firstUserIndex] = firstUser;
    return cloned;
  }

  return [{ role: 'user', parts: [{ text: instructionText }] }, ...cloned];
}
