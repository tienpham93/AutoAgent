import { AgentConfig } from "../types";
import { BaseAgent } from "./BaseAgent";

export class ExtractorAgent extends BaseAgent {
    constructor(config: AgentConfig) {
        super(config);
    }

    async parse(rawMarkdown: string): Promise<any> {
        const result = await this.sendToLLM(rawMarkdown);
        // Clean up code blocks if Gemini adds them
        const cleanJson = result.replace(/```json/g, "").replace(/```/g, "").trim();
        return await JSON.parse(cleanJson);
    }
}