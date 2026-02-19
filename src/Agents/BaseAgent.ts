import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import * as path from 'path';
import { AgentConfig, AgentState, LLMVendor, UploadedFileCtx } from "../types";
import { FileHelper } from "../Utils/FileHelper";
import * as nunjucks from "nunjucks";
import { CommonHelper } from "../Utils/CommonHelper";

export abstract class BaseAgent {
    protected config: AgentConfig;
    protected model!: BaseChatModel;
    protected apiKey: string;
    protected fileManager?: GoogleAIFileManager;

    protected systemPrompt!: SystemMessage;
    public agentId: string = "Allfather";

    constructor(config: AgentConfig) {
        // Load configs and initialize LLM model
        this.config = {
            vendor: LLMVendor.GEMINI, ...config
        };
        this.apiKey = config.apiKey;
        this.initializeVendor();
        this.systemPrompt = new SystemMessage(this.buildSystemPrompt());
    }

    private initializeVendor(): void {
        switch (this.config.vendor) {
            case LLMVendor.CLAUDE:
                this._initClaude();
                break;
            case LLMVendor.GEMINI:
            default:
                this._initGemini();
                break;
        }
    }

    private _initGemini(): void {
        this.model = new ChatGoogleGenerativeAI({
            apiKey: this.config.apiKey,
            model: this.config.model,
            convertSystemMessageToHumanContent: true,
        });
    }

    private _initClaude(): void {
        this.model = new ChatAnthropic({
            apiKey: this.config.apiKey,
            modelName: this.config.model,
        });
    }

    public async buildMessageContent(data: any[]): Promise<any> {
        return new HumanMessage({
            content: data
        })
    }

    private buildSystemPrompt(): string {
        const personaTemplate = FileHelper.retrieveNjkTemplate(this.config.personaTemplatePath!);
        console.log(`[${this.agentId}][🦸‍♂️] >> 📚 Loading persona: ${this.config.personaTemplatePath}`);

        let additionalContextsRendered = [];
        for (let context of this.config.additionalContexts!) {
            console.log(`[${this.agentId}][🦸‍♂️] >> 📚 Loading additional context: ${context}`);
            // Check if additionalContexts is file path string or raw string
            const contextContent = FileHelper.isFilePath(context)
                ? FileHelper.retrieveNjkTemplate(context)
                : context;
            additionalContextsRendered.push(contextContent);
        }
        return nunjucks.renderString(personaTemplate, {
            AdditionalContexts: additionalContextsRendered.join("\n\n"),
        });
    }

    public buildPrompt(templatePath = 'N/A', dynamicData?: object): string {
        const promptTemplate = FileHelper.retrieveNjkTemplate(templatePath);
        return nunjucks.renderString(promptTemplate, dynamicData || {});
    }

    /**
    * 🟢 Public Node Logic: Setup Persona
    * This can now be bound to any Graph in execution.ts
    */
    public async getSystemNode(state: AgentState): Promise<Partial<AgentState>> {
        const hasSystem = state.messages.length > 0 && state.messages[0] instanceof SystemMessage;
        return hasSystem ? {} : { messages: [this.systemPrompt] };
    }

    public async sendToLLM(state: AgentState, max_retries = 5): Promise<AIMessage | any> {
        while (max_retries > 0) {
            try {
                const response = await this.model.invoke(state.messages);
                return response as AIMessage;
            } catch (error: any) {
                if (this.isQuotaError(error)) {
                    console.log(`[${this.agentId}][🦸‍♂️] >> ⚠️ Quota error. Retries left: ${max_retries - 1}`);
                    max_retries -= 1;
                    if (max_retries === 0) throw new Error("Max retries reached.");
                    await CommonHelper.sleep(10000);
                } else {
                    throw error;
                }
            }
        }
    }

    private isQuotaError(error: any): boolean {
        const msg = (error?.message || "").toLowerCase();
        const status = error?.status || error?.response?.status;
        return (
            msg.includes("429") || msg.includes("503") || status === 429 || status === 503
        );
    }


    protected async uploadMediaFiles(filePaths: string[]): Promise<UploadedFileCtx[]> {
        const uploadedFiles: UploadedFileCtx[] = [];
        const failedUploads: string[] = [];

        for (const filePath of filePaths) {
            console.log(`[${this.agentId}][🦸‍♂️] >> 📤 Uploading: ${path.basename(filePath)}`);

            // 1. Upload
            const uploadResponse = await this.fileManager?.uploadFile(filePath, {
                mimeType: "video/webm", // Should be dynamic based on extension in production
                displayName: path.basename(filePath),
            });

            // 2. Wait for Processing
            let fileState = uploadResponse?.file.state;
            let currentFile = uploadResponse?.file;
            let currentDisplayName = currentFile?.displayName || "unknown";
            let currentName = currentFile?.name || "unknown";
            let currentUri = currentFile?.uri || "";
            let currentMimeType = currentFile?.mimeType || "application/octet-stream";

            process.stdout.write(`[${this.agentId}][🦸‍♂️] >> ⏳ Processing ${currentDisplayName}`);
            while (fileState === FileState.PROCESSING) {
                await CommonHelper.sleep(3000);
                process.stdout.write(".");
                const freshState = await this.fileManager?.getFile(currentName || "");
                fileState = freshState?.state;
                currentFile = freshState;
            }
            console.log(" Done.");

            if (fileState === FileState.FAILED) {
                failedUploads.push(filePath);
                console.log(`Processing failed for file: ${filePath}`);
            }

            uploadedFiles.push({
                name: currentName,
                uri: currentUri,
                mimeType: currentMimeType,
            });
        }

        return uploadedFiles;
    }

    protected async cleanupMediaFiles(files: UploadedFileCtx[]): Promise<void> {
        console.log(`[${this.agentId}][🦸‍♂️] >> 🧹 Cleaning up ${files.length} cloud file(s)...`);
        for (const file of files) {
            try {
                await this.fileManager?.deleteFile(file.name);
            } catch (error) {
                console.warn(`[${this.agentId}][🦸‍♂️] >> ⚠️ Failed to delete ${file.name}:`, error);
            }
        }
    }
}