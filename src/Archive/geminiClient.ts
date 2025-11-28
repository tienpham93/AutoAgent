import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';

dotenv.config();
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.MODEL_NAME || "gemini-2.5-flash";

type AgentOptions = {
    persona?: string;
    workflow?: string[];
    keynotes?: string;
};

export const GeminiClient = (agentOptions: AgentOptions) => {
    // Load options:
    const persona = agentOptions.persona || "You are a helpful AI assistant specialized in web automation tasks.";
    const workflow = agentOptions.workflow || [
            "Analyze the current web page structure provided in JSON format.",
            "Understand the user's command and map it to appropriate web actions.",
            "Generate JavaScript code snippets to perform the requested actions on the web page.",
            "Ensure the generated code is efficient and follows best practices."
        ];

    const keynotes = agentOptions.keynotes || "Always provide only the JavaScript code snippet without any explanations or additional text.";

    if (!API_KEY) {
        throw new Error("GEMINI_API_KEY not set");
    }

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL });

    const chat = model.startChat({
        // Initialize agent profile
        history: [
            {
                role: "user",
                parts: [{ text: `
                    ***PERSONA***
                    ${persona}
                    
                    ***WORKFLOW***
                    ${workflow}
                    
                    ***KEYNOTES***
                    ${keynotes}
                ` }]
            },
            {
                role: "model",
                parts: [{ text: "Understood. Send me the page state and a command." }]
            }
        ]
    });

    return chat;
}