import { GoogleGenAI, Type } from "@google/genai";
import { UserPlan } from "../types";

export const generateTrainingPlan = async (transcript: string): Promise<UserPlan> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // If transcript is too short, use a default fallback to avoid errors
  const promptContext = transcript.length > 50 
    ? `Based on the following conversation transcript between an English tutor and a student, assess the student's level and create a study plan:\n\n${transcript}`
    : `The user is a beginner English learner. Create a beginner study plan.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: promptContext,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          level: { type: Type.STRING, description: "CEFR Level (e.g., A1, B2)" },
          feedback: { type: Type.STRING, description: "Brief constructive feedback on strengths and weaknesses." },
          scenarios: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                difficulty: { type: Type.STRING, enum: ["Beginner", "Intermediate", "Advanced"] },
                objective: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text) as UserPlan;
  }
  
  throw new Error("Failed to generate plan");
};
