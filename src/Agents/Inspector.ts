import { BaseAgent } from "./BaseAgent";
import { FileHelper } from "../Utils/FileHelper";
import { AgentConfig, AgentState, InspectionResult } from "../types";
import { GraphBuilder } from "../Services/GraphService/GraphBuilder";
import { RULES_DIR } from "../settings";
import { AGENT_NODES } from "../constants";
import * as fs from 'fs';
import * as path from 'path';
import { CommonHelper } from "../Utils/CommonHelper";

export class Inspector extends BaseAgent {

    constructor(config: AgentConfig) {
        super(config);
        this.agentId = `Inspector_${CommonHelper.generateUUID()}`;
    }

    protected extendGraph(builder: GraphBuilder): void {
        /**
         * 🟢 Define Nodes
        */
        const InspectionNode = async (state: AgentState) => {
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

        const postInspectionNode = async (state: any) => {
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

        /**
         * ✏️ Draw Evaluation Flow
        */
        // REGISTER
        builder.addNode(AGENT_NODES.INSPECTION, InspectionNode);
        builder.addNode(AGENT_NODES.POST_INSPECTION, postInspectionNode);

        // WORKFLOW: SETUP_PERSONA -> INSPECTION -> POST_INSPECTION
        builder.addEdge(AGENT_NODES.SETUP_PERSONA, AGENT_NODES.INSPECTION);
        builder.addEdge(AGENT_NODES.INSPECTION, AGENT_NODES.POST_INSPECTION);
    }

    public async writeInspectionToFile(inspection: InspectionResult, targetFilePath: string): Promise<void> {
        let inspections: any[] = [];

        const directory = path.dirname(targetFilePath);

        if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });

        if (fs.existsSync(targetFilePath)) {
            try {
                const raw = fs.readFileSync(targetFilePath, 'utf-8');
                inspection = JSON.parse(raw);
            } catch (e) {
                console.warn(`[${this.agentId}][🕵️] >> ⚠️ Existing file corrupted. Starting fresh.`);
                console.log(`[${this.agentId}][🕵️] >> ⚠️ Error:`, e);
            }
        }

        inspections.push(inspection);

        try {
            fs.writeFileSync(targetFilePath, JSON.stringify(inspections, null, 2));
            console.log(`[${this.agentId}][🕵️] >> 💾 Result saved to ${path.basename(targetFilePath)}`);
        } catch (e) {
            console.error(`[${this.agentId}][🕵️] >> ❌ Save failed: ${e}`);
        }
    }

}