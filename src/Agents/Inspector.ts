import { BaseAgent } from "./BaseAgent";
import { FileHelper } from "../Utils/FileHelper";
import { AgentConfig, AgentState } from "../types";
import { RULES_DIR } from "../settings";
import * as fs from 'fs';
import * as path from 'path';
import { CommonHelper } from "../Utils/CommonHelper";

export class Inspector extends BaseAgent {

    constructor(config: AgentConfig) {
        super(config);
        this.agentId = `Inspector_${CommonHelper.generateUUID()}`;
    }

    public async InspectionNode(state: AgentState): Promise<any> {
        console.log(`[${this.agentId}][🔍] >> Inspecting log file at: ${state.inspector_logFilePath}`);

        let fullPrompt = '';
        if (state.inspector_logFilePath) {
            const logContent = FileHelper.readFile(state.inspector_logFilePath);
            fullPrompt = this.buildPrompt(
                `${RULES_DIR}/build_inspection_prompt.njk`,
                {
                    logContent: logContent
                }
            );
        } else {
            fullPrompt = this.buildPrompt(
                `${RULES_DIR}/analyze_system_health.njk`
            );
        }

        const userMessage = await this.buildMessageContent(
            [
                {
                    type: "text",
                    text: fullPrompt
                }
            ]
        );

        const messagesForLLM = [...state.messages, userMessage];
        try {
            const response = await this.sendToLLM({ ...state, messages: messagesForLLM });

            return {
                success: true,
                error: null,
                messages: [...state.messages, response]
            };
        } catch (error) {
            console.error(`[${this.agentId}][🕵️] >> 💥 Inspection Error:`, error);
            return {
                success: false,
                error: error,
                attempts: (state.attempts || 0) + 1
            };
        }
    }

    public async postInspectionNode(state: AgentState): Promise<any> {
        const lastMessage = state.messages[state.messages.length - 1];
        const lastMessageText = lastMessage?.content?.toString() || "{}";
        console.log(`[${this.agentId}][🕵️] >> 📝 Inspection Response:`, lastMessageText);

        try {
            const cleanJson = lastMessageText.replace(/```json|```/g, '').trim();
            const inspectionResult = JSON.parse(cleanJson) as any;
            return {
                inspector_inspectionResult: inspectionResult,
                messages: state.messages
            };
        } catch (error) {
            console.error(`[${this.agentId}][🕵️] >> ❌ Post-Inspection Parsing Error:`, error);
            return {
                inspector_inspectionResult: null,
                messages: state.messages,
                error: "Failed to parse inspection result."
            };
        }

    }

}