'use server';

import { GoogleGenAI } from "@google/genai";

export async function generateGeminiContent(options: {
  model?: string;
  systemInstruction?: string;
  contents: any[];
  responseMimeType?: string;
  responseSchema?: any;
  temperature?: number;
  responseModalities?: string[];
  speechConfig?: any;
}) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }
    const ai = new GoogleGenAI({ apiKey });
    const model = options.model || "gemini-1.5-flash";

    const buildRequest = (withSystemInstruction: boolean) => ({
      model,
      contents: withSystemInstruction
        ? options.contents
        : injectSystemInstructionIntoContents(options.contents, options.systemInstruction),
      config: {
        systemInstruction: withSystemInstruction ? options.systemInstruction : undefined,
        responseMimeType: options.responseMimeType,
        responseSchema: options.responseSchema,
        temperature: options.temperature ?? 0.7,
        responseModalities: options.responseModalities as any,
        speechConfig: options.speechConfig,
      }
    });

    let response;
    try {
      response = await ai.models.generateContent(buildRequest(true));
    } catch (firstError: any) {
      const isDeveloperInstructionUnsupported =
        typeof firstError?.message === 'string' &&
        firstError.message.includes('Developer instruction is not enabled');

      if (!isDeveloperInstructionUnsupported || !options.systemInstruction) {
        throw firstError;
      }

      console.warn(
        `[Gemini Action] Model "${model}" does not support developer instruction. Retrying without systemInstruction.`
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
      text: response.text,
      audioData
    };
  } catch (error: any) {
    console.error("Gemini Server Action Error:", error);
    return { 
      success: false, 
      error: error.message || "Failed to generate content" 
    };
  }
}

function injectSystemInstructionIntoContents(contents: any[], systemInstruction?: string) {
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
