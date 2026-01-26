import { GoogleAIFileManager } from "@google/generative-ai/server";
import { RULES_DIR } from "../settings";
import { AgentConfig, AgentState, EvaluationResult, LLMVendor, TestRunData, UploadedFileCtx } from "../types";
import { BaseAgent } from "./BaseAgent";
import * as fs from 'fs';
import * as path from 'path';
import { Logzer } from "../Utils/Logger";
import { GraphBuilder } from "../Services/GraphService/GraphBuilder";
import { AGENT_NODES } from "../constants";

export class Evaluator extends BaseAgent {
    constructor(config: AgentConfig) {
        super(config);
        this.fileManager = new GoogleAIFileManager(this.apiKey);
    }

    protected extendGraph(builder: GraphBuilder): void {
        // videoPaths: string[], jsonPath: string
        /**
         * 🟢 Define Nodes
        */
        const evaluationNode = async (state: AgentState) => {
            // Prepare Prompt with context
            console.log(`[🕵️🕵️🕵️] >> 🎬 Preparing analysis for ${state.evaluator_videoPaths.length} video(s)...`);

            if (!fs.existsSync(state.evaluator_jsonPath)) throw new Error(`JSON Log not found: ${state.evaluator_jsonPath}`);
            const testLogContext = fs.readFileSync(state.evaluator_jsonPath, 'utf-8');

            const fullPrompt = this.buildPrompt(
                `${RULES_DIR}/evaluate_test_output_rules.njk`,
                {
                    numberOfVideos: state.evaluator_videoPaths.length,
                    testLogContext: testLogContext
                }
            );

            // Upload Files and build message
            let uploadedFiles: UploadedFileCtx[] = [];
            uploadedFiles = await this.uploadMediaFiles(state.evaluator_videoPaths);

            const userMessage = await this.buildMessageContent(
                [
                    {
                        type: "text",
                        text: fullPrompt
                    },
                    ...uploadedFiles.map(f => ({
                        type: "media",
                        mimeType: f.mimeType,
                        fileUri: f.uri
                    }))
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
                console.error("[🕵️🕵️🕵️] >> 💥 Evaluation Error:", error);
                return {
                    success: false,
                    error: error,
                    attempts: (state.attempts || 0) + 1
                };
            }
        };

        const postEvaluationNode = async (state: AgentState) => {  
            const lastMessage = state.messages[state.messages.length - 1];
            const lastMessageText = lastMessage?.content?.toString() || "{}";
            console.log("[🕵️🕵️🕵️] >> 📝 Evaluation Response:", lastMessageText);

            try {
                const cleanJson = lastMessageText.replace(/```json|```/g, '').trim();
                const evaluationResult = JSON.parse(cleanJson) as EvaluationResult;
                return {
                    evaluator_evaluationResult: evaluationResult,
                    messages: state.messages
                };
            } catch (error) {
                console.error("[🕵️🕵️🕵️] >> ❌ Post-Evaluation Parsing Error:", error);
                return {
                    evaluator_evaluationResult: null,
                    messages: state.messages,
                    error: "Failed to parse evaluation result."
                };
            }
        }

        /**
         * ✏️ Draw Evaluation Flow
        */
        // REGISTER
        builder.addNode(AGENT_NODES.EVALUATION, evaluationNode);
        builder.addNode(AGENT_NODES.POST_EVALUATION, postEvaluationNode);

        // WORKFLOW: SETUP_PERSONA -> EVALUATION -> POST_EVALUATION -> END
        builder.addEdge(AGENT_NODES.SETUP_PERSONA, AGENT_NODES.EVALUATION);
        builder.addEdge(AGENT_NODES.EVALUATION, AGENT_NODES.POST_EVALUATION);

        // LOGICS: EVALUATION -> (Success ? POST_EVALUATION : retry EVALUATION)
        builder.addConditionalEdge(
            AGENT_NODES.EVALUATION,
            (state: AgentState) => {
                console.log(`[🕵️🕵️🕵️] >> 🔄 Evaluation attempt: ${state.attempts}`);
                console.log(`[🕵️🕵️🕵️] >> ❔ Evaluation success: ${state.success}`);

                if (state.success) {
                    return AGENT_NODES.POST_EVALUATION;
                }

                // Retry up to 3 attempts
                if (state.attempts >= 3) {
                    console.log("[🕵️🕵️🕵️] >> ⚠️ Max attempts reached. Ending evaluation.");
                    return AGENT_NODES.END;
                }
                return AGENT_NODES.EVALUATION;
            },
            {
                [AGENT_NODES.POST_EVALUATION]: AGENT_NODES.POST_EVALUATION,
                [AGENT_NODES.EVALUATION]: AGENT_NODES.EVALUATION,
                [AGENT_NODES.END]: AGENT_NODES.END
            }
        );

    }

    /**
     * 🔍 Scans directory for JSON logs and ALL .webm videos
     */
    public getTestRuns(directory: string): TestRunData[] {
        const runs: TestRunData[] = [];
        if (!fs.existsSync(directory)) return [];

        const folders = fs.readdirSync(directory).filter(file => {
            return fs.statSync(path.join(directory, file)).isDirectory();
        });

        folders.forEach(folder => {
            const folderPath = path.join(directory, folder);
            const files = fs.readdirSync(folderPath);

            const jsonFile = files.find(f => f.endsWith('.json') && !f.includes('evaluations'));
            const videoFiles = files.filter(f => f.endsWith('.webm'));

            if (jsonFile && videoFiles.length > 0) {
                // Sort by creation time
                videoFiles.sort((a, b) => {
                    const timeA = fs.statSync(path.join(folderPath, a)).birthtimeMs;
                    const timeB = fs.statSync(path.join(folderPath, b)).birthtimeMs;
                    return timeA - timeB;
                });

                runs.push({
                    folderName: folder,
                    jsonPath: path.join(folderPath, jsonFile),
                    videoPaths: videoFiles.map(v => path.join(folderPath, v))
                });
            }
        });

        return runs;
    }

    /**
     * 💾 Saves results to JSON
     */
    public appendEvaluationResult(result: any, targetFilePath: string): void {
        let evaluations: any[] = [];
        const directory = path.dirname(targetFilePath);

        if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });

        if (fs.existsSync(targetFilePath)) {
            try {
                const raw = fs.readFileSync(targetFilePath, 'utf-8');
                evaluations = JSON.parse(raw);
            } catch (e) {
                console.warn("[🕵️🕵️🕵️] >> ⚠️ Existing file corrupted. Starting fresh.");
                console.log("[🕵️🕵️🕵️] >> ⚠️ Error:", e);
            }
        }

        evaluations.push(result);

        try {
            fs.writeFileSync(targetFilePath, JSON.stringify(evaluations, null, 2));
            console.log(`[🕵️🕵️🕵️] >> 💾 Result saved to ${path.basename(targetFilePath)}`);
        } catch (e) {
            console.error(`[🕵️🕵️🕵️] >> ❌ Save failed: ${e}`);
        }
    }

}