import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Target, Prober } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in environment variables. AI features will be disabled or mocked.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const suggestConfiguration = async (url: string, probers: Prober[]): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "AI Configuration unavailable: Missing API Key.";

  const prompt = `
    I need to configure a Prometheus Blackbox Exporter target for the URL: "${url}".
    
    Available Probers: ${JSON.stringify(probers.map(p => ({ name: p.name, modules: p.modules })))}
    
    Please suggest:
    1. The best matching 'module' from the available probers (e.g., http_2xx, icmp).
    2. A set of recommended labels (key=value) for a production environment.
    3. A brief explanation of why.

    Format the response as JSON with keys: recommendedModule, recommendedLabels (array of objects with key/value), explanation.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    return response.text || "{}";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return JSON.stringify({ error: "Failed to generate suggestion" });
  }
};

export const naturalLanguageSearch = async (query: string, targets: Target[]): Promise<string[]> => {
  const ai = getAiClient();
  if (!ai) return [];

  const prompt = `
    You are a smart search assistant for a monitoring system.
    
    User Query: "${query}"
    
    Current Targets Data:
    ${JSON.stringify(targets.map(t => ({ id: t.id, name: t.name, url: t.url, labels: t.labels, status: t.status })))}
    
    Return a JSON array containing ONLY the 'id' strings of the targets that match the user's intent.
    Example: ["t1", "t3"]
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return [];
  }
};
