import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { AgentConfig, LLMVendor } from "../types";
import { BaseAgent } from "./BaseAgent";

export class EvaluatorAgent extends BaseAgent {
    private fileManager: GoogleAIFileManager;

    constructor(config: AgentConfig) {
        super({ 
            ...config, 
            vendor: LLMVendor.GEMINI // Force Gemini Vendor

        });
        this.fileManager = new GoogleAIFileManager(config.apiKey);
    }

    /**
     * 👉 You can view uploaded videos through https://aistudio.google.com/app/library
     * Note: Files uploaded via the File API generally expire after 48 hours
     */
    public async evaluateRun(videoPath: string, testContext: string): Promise<any> {
        console.log(`[🕵️🕵️🕵️] >> 📤 Uploading video: ${videoPath}`);
        let uploadResult;
        
        try {
            // Upload File
            uploadResult = await this.fileManager.uploadFile(videoPath, {
                mimeType: "video/webm",
                displayName: "Test Execution Record",
            });

            // Wait for Processing
            let file = await this.fileManager.getFile(uploadResult.file.name);
            while (file.state === FileState.PROCESSING) {
                console.log("[🕵️🕵️🕵️] >> ⏳ Google is processing the video...");
                await new Promise((resolve) => setTimeout(resolve, 2000));
                file = await this.fileManager.getFile(uploadResult.file.name);
            }

            if (file.state === FileState.FAILED) 
                throw new Error("[🕵️🕵️🕵️] >> 🚫 Video processing failed.");

            const prompt = `
                Analyze this video recording of an automation test.
                ***TEST SCENARIO***
                ${testContext}
                ***YOUR TASK***
                1. Did the test pass? (Did it reach the expected end state?)
                2. If it failed, what exactly happened on screen?
                Return JSON: { "result": "pass" | "fail", "reason": "..." }
            `;

            const responseText = await this.sendWithVideoToLLM(prompt, file.uri, file.mimeType);

            // Cleanup File
            await this.fileManager.deleteFile(uploadResult.file.name);

            const cleanJson = responseText.replace(/```json|```/g, '').trim();
            return JSON.parse(cleanJson);

        } catch (error) {
            console.error("[🕵️🕵️🕵️] >> ❌ Error:", error);
            // Cleanup on error if upload happened
            if (uploadResult) {
                try { 
                    await this.fileManager.deleteFile(uploadResult.file.name); 
                } catch(e) {

                }
            }
            return { result: "error", reason: error };
        }
    }
}