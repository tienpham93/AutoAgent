import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import { AgentConfig, EvaluationResult, LLMVendor, TestRunData } from "../types";
import { BaseAgent } from "./BaseAgent";
import * as fs from 'fs';
import * as path from 'path';

export class EvaluatorAgent extends BaseAgent {
    constructor(config: AgentConfig) {
        super({ 
            ...config, 
            vendor: LLMVendor.GEMINI 
        });
        this.fileManager = new GoogleAIFileManager(config.apiKey);
        this.localGenAI = new GoogleGenerativeAI(config.apiKey);
    }

    /**
     * 🔍 Scans directory for JSON logs and ALL .webm videos (sorted by creation time)
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
                // Sort: Oldest first (Main Window), Newest last (Popups)
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
     * 💾 Saves results to JSON, handling file creation and array appending.
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
                console.warn("[⚠️ Evaluator] >> Existing file corrupted. Starting fresh.");
            }
        }
        
        evaluations.push(result);

        try {
            fs.writeFileSync(targetFilePath, JSON.stringify(evaluations, null, 2));
            console.log(`[💾 Evaluator] >> Result saved to ${path.basename(targetFilePath)}`);
        } catch (e) {
            console.error(`[❌ Evaluator] >> Save failed: ${e}`);
        }
    }

    /**
     * 👉 You can view uploaded videos through https://aistudio.google.com/app/library
     * Note: Files uploaded via the File API generally expire after 48 hours
     */
    public async evaluateRun(videoPaths: string[], jsonPath: string): Promise<EvaluationResult> {
        console.log(`[🕵️ Evaluator] >> 🎬 Analyzing ${videoPaths.length} video(s)...`);
        
        if (!fs.existsSync(jsonPath)) throw new Error(`JSON Log not found: ${jsonPath}`);
        const testLogContext = fs.readFileSync(jsonPath, 'utf-8');

        const uploadedFiles: any[] = [];

        try {
            // Upload All Videos
            for (const vPath of videoPaths) {
                console.log(`[🕵️ Evaluator] >> 📤 Uploading: ${path.basename(vPath)}`);
                const upload = await this.fileManager.uploadFile(vPath, {
                    mimeType: "video/webm",
                    displayName: "Test Video Segment",
                });
                uploadedFiles.push(upload.file);
            }

            // Wait for Processing
            console.log("[🕵️ Evaluator] >> ⏳ Waiting for Google to process videos...");
            for (const file of uploadedFiles) {
                let current = await this.fileManager.getFile(file.name);
                while (current.state === FileState.PROCESSING) {
                    await new Promise(r => setTimeout(r, 2000));
                    current = await this.fileManager.getFile(file.name);
                }
                if (current.state === FileState.FAILED) throw new Error(`Video processing failed for ${file.name}`);
            }

            const prompt = `
                Analyze these video recordings of an automation test.
                ***CONTEXT***
                There are ${uploadedFiles.length} videos provided. Treat them as a continuous sequence (Main browser tab -> next browser tab).
                ***TEST LOG DATA***
                ${testLogContext}
                ***TASK***
                Follow the PERSONA rules. Return JSON.
            `;

            const responseText = await this.callGeminiWithMultiVideo(prompt, uploadedFiles);

            // Cleanup
            for (const file of uploadedFiles) await this.fileManager.deleteFile(file.name);

            const cleanJson = responseText.replace(/```json|```/g, '').trim();
            return JSON.parse(cleanJson) as EvaluationResult;

        } catch (error) {
            console.error("[🕵️ Evaluator] >> ❌ Error:", error);
            // Cleanup on error
            for (const file of uploadedFiles) {
                try { await this.fileManager.deleteFile(file.name); } catch(e) {}
            }
            throw error;
        }
    }
}