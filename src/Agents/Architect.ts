import { AgentConfig, AgentState } from "../types";
import { CommonHelper } from "../Utils/CommonHelper";
import { BaseAgent } from "./BaseAgent";

export class Architect extends BaseAgent {

    constructor(config: AgentConfig) {
        super(config);
        this.agentId = `Extractor_${CommonHelper.generateUUID()}`;
    }

    public async extractionNode(state: AgentState): Promise<any> {
        const userMessage = await this.buildMessageContent(
            [
                {
                    type: "text",
                    text: state.architect_rawTestCase
                },
            ]
        );

        const messagesForLLM = [...state.messages, userMessage];

        const response = await this.sendToLLM({ ...state, messages: messagesForLLM });
        const contentString = response.content.toString();

        // Clean up code blocks
        const cleanJson = contentString.replace(/```json/g, "").replace(/```/g, "").trim();

        let parsedResult;
        try {
            parsedResult = JSON.parse(cleanJson);
        } catch (e) {
            console.error(`[${this.agentId}][🚁] >> JSON Parse Error:`, cleanJson);
            throw e;
        }

        return {
            ...state,
            extractor_extractedTestcases: parsedResult
        };
    }
}