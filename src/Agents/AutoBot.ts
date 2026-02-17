import { Page } from "playwright";
import { BaseAgent } from "./BaseAgent";
import { AgentConfig, AgentState, CliConfig } from "../types";
import { FileHelper } from "../Utils/FileHelper";
import { PROMPTS_DIR, RULES_DIR } from "../settings";
import { CommonHelper } from "../Utils/CommonHelper";
import { execSync } from "child_process";

export class AutoBot extends BaseAgent {
    // Playwright Properties
    public page: Page | any;
    private currentUrl: string = '';

    // Reporting & Debugging
    public actionLogs: string[] = [];
    public testOutputDir: string = '';

    // CLI options
    private sessionId: string;
    private isHeaded: boolean;
    private recordVideo: boolean;

    constructor(config: AgentConfig, cliConfig: CliConfig) {
        super(config);
        this.agentId = `AutoBot_${CommonHelper.generateUUID()}`;

        this.sessionId = cliConfig.sessionId;
        this.isHeaded = cliConfig.isHeaded || false;
        this.recordVideo = cliConfig.recordVideo || false;
    }

    /**
     * Manage cli executions by session ID to every command
     */
    private runCli(command: string): string {
        try {
            // Load options
            const sessionId = this.sessionId ? `-s=${this.sessionId}` : '';
            const fullCommand = `playwright-cli ${sessionId} ${command}`;
            const output = execSync(fullCommand, { encoding: 'utf-8', stdio: 'pipe' });
            return output;
        } catch (error: any) {
            console.log(`[${this.agentId}][🤖] >> ☠️ CLI Command Error: ${error.message}`);
            throw error;
        }
    }

    private async retrieveContents(templatePaths: string[]): Promise<any> {
        const contents: string[] = [];
        try {
            for (const path of templatePaths) {
                console.log(`[${this.agentId}][🤖] >> Retrieving contents from: ${path}`);
                const templateContent = this.buildPrompt(`${PROMPTS_DIR}${path}`, {});
                contents.push(templateContent);
            }
            return contents;
        } catch (error) {
            console.error(`[${this.agentId}][🤖] >> ☠️ Error reading template: ${error}`);
            return null;
        }
    }

