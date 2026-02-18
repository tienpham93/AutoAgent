import { BaseAgent } from "./BaseAgent";
import { FileHelper } from "../Utils/FileHelper";
import { AgentConfig, AgentState, InspectionResult } from "../types";
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

        const logContent = FileHelper.readFile(state.inspector_logFilePath);
        const fullPrompt = this.buildPrompt(
            `${RULES_DIR}/build_inspection_prompt.njk`,
            {
                logContent: logContent
            }
        );

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
            const inspectionResult = JSON.parse(cleanJson) as InspectionResult;
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

    public async writeInspectionToFile(inspection: any, targetFilePath: string): Promise<void> {
        let allInspections: any[] = [];
    
        if (fs.existsSync(targetFilePath)) {
            try {
                const raw = fs.readFileSync(targetFilePath, 'utf-8');
                const parsed = JSON.parse(raw);
                // Ensure the existing data is an array
                allInspections = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                console.warn(`[${this.agentId}][🕵️] >> ⚠️ Existing file corrupted or invalid JSON. Starting fresh.`);
            }
        }
    
        // Append the new data
        if (Array.isArray(inspection)) {
            allInspections.push(...inspection);
        } else {
            allInspections.push(inspection);
        }
    
        // Write back to file
        try {
            fs.writeFileSync(targetFilePath, JSON.stringify(allInspections, null, 2));
            console.log(`[${this.agentId}][🕵️] >> 💾 Results updated and saved to ${path.basename(targetFilePath)}`);
        } catch (e) {
            console.error(`[${this.agentId}][🕵️] >> ❌ Save failed: ${e}`);
        }
    }

}