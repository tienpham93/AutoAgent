import { Browser, Page, BrowserContext } from "playwright";
import { BaseAgent } from "./BaseAgent";
import { AgentConfig, AgentState } from "../types";
import { FileHelper } from "../Utils/FileHelper";
import { RULES_DIR } from "../settings";
import { CommonHelper } from "../Utils/CommonHelper";
import { execSync } from "child_process";

export class AutoBot extends BaseAgent {
    // Playwright Properties
    public page: Page | any;
    private currentUrl: string = '';

    // Reporting & Debugging
    public actionLogs: string[] = [];
    public testOutputDir: string = '';
    public debugDir: string = 'src/Debug/Elements/';
    private sessionId: string;

    constructor(config: AgentConfig) {
        super(config);
        this.sessionId = `session_${CommonHelper.generateUUID()}`;
        this.agentId = `AutoBot_${CommonHelper.generateUUID()}`;
    }

    /**
     * Manage cli executions by session ID to every command
     */
    private runCli(command: string): string {
        try {
            const fullCommand = `playwright-cli -s=${this.sessionId} ${command}`;
            const output = execSync(fullCommand, { encoding: 'utf-8', stdio: 'pipe' });
            return output;
        } catch (error: any) {
            throw new Error(`CLI Error: ${error.stderr || error.message}`);
        }
    }

    private retrieveContents(templatePaths: string[]): any {
        const contents: string[] = [];
        try {
            for (const path of templatePaths) {
                console.log(`[${this.agentId}][🤖] >> Retrieving contents from: ${path}`);
                const templateContent = this.buildPrompt(path, {});
                contents.push(templateContent);
            }
            return contents;
        } catch (error) {
            console.error(`[${this.agentId}][🤖] >> ☠️ Error reading template: ${error}`);
            return null;
        }
    }        

    public async generatorNode(state: AgentState): Promise<any> {
        const pageSnapshot = await this.waitForUIStability(10000, state);
        const pageElements = pageSnapshot?.elementTree;
        const base64Image = pageSnapshot?.screenshot;

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

        try {
            for (let cmd of commands) {
                // Remove 'playwright-cli' prefix if existing
                const cleanCmd = cmd.replace(/^playwright-cli\s+/g, '').trim();

                console.log(`[${this.agentId}] >> 🦾 Executing CLI: ${cleanCmd}`);
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

    public async chatNode(state: AgentState): Promise<any> {
        const pageSnapshot = await this.waitForUIStability(20000, state);
        const pageElements = pageSnapshot?.elementTree;

        let fullPrompt = this.buildPrompt(
            `${RULES_DIR}/build_dry_run_prompt.njk`,
            {
                userInput: state.step,
                elementsTree: pageElements,
            }
        )

        const userMessage = await this.buildMessageContent(
            [
                {
                    type: "text",
                    text: fullPrompt
                }
            ]
        )

        // Combine History + New Input temporarily for this call
        const messagesForModel = [...state.messages, userMessage];
        const response = await this.sendToLLM({ ...state, messages: messagesForModel });
        return {
            messages: [...state.messages, response],
        };
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
        const timestamp = new Date().getTime();
        this.testOutputDir = `output/${testName || 'test'}_${timestamp}/`;

        console.log(`[${this.agentId}] >> 🚀 Initializing CLI Session...`);
        this.runCli(`open about:blank --headed`);
    }

    public async stopBrowser() {
        console.log(`[${this.agentId}] >> 🛑 Closing CLI Session...`);
        this.runCli(`close`);
    }

    public async getPageScreenshot(filename: string): Promise<string> {
        try {
            const screenshotPath = `${this.testOutputDir}screenshots/${filename}.png`;
            this.runCli(`screenshot --filename=${screenshotPath}`);
            console.log(`[${this.agentId}][🤖] >> 📸 Screenshot saved: ${screenshotPath}`);
            return FileHelper.readAsBase64(screenshotPath);
        } catch (error) {
            console.error(`[${this.agentId}][🤖] >> ☠️ Error taking screenshot: ${error}`);
            return "";
        }
    }

    public async getElementsTree(isDebug = false): Promise<string> {
        try {
            const snapshot = this.runCli(`snapshot`);
            if (isDebug) {
                const timestamp = FileHelper.getTimestamp();
                console.log(`[${this.agentId}][🤖] >> 🌳 Saving elements tree snapshot: elements_tree_${timestamp}.json`);
                FileHelper.writeFile(this.debugDir, `elements_tree_${timestamp}.yml`, snapshot);
            }

            return snapshot;
        } catch (e) {
            return "Error getting snapshot";
        }
    }

    private async waitForUIStability(timeout = 15000, state?: AgentState): Promise<any> {
        const startTime = Date.now();
        const threadId = state?.threadId || 'unknown';

        let previousTree = await this.getElementsTree();

        while (Date.now() - startTime < timeout) {
            await CommonHelper.sleep(1000);
            const currentTree = await this.getElementsTree();

            if (previousTree === currentTree) {
                return {
                    elementTree: currentTree,
                    screenshot: await this.getPageScreenshot(`${threadId}_${Date.now()}`)
                };
            }
            previousTree = currentTree;
        }

        return {
            elementTree: previousTree,
            screenshot: await this.getPageScreenshot(`${threadId}_${Date.now()}`)
        }
    }

    public extractCode(rawCommands: string): string[] {
        rawCommands.replace(/```javascript/gi, "").replace(/```js/gi, "").replace(/```/g, "").trim();
        const commands = rawCommands.split('\n').filter(cmd => cmd.trim().length > 0);
        return commands;
    }
}