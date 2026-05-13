
import { GoogleGenAI } from "@google/genai";

export const getAIMove = async (fen: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<string> => {
  const prompt = `You are a Grandmaster chess engine playing as ${difficulty} difficulty. Current position FEN: ${fen}. Return ONLY the best move in Standard Algebraic Notation (SAN). Do not explain.`;
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: difficulty === 'easy' ? 0.8 : difficulty === 'medium' ? 0.4 : 0.1,
      }
    });
    const text = response.text;
    return text ? text.trim().split(' ')[0] : "";
  } catch (error) {
    console.error("[AI Move Error]", error);
    return "";
  }
};
