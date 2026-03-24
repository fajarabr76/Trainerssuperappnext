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
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: options.model || "gemini-1.5-flash",
      contents: options.contents,
      config: {
        systemInstruction: options.systemInstruction,
        responseMimeType: options.responseMimeType,
        responseSchema: options.responseSchema,
        temperature: options.temperature ?? 0.7,
        responseModalities: options.responseModalities as any,
        speechConfig: options.speechConfig,
      }
    });

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
