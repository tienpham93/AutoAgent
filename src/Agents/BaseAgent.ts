import { GenerativeModel, ChatSession, GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiClient } from "../types";

export class BaseAgent {
    protected model: GenerativeModel;
    protected chat: ChatSession;

    constructor(geminiClient: GeminiClient) {
        const genAI = new GoogleGenerativeAI(geminiClient.apiKey);
        this.model = genAI.getGenerativeModel({
            model: geminiClient.model,
            systemInstruction: 
                geminiClient.persona + (geminiClient.intialContexts ? "\n" + geminiClient.intialContexts.join("\n") : "")
        });
        this.chat = this.model.startChat();
    }

    public async sendToLLM(message: string): Promise<string> {
        const maxRetries = 5;
        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                const result = await this.chat.sendMessage(message);
                return result.response.text();
            } catch (error: any) {
                // Check if it is a Quota/Rate Limit error
                if (error.message.includes("429") || 
                    error.message.includes("503") || 
                    error.message.includes("Too Many Requests")
                ) {
                    console.log("[🤖🤖🤖] >> ⏳ Waiting 10s to respect quota...");
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    attempt++; // Increment attempt counter
                } else {
                    console.error(`[🤖🤖🤖] >> ☠️ Error:`, error);
                    break; // Exit retry loop on non-quota errors
                }
            }
        }
        return "{}"; // Return empty JSON on fail
    }
}