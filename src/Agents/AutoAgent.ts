import { Browser, Page, chromium, BrowserContext } from "playwright";
import { BaseAgent } from "./BaseAgent";
import config from '../../playwright.config';
import { AgentConfig } from "../types";
import { FileHelper } from "../Utils/FileHelper";

const CONTEXTS_DIR = process.cwd() + '/src/Prompts/Contexts';
const WORKFLOWS_DIR = process.cwd() + '/src/Prompts/Workflows';

export class AutoAgent extends BaseAgent {
    private browser: Browser | any;
    public page: Page | any;
    private context: BrowserContext | any;
    public actionLogs: string[] = [];
    public testOutputDir: string = '';
    public debugDir: string = 'src/Debug/Elements/';
    private pageTitle: string = '';
    private currentUrl: string = '';

    constructor(config: AgentConfig) {
        super(config);
    }

    public async startBrowser(testName?: string): Promise<void> {
        const use = config.use || {};
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
        await this.browser.close();
    }

    public async extractLog(testName: string, data: any): Promise<void> {
        try {
            FileHelper.writeFile(this.testOutputDir, `${testName}.json`, data);
            console.log(`[🤖🤖🤖] >> ⏹️ Extract log: ${testName}.json`);
        } catch (error) {
            console.error(`[🤖🤖🤖] >> ☠️ Error writing log file: ${error}`);
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

    public async extractCode(rawText: string): Promise<string> {
        let clean = rawText.replace(/```javascript/g, "").replace(/```js/g, "").replace(/```/g, "");
        return clean.trim();
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
                pageUrl: "www.agoda.com",
                contextsPath: `${CONTEXTS_DIR}/homepage-context.txt`,
                workflowPath: `${WORKFLOWS_DIR}/homepage-workflow.txt`
            }
        ];

        // Return page context and workflow based on title/url match
        const title = pageTitle.toLowerCase();
        for (const knowledge of pageKnowledgeBase) {
            if (title.includes(knowledge.pageTitle.toLowerCase()) || 
                currentUrl?.includes(knowledge.pageUrl.toLowerCase())) {
                console.log(`[🤖🤖🤖] >> 💉 Inject page context: ${knowledge.contextsPath}`);
                console.log(`[🤖🤖🤖] >> 💉 Inject page workflow: ${knowledge.workflowPath}`);
                return {
                    contexts: FileHelper.readTextFile(knowledge.contextsPath),
                    workflow: FileHelper.readTextFile(knowledge.workflowPath)
                }
            }
        }

    }

    public async executeStep(step: string, contextNotes: string[], MAX_RETRIES = 3): Promise<void> {
        let attempt = 0;
        let lastError: string | null = null;
    
        // Retry if there's an error
        while (attempt < MAX_RETRIES) {
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
    
            let fullPrompt = `
                ***KNOWLEDGE BASE***
                PAGE CONTEXTS:
                ${pageKnowledgeBase?.contexts || 'N/A'}
                PAGE WORKFLOWS:
                ${pageKnowledgeBase?.workflow || 'N/A'}
                ------------------------------
                ***CURRENT PAGE STATE (JSON)***
                ${pageElements}
                ------------------------------
                ***TESTCASE STEP***
                ${step}
                ------------------------------
                ***NOTES***
                If Note is NOT empty, please Must follow strictly locator strategy/instruction in notes
                ${contextNotes.join('\n')}
            `;
    
            // Inject last error if exists
            if (lastError) {
                fullPrompt = `
                \n------------------------------
                *** ⚠️ PREVIOUS ATTEMPT FAILED ⚠️ ***
                Your last generated code failed to execute.
                ERROR MESSAGE: "${lastError}"
                
                INSTRUCTIONS FOR RECOVERY:
                1. Analyze the Error Message above.
                2. If the error suggests a timeout, probably the elements doesn't present, so that must look for the notes in that step first.
                3. Find instructions in page contexts and workflows to better address the step.
                4. If the errors regarding elements/locators, hence Do NOT repeat the exact same code/selector.
                5. Use the "CURRENT PAGE STATE" to find a better selector (e.g., if ID failed, try text or aria-label).
                ------------------------------
                `;
            }
    
            const pwRawScript = await this.sendToLLM(fullPrompt);
            const pwScript = await this.extractCode(pwRawScript);
            console.log(`[🤖🤖🤖] >> 🦾 Executing step: "${step}"`);
            console.log(`[🤖🤖🤖] >> 📌 Step Note: "${contextNotes}"`);
            console.log(`[🤖🤖🤖] >> 🎭 Step Script: "${pwScript}"\n`);

            try {
                const page = await this.page;
                await eval(
                    `(async () => {
                        ${pwScript} 
                    })()`
                );
                // ✅ SUCCESS: Log and Break Loop
                this.actionLogs.push(`Executed Success: ${step}`);
                return; 
            } catch (e: any) {
                // ❌ FAILURE: Capture error and loop again
                lastError = e.message;
                console.error(`[🤖🤖🤖] >> 💥 Error in Attempt ${attempt + 1} Failed: ${lastError}`);
                this.actionLogs.push(`Attempt ${attempt + 1} Failed: ${step} - ${lastError}`);
                attempt++;
            }
        }
    
        const finalErrorMsg = `[🤖🤖🤖] >> ☠️ Failed self recovery with Error: ${lastError}`;
        this.actionLogs.push(`FATAL: ${finalErrorMsg}`);
        throw new Error(finalErrorMsg);
    }
}