import { GenerativeModel, ChatSession, GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { AgentConfig, LLMVendor } from "../types";

export class BaseAgent {
    // Configuration
    protected config: AgentConfig;

    // Vendor Specific State
    private geminiModel?: GenerativeModel;
    private geminiChat?: ChatSession;
    private claudeClient?: Anthropic;
    private claudeHistory: Anthropic.MessageParam[] = [];

    constructor(config: AgentConfig) {
        this.config = { vendor: LLMVendor.GEMINI, ...config };
        this.initializeVendor();
    }


    /**
     * 🚀 Public Methods to send user's request to LLMs
     */
    public async sendToLLM(message: string, maxRetries = 5): Promise<string> {
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                // Route execution based on vendor
                switch (this.config.vendor) {
                    case LLMVendor.CLAUDE:
                        return await this._callClaude(message);
                    case LLMVendor.GEMINI:
                    default:
                        return await this._callGemini(message);
                }

            } catch (error: any) {
                if (this.isQuotaError(error)) {
                    console.log(`[🤖🤖🤖] >> ${this.config.vendor?.toUpperCase()} ⏳ Waiting 10s to respect quota...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    attempt++;
                } else {
                    console.error(`[🤖🤖🤖] >> ${this.config.vendor?.toUpperCase()} ☠️ Error:`, error);
                    break; 
                }
            }
        }
        return "{}"; // Fail safe
    }

    public async sendWithVideoToLLM(message: string, fileUri: string, mimeType: string, maxRetries = 5): Promise<string> {
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                // Currently only Gemini supports video input
                return await this._callGeminiWithVideo(message, fileUri, mimeType);
            } catch (error: any) {
                console.error(`[🤖🤖🤖] >> ${this.config.vendor?.toUpperCase()} ☠️ Video Error Attempt ${attempt+1}:`, error.message);
                if (this.isQuotaError(error)) {
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    attempt++;
                } else {
                    break;
                }
            }
        }
        return "{}"; // Fail safe
    }


    /**
     * 🏭 Vendor Factory: Switch case to handle initialization
     */
    private initializeVendor(): void {
        switch (this.config.vendor) {
            case LLMVendor.CLAUDE:
                this.initClaude();
                break;
            case LLMVendor.GEMINI:
            default:
                this.initGemini();
                break;
        }
    }

    private initGemini() {
        const genAI = new GoogleGenerativeAI(this.config.apiKey);
        this.geminiModel = genAI.getGenerativeModel({
            model: this.config.model,
            systemInstruction: this.buildSystemPrompt()
        });
        this.geminiChat = this.geminiModel.startChat();
    }

    private initClaude() {
        this.claudeClient = new Anthropic({
            apiKey: this.config.apiKey,
        });
        // Claude is stateless; system prompt is passed per request
    }


    /**
     * 🏅 Vendor Callers
     * Methods to interact with specific LLM vendors
     */
    private async _callGemini(message: string): Promise<string> {
        if (!this.geminiChat) throw new Error("Gemini Chat not initialized");
        
        const result = await this.geminiChat.sendMessage(message);
        return result.response.text();
    }

    private async _callGeminiWithVideo(message: string, fileUri: string, mimeType: string): Promise<string> {
        if (!this.geminiModel) throw new Error("Gemini Model not initialized");

        // Use generateContent (stateless) instead of chat for video analysis
        // This allows passing the fileData object directly
        const result = await this.geminiModel.generateContent([
            { 
                fileData: { 
                    mimeType: mimeType, 
                    fileUri: fileUri 
                } 
            },
            { text: message }
        ]);

        return result.response.text();
    }

    private async _callClaude(message: string): Promise<string> {
        if (!this.claudeClient) throw new Error("Claude Client not initialized");

        // Maintain History Manually
        this.claudeHistory.push({ role: 'user', content: message });

        // Send Request
        const response = await this.claudeClient.messages.create({
            model: this.config.model,
            max_tokens: 4096,
            system: this.buildSystemPrompt(), 
            messages: this.claudeHistory,
        });

        // Extract & Update History
        const textBlock = response.content.find(block => block.type === 'text');
        const responseText = textBlock?.type === 'text' ? textBlock.text : "";

        this.claudeHistory.push({ role: 'assistant', content: responseText });

        return responseText;
    }

    
    /**
     * ⚙️ Utility Methods
     * Helper functions for prompt building and error handling
     */
    private buildSystemPrompt(): string {
        return this.config.persona + 
               (this.config.initialContexts ? "\n" + this.config.initialContexts.join("\n") : "");
    }

    private isQuotaError(error: any): boolean {
        const msg = (error.message || "").toLowerCase();
        return (
            msg.includes("429") || 
            msg.includes("503") || 
            msg.includes("too many requests") ||
            error.status === 429
        );
    }
}