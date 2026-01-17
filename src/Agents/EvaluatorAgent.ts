import { RULES_DIR } from "../settings";
import { AgentConfig, EvaluationResult, LLMVendor, TestRunData } from "../types";
import { BaseAgent } from "./BaseAgent";
import * as fs from 'fs';
import * as path from 'path';

export class EvaluatorAgent extends BaseAgent {
    constructor(config: AgentConfig) {
        super({ 
            ...config, 
            vendor: LLMVendor.GEMINI // Only Gemini supported video anlysis seamlessly
        });
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
                console.warn("[Evaluator] >> ⚠️ Existing file corrupted. Starting fresh.");
            }
        }
        
        evaluations.push(result);

        try {
            fs.writeFileSync(targetFilePath, JSON.stringify(evaluations, null, 2));
            console.log(`[Evaluator] >> 💾 Result saved to ${path.basename(targetFilePath)}`);
        } catch (e) {
            console.error(`[Evaluator] >> ❌ Save failed: ${e}`);
        }
    }

    /**
     * 👉 Analyzes the run by delegating video processing to BaseAgent
     */
    public async evaluateRun(videoPaths: string[], jsonPath: string): Promise<EvaluationResult> {
        console.log(`[Evaluator] >> 🎬 Preparing analysis for ${videoPaths.length} video(s)...`);
        
        if (!fs.existsSync(jsonPath)) throw new Error(`JSON Log not found: ${jsonPath}`);
        const testLogContext = fs.readFileSync(jsonPath, 'utf-8');

        const fullPrompt = this.buildPrompt(
            `${RULES_DIR}/evaluate_test_output_rules.njk`,
            {
                numberOfVideos: videoPaths.length,
                testLogContext: testLogContext
            }
        );

        const responseText = await this.sendVideosToLLM(fullPrompt, videoPaths, `eval-${Date.now()}`);

        try {
            const cleanJson = responseText.replace(/```json|```/g, '').trim();
            return JSON.parse(cleanJson) as EvaluationResult;
        } catch (error) {
            console.error("[Evaluator] >> ❌ JSON Parsing Error on response:", responseText);
            throw error;
        }
    }
}