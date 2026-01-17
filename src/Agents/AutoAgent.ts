import { Browser, Page, chromium, BrowserContext } from "playwright";
import { HumanMessage } from "@langchain/core/messages";
import { StateGraph, START, END, Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { BaseAgent } from "./BaseAgent";
import { AgentConfig, AgentState, AutomationState } from "../types";
import { FileHelper } from "../Utils/FileHelper";
import { CONTEXTS_DIR, RULES_DIR, WORKFLOWS_DIR } from "../settings";
import playwrightConfig from '../../playwright.config';
import * as nunjucks from "nunjucks";

const automationStateSchema: AutomationState = Annotation.Root({
    messages: MessagesAnnotation.spec.messages,
    step: Annotation<string>(),
    notes: Annotation<string[]>(),
    snapshot: Annotation<string>(),
    error: Annotation<string | null>(),
    success: Annotation<boolean>(),
    attempts: Annotation<number>(),
    threadId: Annotation<string>(),
});

type AutoState = typeof automationStateSchema.State;

export class AutoAgent extends BaseAgent {
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

    private automationFlow: ReturnType<AutoAgent["initAutomationFlow"]>;

    constructor(config: AgentConfig) {
        super(config);
        this.automationFlow = this.initAutomationFlow();
    }

    /**
     * 🕸️ LangGraph Orchestration
     * Defines the flow: Generate -> Execute -> (Success? End : Retry)
     */
    private initAutomationFlow() {
        // NODE 1: Generator - Writes the Playwright script
        const generatorNode = async (state: AutoState) => {
            const pageElements = await this.waitForUIStability();

            let currentPageTitle = await JSON.parse(pageElements).name;
            let currentUrl = await this.page.url();
            let pageKnowledgeBase: any;

            // Check if pageTitle or currentUrl have changed
            if (this.pageTitle !== currentPageTitle && this.currentUrl !== currentUrl) {
                this.pageTitle = await JSON.parse(pageElements).name;
                this.currentUrl = await this.page.url();
                pageKnowledgeBase = this.detectPageContext(this.pageTitle, this.currentUrl);
            }

            // Extract step and notes from state
            const step = state.step;
            const contextNotes = state.notes.join(' | ');

            let fullPrompt = this.buildPrompt(
                `${RULES_DIR}/execute_test_step_rules.njk`,
                {
                    pageContexts: pageKnowledgeBase?.contexts,
                    pageWorkflows: pageKnowledgeBase?.workflow,
                    currentUrl: this.currentUrl,
                    snapshot: state.snapshot,
                    step: step,
                    contextNotes: contextNotes,
                    error: state.error
                }
            )

            const pwRawScript = await this.sendToLLM(fullPrompt, state.threadId);
            console.log(`[🤖🤖🤖] >> 🦾 Executing step: "${step}"`);
            console.log(`[🤖🤖🤖] >> 📌 Step Note: "${contextNotes}"`);
            console.log(`[🤖🤖🤖] >> 🎭 Step Script: "${pwRawScript}"\n`);

            return {
                // We store the response in history so the LLM remembers its previous code in the next retry
                messages: [new HumanMessage(pwRawScript)],
                attempts: state.attempts + 1
            };
        };

        // NODE 2: Executor - Runs the script in the real browser
        const executorNode = async (state: AgentState) => {
            const lastMessage = state.messages[state.messages.length - 1];
            const code = this.extractCode(lastMessage.content.toString());

            try {
                const page = this.page;
                // Execute in the real browser
                await eval(`(async () => { ${code} })()`);
                return { success: true, error: null };
            } catch (e: any) {
                console.error(`[💥] Execution Error: ${e.message}`);
                return { success: false, error: e.message };
            }
        };

        // Define the Workflow
        const workflow = new StateGraph(automationStateSchema)
            .addNode("generator", generatorNode)
            .addNode("executor", executorNode)
            .addEdge(START, "generator")
            .addEdge("generator", "executor")
            // 🔄 The "Self-Healing" Edge
            .addConditionalEdges("executor", (state) => {
                if (state.success) return "end";
                if (state.attempts >= 3) return "end"; // Max retries
                return "generator"; // Retry!
            }, {
                "end": END,
                "generator": "generator"
            });

        return workflow.compile();
    }

    public async extractLog(testName: string, data: any): Promise<void> {
        try {
            FileHelper.writeFile(this.testOutputDir, `${testName}.json`, data);
            console.log(`[🤖🤖🤖] >> ⏹️ Extract log: ${testName}.json`);
        } catch (error) {
            console.error(`[🤖🤖🤖] >> ☠️ Error writing log file: ${error}`);
        }
    }

    public async executeStep(step: string, contextNotes: string[]): Promise<void> {
        const snapshot = await this.waitForUIStability();
        const threadId = `run_${Date.now()}`; // Unique ID so retries share history

        const result = await this.automationFlow.invoke({
            messages: [],
            step,
            notes: contextNotes,
            snapshot,
            attempts: 0,
            success: false,
            error: null,
            threadId
        });

        if (!result.success) {
            const finalErrorMsg = `[🤖🤖🤖] >> ☠️ Failed self recovery with Error: ${result.error}`;
            this.actionLogs.push(`FATAL: ${finalErrorMsg}`);
            throw new Error(finalErrorMsg);
        }

        this.actionLogs.push(`Executed: ${step}`);
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

    public async getElementsTree(isDebug = false): Promise<string> {
        try {
            const snapshot = await this.page.accessibility.snapshot();
            if(isDebug) {
                const timestamp = FileHelper.getTimestamp();
                console.log(`[🤖🤖🤖] >> 🌳 Saving elements tree snapshot: elements_tree_${timestamp}.json`);
                FileHelper.writeFile(this.debugDir, `elements_tree_${timestamp}.json`, snapshot);
            }

            return JSON.stringify(snapshot, null, 2);
        } catch (e) {
            return "Error getting snapshot";
        }
    }

    private async waitForUIStability(timeout = 10000): Promise<string> {
        const startTime = Date.now();
        let previousSnapshot = await this.getElementsTree();

        // Check the tree every 1s until timeout
        while (Date.now() - startTime < timeout) {
            await new Promise(r => setTimeout(r, 1000));
            const currentSnapshot = await this.getElementsTree();

            if (previousSnapshot === currentSnapshot) {
                // Tree hasn't changed
                return currentSnapshot;
            }

            // Tree changed
            previousSnapshot = currentSnapshot;
        }

        return previousSnapshot;
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
                console.log(`[🤖🤖🤖] >> 💉 Inject page context: ${knowledge.contextsPath}`);
                const contextsTemplate = FileHelper.retrieveNjkTemplate(knowledge.contextsPath);
                console.log(`[🤖🤖🤖] >> 💉 Inject page workflow: ${knowledge.workflowPath}`);
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