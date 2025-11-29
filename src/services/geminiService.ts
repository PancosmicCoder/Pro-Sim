import { GoogleGenAI } from "@google/genai";
import { CircuitComponent, Wire, ComponentType } from "../types";

// Fix: Declare process to avoid TypeScript error as per guidelines to use process.env.API_KEY
declare const process: { env: { API_KEY?: string } };

const SYSTEM_PROMPT = `You are an expert Electrical Engineer and Circuit Analyst. 
Your role is to analyze circuit netlists provided by the user.
Provide a concise but professional explanation of:
1. What the circuit likely does (function).
2. Calculate theoretical node voltages if simple enough, or describe the current flow.
3. Point out any potential issues (e.g., short circuits across voltage sources, floating nodes).
Format your response in Markdown using bolding for key values. Keep it under 200 words unless complex.`;

export const analyzeCircuit = async (components: CircuitComponent[], wires: Wire[]): Promise<string> => {
  try {
    // Fix: Use process.env.API_KEY exclusively as per guidelines
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
        throw new Error("API Key not found. Please ensure process.env.API_KEY is set.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Convert circuit to a readable text format (Netlist-like)
    let netlist = "Components:\n";
    components.forEach(c => {
      netlist += `- ${c.label} (${c.type}): ${c.value}\n`;
    });
    
    netlist += "\nConnections (Wires):\n";
    wires.forEach(w => {
      const fromC = components.find(c => c.id === w.from.componentId)?.label || '?';
      const toC = components.find(c => c.id === w.to.componentId)?.label || '?';
      netlist += `- From ${fromC} (Pin ${w.from.portIndex}) to ${toC} (Pin ${w.to.portIndex})\n`;
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Here is the circuit netlist:\n\n${netlist}\n\nPlease analyze this circuit.`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      }
    });

    return response.text || "No analysis generated.";

  } catch (error: any) {
    console.error("Gemini Analysis Failed", error);
    return `Analysis failed: ${error.message || "Unknown error"}. Please check your API Key.`;
  }
};