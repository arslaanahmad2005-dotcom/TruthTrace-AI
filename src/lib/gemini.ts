import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeWithGemini(
  type: "image" | "document" | "payment",
  fileData: string, // base64
  mimeType: string,
  extraFeatures: any
) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are an expert forensic analyst for TruthTrace AI. 
    Analyze the provided ${type} for authenticity.
    
    Backend Analysis Features (Extracted via OCR and Signal Processing):
    ${JSON.stringify(extraFeatures, null, 2)}
    
    CRITICAL CALIBRATION FOR PAYMENTS:
    - If "backendVerdict" is provided, it represents a rule-based scoring of the screenshot's data (UPI, TxID, Date, etc.).
    - Use "backendVerdict" as the primary source of truth.
    - NEVER classify as FAKE based on a single factor (e.g., just a future date or just a missing UPI).
    - DO NOT infer year or date from UTR or Transaction ID.
    - DO NOT mark FAKE based on font weight differences, color differences, or minor UI design variations. These are not reliable fraud indicators.
    - Allow future dates up to +72 hours (timezone/server delay).
    - Only verdict as FAKE if MULTIPLE strong failures exist (e.g., impossible amount mismatch AND clear visual cloning artifacts).
    - If the backend says "REAL" or "SUSPICIOUS" and you see no extreme visual tampering, favor the backend's verdict.
    - Prioritize avoiding false positives over catching all frauds.
    
    Tasks:
    1. Detect if the image/document is a deepfake or manipulated.
    2. Look for pixel inconsistencies, metadata anomalies, or layout irregularities.
    3. For payments, verify if the UI structure is consistent with standard fintech apps (relaxed matching).
    4. Provide a confidence score (0-100).
    5. Give a detailed explanation using ONLY safe logic (e.g., "Valid UPI format", "Transaction marked successful"). Avoid mentioning "font inconsistencies" or "UTR mismatches" unless they are extreme and verified.
    
    Return the result in JSON format:
    {
      "verdict": "REAL" | "FAKE" | "SUSPICIOUS",
      "confidence": number,
      "explanation": string,
      "anomalies": string[],
      "heatmapPoints": { x: number, y: number, intensity: number }[] 
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { data: fileData.split(",")[1] || fileData, mimeType } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json"
    }
  });

  let text = response.text || "{}";
  // Remove markdown code blocks if present
  text = text.replace(/```json\n?|```/g, "").trim();
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Gemini response:", text);
    return {
      verdict: "SUSPICIOUS",
      confidence: 50,
      explanation: "AI analysis failed to produce a structured result, but the backend signals are available.",
      anomalies: ["AI Parsing Error"],
      heatmapPoints: []
    };
  }
}
