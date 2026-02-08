import { GoogleAIFileManager } from "@google/generative-ai/server";
import { RULES_DIR } from "../settings";
import { AgentConfig, AgentState, EvaluationResult, TestRunData, UploadedFileCtx } from "../types";
import { BaseAgent } from "./BaseAgent";
import * as fs from 'fs';
import * as path from 'path';
import { CommonHelper } from "../Utils/CommonHelper";

export class Evaluator extends BaseAgent {
    constructor(config: AgentConfig) {
        super(config);
        this.agentId = `Evaluator_${CommonHelper.generateUUID()}`;
        this.fileManager = new GoogleAIFileManager(this.apiKey);
    }

    public async evaluationNode(state: AgentState): Promise<any> {
        // Prepare Prompt with context
        console.log(`[${this.agentId}][🕵️] >> 🎬 Preparing analysis for ${state.evaluator_videoPaths.length} video(s)...`);

        if (!fs.existsSync(state.evaluator_jsonPath)) {
            throw new Error(`[${this.agentId}][🕵️] >> JSON Log not found: ${state.evaluator_jsonPath}`);
        }
        const testLogContext = fs.readFileSync(state.evaluator_jsonPath, 'utf-8');

        const fullPrompt = this.buildPrompt(
            `${RULES_DIR}/build_evaluation_prompt.njk`,
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
            console.error(`[${this.agentId}][🕵️] >> 💥 Evaluation Error:`, error);
            return {
                success: false,
                error: error,
                attempts: (state.attempts || 0) + 1
            };
        }
    }

    public async postEvaluationNode(state: AgentState): Promise<any> {
        const lastMessage = state.messages[state.messages.length - 1];
        const lastMessageText = lastMessage?.content?.toString() || "{}";
        console.log(`[${this.agentId}][🕵️] >> 📝 Evaluation Response:`, lastMessageText);

        try {
            const cleanJson = lastMessageText.replace(/```json|```/g, '').trim();
            const evaluationResult = JSON.parse(cleanJson) as EvaluationResult;
            return {
                evaluator_evaluationResult: evaluationResult,
                messages: state.messages
            };
        } catch (error) {
            console.error(`[${this.agentId}][🕵️] >> ❌ Post-Evaluation Parsing Error:`, error);
            return {
                evaluator_evaluationResult: null,
                messages: state.messages,
                error: "Failed to parse evaluation result."
            };
        }
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
                console.warn(`[${this.agentId}][🕵️] >> ⚠️ Existing file corrupted. Starting fresh.`);
                console.log(`[${this.agentId}][🕵️] >> ⚠️ Error:`, e);
            }
        }

        evaluations.push(result);

        try {
            fs.writeFileSync(targetFilePath, JSON.stringify(evaluations, null, 2));
            console.log(`[${this.agentId}][🕵️] >> 💾 Result saved to ${path.basename(targetFilePath)}`);
        } catch (e) {
            console.error(`[${this.agentId}][🕵️] >> ❌ Save failed: ${e}`);
        }
    }

}