import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import {
    StateGraph,
    MessagesAnnotation,
    START,
    END,
} from "@langchain/langgraph";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server"; // Import Google File Helpers
import * as path from 'path';
import { AgentConfig, AgentFlow, AgentState, AgentUpdate, LLMVendor, UploadedFileCtx } from "../types";
import { FileHelper } from "../Utils/FileHelper";
import * as nunjucks from "nunjucks";

export class BaseAgent {
    protected config: AgentConfig;
    protected model!: BaseChatModel;
    protected apiKey: string;
    protected fileManager?: GoogleAIFileManager;

    public agentFlow: AgentFlow;

    constructor(config: AgentConfig) {
        this.config = {
            vendor: LLMVendor.GEMINI, ...config
        };
        this.apiKey = config.apiKey;

        this.initializeVendor();
        this.agentFlow = this.initAgentFlow();
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
            AdditionalContexts: additionalContextsRendered.join("\n\n"),
        });
    }

    protected buildPrompt(templatePath: string, dynamicData: object): string {
        const promptTemplate = FileHelper.retrieveNjkTemplate(templatePath);
        return nunjucks.renderString(promptTemplate, dynamicData);
    }

    private initAgentFlow(): AgentFlow {
        const initAgentWithSystemPrompts = async (state: AgentState): Promise<AgentUpdate> => {
            const systemPrompt = new SystemMessage(this.buildSystemPrompt());
            const messages = [systemPrompt, ...state.messages];
            const response = await this.model.invoke(messages);

            // Returns AgentUpdate
            return { messages: [response] };
        };

        const workflow = new StateGraph(MessagesAnnotation)
            .addNode("agent", initAgentWithSystemPrompts, {
                retryPolicy: {
                    initialInterval: 2000,
                    backoffFactor: 2,
                    maxAttempts: 5,
                }
            })
            .addEdge(START, "agent")
            .addEdge("agent", END);

        return workflow.compile();
    }

    protected async uploadMediaFiles(filePaths: string[]): Promise<UploadedFileCtx[]> {
        this.fileManager = new GoogleAIFileManager(this.apiKey);
        const uploadedFiles: UploadedFileCtx[] = [];

        for (const filePath of filePaths) {
            console.log(`[BaseAgent] >> 📤 Uploading: ${path.basename(filePath)}`);

            // 1. Upload
            const uploadResponse = await this.fileManager.uploadFile(filePath, {
                mimeType: "video/webm", // Should be dynamic based on extension in production
                displayName: path.basename(filePath),
            });

            // 2. Wait for Processing
            let fileState = uploadResponse.file.state;
            let currentFile = uploadResponse.file;

            process.stdout.write(`[BaseAgent] >> ⏳ Processing ${currentFile.displayName}`);
            while (fileState === FileState.PROCESSING) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                process.stdout.write(".");
                const freshState = await this.fileManager.getFile(currentFile.name);
                fileState = freshState.state;
                currentFile = freshState;
            }
            console.log(" Done.");

            if (fileState === FileState.FAILED) {
                throw new Error(`Processing failed for file: ${filePath}`);
            }

            uploadedFiles.push({
                name: currentFile.name,
                uri: currentFile.uri,
                mimeType: currentFile.mimeType,
            });
        }

        return uploadedFiles;
    }

    protected async cleanupMediaFiles(files: UploadedFileCtx[]): Promise<void> {
        if (!this.fileManager) return;

        console.log(`[BaseAgent] >> 🧹 Cleaning up ${files.length} cloud file(s)...`);
        for (const file of files) {
            try {
                await this.fileManager.deleteFile(file.name);
            } catch (error) {
                console.warn(`[BaseAgent] >> ⚠️ Failed to delete ${file.name}:`, error);
            }
        }
    }

    public async sendVideosToLLM(prompt: string, videoPaths: string[], threadId: string = "default"): Promise<string> {
        let uploadedFiles: UploadedFileCtx[] = [];

        try {
            // Upload Files
            uploadedFiles = await this.uploadMediaFiles(videoPaths);

            // Construct LangChain Content for Gemini content parts { type: 'text' | 'media' }
            const messageContent: any[] = [
                { type: "text", text: prompt },
                ...uploadedFiles.map(f => ({
                    type: "media",
                    mimeType: f.mimeType,
                    fileUri: f.uri
                }))
            ];

            const input: AgentState = {
                messages: [new HumanMessage({ content: messageContent })]
            };

            const config: RunnableConfig = {
                configurable: { thread_id: threadId }
            };

            // Invoke Agent
            const result = await this.agentFlow.invoke(input, config) as AgentState;
            const lastMessage = result.messages[result.messages.length - 1];

            return lastMessage?.content?.toString() || "{}";

        } catch (error) {
            console.error(`[BaseAgent] Execution Error:`, error);
            return "{}";
        }
    }

    public async sendToLLM(message: string, threadId: string = "default"): Promise<string> {
        try {
            const input: AgentState = {
                messages: [new HumanMessage(message)]
            };

            const config: RunnableConfig = {
                configurable: { thread_id: threadId }
            };

            const result = await this.agentFlow.invoke(input, config) as AgentState;

            const lastMessage = result.messages[result.messages.length - 1];

            return lastMessage?.content?.toString() || "{}";
        } catch (error) {
            console.error(`[BaseAgent] Execution Error:`, error);
            return "{}";
        }
    }


}