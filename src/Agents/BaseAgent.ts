import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, MessageContent, SystemMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import * as path from 'path';
import { AgentConfig, AgentState, LLMVendor, UploadedFileCtx } from "../types";
import { FileHelper } from "../Utils/FileHelper";
import * as nunjucks from "nunjucks";
import { Logzer } from "../Utils/Logger";
import { GraphBuilder } from "../Services/GraphService/GraphBuilder";
import { AGENT_NODES } from "../constants";
import { CommonHelper } from "../Utils/CommonHelper";

export abstract class BaseAgent {
    protected config: AgentConfig;
    protected model!: BaseChatModel;
    protected apiKey: string;
    protected fileManager?: GoogleAIFileManager;

    protected systemPrompt!: SystemMessage;
    protected workflowRunnable: any; 

    constructor(config: AgentConfig) {
        // Load configs and initialize LLM model
        this.config = {
            vendor: LLMVendor.GEMINI, ...config
        };
        this.apiKey = config.apiKey;
        this.initializeVendor();

        // Init Graph Flow
        this.systemPrompt = new SystemMessage(this.buildSystemPrompt());
        this.workflowRunnable = this.initGraphFlow();
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

        let additionalContextsRendered = [];
        for (let context of this.config.additionalContexts!) {
            // Check if additionalContexts is file path string or raw string
            const contextContent = FileHelper.isFilePath(context)
                ? FileHelper.retrieveNjkTemplate(context)
                : context;
            additionalContextsRendered.push(contextContent);
        }

        return nunjucks.renderString(personaTemplate, {
            AdditionalRulesContexts: additionalContextsRendered.join("\n\n"),
        });
    }

    public buildPrompt(templatePath: string, dynamicData: object): string {
        const promptTemplate = FileHelper.retrieveNjkTemplate(templatePath);
        return nunjucks.renderString(promptTemplate, dynamicData);
    }

    private isQuotaError(error: any): boolean {
        const msg = (error?.message || "").toLowerCase();
        const status = error?.status || error?.response?.status;
        return (
            msg.includes("429") ||
            msg.includes("503") ||
            msg.includes("too many requests") ||
            status === 429 ||
            status === 503
        );
    }

    private initGraphFlow() {
        const builder = new GraphBuilder();

        // Register Base Node: Setup Persona
        builder.addNode(AGENT_NODES.SETUP_PERSONA, (state: AgentState) => {
            const hasSystem = state.messages.length > 0 && state.messages[0] instanceof SystemMessage;
            return hasSystem ? {} : { messages: [this.systemPrompt] };
        });

        // Set Entry Point
        builder.setEntryPoint(AGENT_NODES.SETUP_PERSONA);

        // Delegate to Child Class
        this.extendGraph(builder);

        return builder.build();
    }

    /**
     * 🧩 Abstract Method: Child Agent defines its own nodes/connections here.
     */
    protected abstract extendGraph(builder: GraphBuilder): void;

    public async sendToLLM(state: AgentState, max_retries = 5): Promise<AIMessage | any> {
        while (max_retries > 0) {
            try {
                const response = await this.model.invoke(state.messages);
                return response as AIMessage;
            } catch (error) {
                if (this.isQuotaError(error)) {
                    console.log(`[🕵️🕵️🕵️] >> ⚠️ Quota error encountered. Retries left: ${max_retries - 1}`);
                    max_retries -= 1;
                    if (max_retries === 0) {
                        throw new Error("Max retries reached due to quota errors.");
                    }
                    await CommonHelper.sleep(10000);
                } else {
                    throw error;
                }
            }
        }

    }

    public async execute(inputs: Partial<AgentState>, threadId: string = "xxx-yyy-zzz"): Promise<AgentState> {
        const config: RunnableConfig = { configurable: { thread_id: threadId } };
        return await this.workflowRunnable.invoke(inputs, config);
    }

    protected async uploadMediaFiles(filePaths: string[]): Promise<UploadedFileCtx[]> {
        const uploadedFiles: UploadedFileCtx[] = [];
        const failedUploads: string[] = [];

        for (const filePath of filePaths) {
            console.log(`[🕵️🕵️🕵️] >> 📤 Uploading: ${path.basename(filePath)}`);

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

            process.stdout.write(`[🕵️🕵️🕵️] >> ⏳ Processing ${currentDisplayName}`);
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
        console.log(`[🕵️🕵️🕵️] >> 🧹 Cleaning up ${files.length} cloud file(s)...`);
        for (const file of files) {
            try {
                await this.fileManager?.deleteFile(file.name);
            } catch (error) {
                console.warn(`[🕵️🕵️🕵️] >> ⚠️ Failed to delete ${file.name}:`, error);
            }
        }
    }
}