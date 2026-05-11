
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysis } from "../types";

// Always create a new GoogleGenAI instance right before making an API call to ensure it uses the most up-to-date API key.
export const analyzeChessPosition = async (fen: string, history: string[]): Promise<AIAnalysis> => {
  try {
    // Fix: Instantiate GoogleGenAI with exactly { apiKey: process.env.API_KEY } inside the function.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this chess position in FEN: ${fen}. Recent history: ${history.slice(-5).join(', ')}. Provide a strategic analysis including the best move (in SAN format), a brief evaluation, and an explanation of the plan.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bestMove: { type: Type.STRING, description: "The best move for the current player in Standard Algebraic Notation (e.g., 'Nf3', 'exd5')." },
            evaluation: { type: Type.STRING, description: "Evaluation like '+1.2', '-0.5', or 'Equal'." },
            explanation: { type: Type.STRING, description: "Detailed strategic explanation." },
            suggestions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of 2-3 candidate moves."
            },
          },
          required: ["bestMove", "evaluation", "explanation", "suggestions"],
        }
      },
    });

    // Fix: Use .text property (not a method) to extract output.
    const text = response.text;
    if (!text) throw new Error("No response text received");
    return JSON.parse(text.trim()) as AIAnalysis;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      bestMove: "Unable to analyze",
      evaluation: "N/A",
      explanation: "Could not connect to analysis engine.",
      suggestions: []
    };
  }
};

export const getAIMove = async (fen: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<string> => {
  const prompt = `You are a Grandmaster chess engine playing as ${difficulty} difficulty. Current position FEN: ${fen}. Return ONLY the best move in Standard Algebraic Notation (SAN). Do not explain.`;
  
  try {
    // Fix: Instantiate GoogleGenAI with exactly { apiKey: process.env.API_KEY } inside the function.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: difficulty === 'easy' ? 1.0 : 0.2,
      }
    });
    // Fix: Use .text property to extract output.
    const text = response.text;
    return text ? text.trim().split(' ')[0] : "";
  } catch (error) {
    return "";
  }
};