    public async generatorNode(state: AgentState): Promise<any> {
        const threadId = state?.threadId || 'unknown';
        const fileId = `${threadId}_${Date.now()}`;

        const pageElements = await this.getElementsTree(fileId);
        const base64Image = await this.getPageScreenshot(fileId);

        const playwrightSpecificSkills = await this.retrieveContents(state.pwSpecificSkillsPaths);
        const pageContexts = await this.retrieveContents(state.pageContextPaths);
        const pageWorkflows = await this.retrieveContents(state.pageWorkflowPaths);

        let fullPrompt = this.buildPrompt(
            `${RULES_DIR}/build_test_step_execution_prompt.njk`,
            {
                playwrightSpecificSkills: playwrightSpecificSkills?.join("\n\n"),
                pageContexts: pageContexts?.join("\n\n"),
                pageWorkflows: pageWorkflows?.join("\n\n"),
                currentUrl: this.currentUrl,
                elementsTree: pageElements,
                step: state.step,
                contextNotes: state.notes.join(' | '),
                error: state.error
            }
        )

        const userMessage = await this.buildMessageContent(
            [
                {
                    type: "text",
                    text: fullPrompt
                },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:image/png;base64,${base64Image}`
                    }
                }
            ]
        )

        // Combine History + New Input temporarily for this call
        const messagesForModel = [...state.messages, userMessage];
        const response = await this.sendToLLM({ ...state, messages: messagesForModel });

        return {
            autoBot_domTree: pageElements,
            autoBot_screenshot: base64Image,
            messages: [...state.messages, response],
            attempts: (state.attempts || 0) + 1
        };
    }

    public async executorNode(state: AgentState): Promise<any> {
        const lastMessage = state.messages[state.messages.length - 1];
        const commands = this.extractCode(lastMessage.content.toString());
        const step = state.step;
        const notes = state.notes?.join(' | ') || 'N/A';

        try {
            for (let cmd of commands) {
                // Remove 'playwright-cli' prefix if existing
                const cleanCmd = cmd.replace(/^playwright-cli\s+/g, '').trim();
                console.log(`[${this.agentId}][🤖] >> 🦾 Executing step: "${step}"`);
                console.log(`[${this.agentId}][🤖] >> 📌 Step Note: "${notes}"`);
                console.log(`[${this.agentId}][🤖] >> 🎭 CLI: ${cmd}`);
                this.runCli(cleanCmd);
            }

            return {
                success: true,
                error: null,
                messages: state.messages
            };
        } catch (error) {
            console.error(`[${this.agentId}] >> 💥 CLI Execution Error: ${error}`);
            return {
                success: false,
                error: error,
                attempts: (state.attempts || 0) + 1
            };
        }
    }

    public async extractLog(testName: string, data: any): Promise<void> {
        try {
            FileHelper.writeFile(this.testOutputDir, `${testName}.json`, data);
            console.log(`[${this.agentId}][🤖] >> ⏹️ Extract log: ${testName}.json`);
        } catch (error) {
            console.error(`[${this.agentId}][🤖] >> ☠️ Error writing log file: ${error}`);
        }
    }

    public async startBrowser(testName?: string): Promise<void> {
        const headedOpt = this.isHeaded ? '--headed' : '';

        const timestamp = CommonHelper.getCurrentTimestamp();
        this.testOutputDir = testName ? `output/${testName}_${timestamp}/` : `output/${timestamp}/`;

        console.log(`[${this.agentId}][🤖] >> 🚀 Initializing CLI Session...`);
        this.runCli(`${headedOpt} open about:blank`);

        console.log(`[${this.agentId}][🤖] >> 🎬 Start recording: ${this.testOutputDir}${testName}_${CommonHelper.getCurrentTimestamp()}.webm`);
        this.runCli(`video-start`);
    }

    public async stopRecording(testName?: string) {
        console.log(`[${this.agentId}][🤖] >> 🎬 Stop and Saving video record: ${this.testOutputDir}${testName}_${CommonHelper.getCurrentTimestamp()}.webm`)
        this.runCli(`video-stop --filename=${this.testOutputDir}${testName}.webm`);
        await CommonHelper.sleep(5000);
    }

    public async stopBrowser() {
        console.log(`[${this.agentId}][🤖] >> 🛑 Closing CLI Session...`);
        this.runCli(`close`);
    }
    

    public async closeAllsessions() {
        console.log(`[${this.agentId}][🤖] >> 🧹 Closing all CLI Sessions...`);
        this.runCli(`close-all`);
    }

    public async getElementsTree(filename: string): Promise<string> {
        try {
            const snapshotPath = `${this.testOutputDir}snapshots/`;
            const snapshot = `${snapshotPath}${filename}.png`;
            if (!FileHelper.isFilePath(snapshotPath)) {
                FileHelper.createDirectory(snapshotPath);
            }
            this.runCli(`snapshot --filename=${snapshot}.yml`);
            console.log(`[${this.agentId}][🤖] >> 🌳 Elements tree snapshot saved: ${snapshot}`);
            const snapshotContent = FileHelper.readFile(`${snapshot}.yml`);
            return snapshotContent;
        } catch (error) {
            console.error(`[${this.agentId}][🤖] >> ☠️ Error taking Elements tree snapshot: ${error}`);
            return "";
        }
    }

    public async getPageScreenshot(filename: string): Promise<string> {
        try {
            const screenshotPath = `${this.testOutputDir}screenshots/`;
            const screenshot = `${screenshotPath}${filename}.png`;
            if (!FileHelper.isFilePath(screenshotPath)) {
                FileHelper.createDirectory(screenshotPath);
            }
            
            this.runCli(`screenshot --filename=${screenshot}`);
            console.log(`[${this.agentId}][🤖] >> 📸 Screenshot saved: ${screenshot}.png`);
            const base64Image = FileHelper.readAsBase64(screenshot);
            return base64Image;
        } catch (error) {
            console.error(`[${this.agentId}][🤖] >> ☠️ Error taking screenshot: ${error}`);
            return "";
        }
    }

    public extractCode(rawCommands: string): string[] {
        rawCommands.replace(/```javascript/gi, "").replace(/```js/gi, "").replace(/```/g, "").trim();
        const commands = rawCommands.split('\n').filter(cmd => cmd.trim().length > 0);
        return commands;
    }
}