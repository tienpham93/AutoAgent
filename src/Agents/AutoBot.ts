import { Browser, Page, chromium, BrowserContext } from "playwright";
import { BaseAgent } from "./BaseAgent";
import { AgentConfig, AgentState } from "../types";
import { FileHelper } from "../Utils/FileHelper";
import { CONTEXTS_DIR, RULES_DIR, WORKFLOWS_DIR } from "../settings";
import playwrightConfig from '../../playwright.config';
import * as nunjucks from "nunjucks";
import { CommonHelper } from "../Utils/CommonHelper";
import { GraphBuilder } from "../Services/GraphService/GraphBuilder";
import { AGENT_NODES } from "../constants";

export class AutoBot extends BaseAgent {
    // Playwright Properties
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    public page: Page | any;
    private pageTitle: string = '';
    private currentUrl: string = '';

    // Reporting & Debugging
    public actionLogs: string[] = [];
    public testOutputDir: string = '';
    public debugDir: string = 'src/Debug/Elements/';

    constructor(config: AgentConfig) {
        super(config);
        this.agentId = `AutoBot_${CommonHelper.generateUUID()}`;
    }

    protected extendGraph(builder: GraphBuilder): void {
        /**
         * 🟢 Define Nodes
        */
        const generatorNode = async (state: AgentState) => {
            const pageSnapshot = await this.waitForUIStability(10000, state);
            const pageElements = pageSnapshot?.elementTree;
            const base64Image = pageSnapshot?.screenshot;

            let currentPageTitle = await JSON.parse(pageElements).name;
            let currentUrl = await this.page.url();
            let pageKnowledgeBase: any;

            // Check if current page have changed to inject Knowledge Base
            if (this.pageTitle !== currentPageTitle && this.currentUrl !== currentUrl) {
                this.pageTitle = await JSON.parse(pageElements).name;
                this.currentUrl = await this.page.url();
                pageKnowledgeBase = this.detectPageContext(this.pageTitle, this.currentUrl);
            }

            let fullPrompt = this.buildPrompt(
                `${RULES_DIR}/build_test_step_execution_prompt.njk`,
                {
                    pageContexts: pageKnowledgeBase?.contexts,
                    pageWorkflows: pageKnowledgeBase?.workflow,
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
                autoAgent_domTree: pageElements,
                autoAgent_screenshot: base64Image,
                messages: [...state.messages, response],
                attempts: (state.attempts || 0) + 1
            };
        }

        const executorNode = async (state: AgentState) => {
            const lastMessage = state.messages[state.messages.length - 1]
            const pwScript = this.extractCode(lastMessage.content.toString());

            const step = state.step;
            const notes = state.notes?.join(' | ') || 'N/A';

            try {
                console.log(`[${this.agentId}][🤖] >> 🦾 Executing step: "${step}"`);
                console.log(`[${this.agentId}][🤖] >> 📌 Step Note: "${notes}"`);
                console.log(`[${this.agentId}][🤖] >> 🎭 Step Script: "${pwScript}"\n`);

                const page = await this.page;
                await eval(
                    `(async () => {
                        ${pwScript} 
                    })()`
                );
                console.log(`[${this.agentId}][🤖] >> ✅ Step "${state.step}" executed successfully.\n`);
                return {
                    success: true,
                    error: null,
                    messages: [...state.messages, lastMessage]
                };

            } catch (error) {
                console.error(`[${this.agentId}][🤖] >> 💥 Execution Error: ${error}`);
                return {
                    success: false,
                    error: error,
                    messages: [...state.messages, lastMessage],
                    attempts: (state.attempts || 0) + 1
                };
            }
        }

        const chatNode = async (state: AgentState) => {
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

        const automationFlow = () => {
            // REGISTER
            builder.addNode(AGENT_NODES.CODE_GENERATOR, generatorNode);
            builder.addNode(AGENT_NODES.CODE_EXECUTOR, executorNode);

            // WORKFLOW: SETUP_PERSONA -> CODE_GENERATOR -> CODE_EXECUTOR
            builder.addEdge(AGENT_NODES.SETUP_PERSONA, AGENT_NODES.CODE_GENERATOR);
            builder.addEdge(AGENT_NODES.CODE_GENERATOR, AGENT_NODES.CODE_EXECUTOR);

            // LOGICS: CODE_EXECUTOR -> (Success ? END : Retry CODE_GENERATOR)
            builder.addConditionalEdge(
                AGENT_NODES.CODE_EXECUTOR,
                (state: AgentState) => {
                    console.log(`[${this.agentId}][🤖] >> 🔄 Execution attempt: ${state.attempts}`);
                    console.log(`[${this.agentId}][🤖] >> ❔ Execution success: ${state.success}`);

                    if (state.success) {
                        return AGENT_NODES.END;
                    }

                    // Retry up to 3 attempts
                    if (state.attempts >= 3) {
                        return AGENT_NODES.END;
                    }
                    return AGENT_NODES.CODE_GENERATOR; // Back to generator
                },
                {
                    [AGENT_NODES.CODE_GENERATOR]: AGENT_NODES.CODE_GENERATOR,
                    [AGENT_NODES.CODE_EXECUTOR]: AGENT_NODES.CODE_EXECUTOR,
                    [AGENT_NODES.END]: AGENT_NODES.END
                }
            );
        };

        const dryRunFlow = () => {
            // REGISTER
            builder.addNode(AGENT_NODES.CHAT, chatNode);
            builder.addNode(AGENT_NODES.CODE_EXECUTOR, executorNode);

            // WORKFLOW: SETUP_PERSONA -> CHAT -> CODE_EXECUTOR
            builder.addEdge(AGENT_NODES.SETUP_PERSONA, AGENT_NODES.CHAT);
            builder.addEdge(AGENT_NODES.CHAT, AGENT_NODES.CODE_EXECUTOR);
        }

        // Choose flow based on DEBUG_MODE
        if (process.env.DEBUG_MODE === 'true') {
            dryRunFlow();
        } else {
            automationFlow();
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
        const use = playwrightConfig.use || {};
        const actionTimeout = use.actionTimeout || 10000;
        const navTimeout = use.navigationTimeout || 30000;
        const timestamp = FileHelper.getTimestamp();
        this.testOutputDir = testName ? `output/${testName}_${timestamp}/` : `output/${timestamp}/`;

        this.browser = await chromium.launch({
            headless: use.headless ?? false,
        });

        this.context = await this.browser.newContext({
            viewport: use.viewport || { width: 1280, height: 720 },
            recordVideo: {
                dir: this.testOutputDir,
                size: use.viewport || { width: 1280, height: 720 }
            }
        });

        this.page = await this.context.newPage();
        this.page.setDefaultTimeout(actionTimeout);
        this.page.setDefaultNavigationTimeout(navTimeout);
    }

    public async stopBrowser() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    public async getPageScreenshot(filename: string): Promise<string> {
        try {
            const filePath = `${this.testOutputDir}screenshots/${filename}.png`;
            const buffer = await this.page.screenshot({
                path: filePath
            });
            console.log(`[${this.agentId}][🤖] >> 📸 Screenshot saved: ${filePath}`);

            // Return as base64
            return buffer.toString('base64');
        } catch (error) {
            console.error(`[${this.agentId}][🤖] >> ☠️ Error taking screenshot: ${error}`);
            return "";
        }
    }

    public async getElementsTree(isDebug = false): Promise<string> {
        try {
            const snapshot = await this.page.accessibility.snapshot();
            if (isDebug) {
                const timestamp = FileHelper.getTimestamp();
                console.log(`[${this.agentId}][🤖] >> 🌳 Saving elements tree snapshot: elements_tree_${timestamp}.json`);
                FileHelper.writeFile(this.debugDir, `elements_tree_${timestamp}.json`, snapshot);
            }

            return JSON.stringify(snapshot, null, 2);
        } catch (e) {
            return "Error getting snapshot";
        }
    }

    private async waitForUIStability(timeout = 10000, state?: AgentState): Promise<any> {
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


    private detectPageContext(pageTitle: any, currentUrl?: string) {
        const pageKnowledgeBase = [
            {
                pageTitle: "Agoda Official Site | Free Cancellation & Booking Deals | Over 2 Million Hotels",
                pageUrl: "https://www.agoda.com/",
                contextsPath: `${CONTEXTS_DIR}/homepage_context.njk`,
                workflowPath: `${WORKFLOWS_DIR}/homepage_workflow.njk`
            },
            {
                pageTitle: "Agoda | Hotels in Hong Kong | Best Price Guarantee!",
                pageUrl: "https://www.agoda.com/search",
                contextsPath: `${CONTEXTS_DIR}/searchpage_context.njk`,
                workflowPath: `${WORKFLOWS_DIR}/searchpage_workflow.njk`
            },
        ];

        // Return page context and workflow based on title/url match
        const title = pageTitle.toLowerCase();
        for (const knowledge of pageKnowledgeBase) {
            if (title.includes(knowledge.pageTitle.toLowerCase()) &&
                currentUrl?.includes(knowledge.pageUrl.toLowerCase())) {
                console.log(`[${this.agentId}][🤖] >> 💉 Inject page context: ${knowledge.contextsPath}`);
                const contextsTemplate = FileHelper.retrieveNjkTemplate(knowledge.contextsPath);
                console.log(`[${this.agentId}][🤖] >> 💉 Inject page workflow: ${knowledge.workflowPath}`);
                const workflowTemplate = FileHelper.retrieveNjkTemplate(knowledge.workflowPath);
                return {
                    // TODO: Implement dynamic data injection if needed
                    contexts: nunjucks.renderString(contextsTemplate, {}),
                    workflow: nunjucks.renderString(workflowTemplate, {})
                }
            }
        }
    }

    public extractCode(text: string): string {
        return text.replace(/```javascript/gi, "").replace(/```js/gi, "").replace(/```/g, "").trim();
    }
}