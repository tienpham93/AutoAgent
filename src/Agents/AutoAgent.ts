import { Browser, Page, chromium, BrowserContext } from "playwright";
import { BaseAgent } from "./BaseAgent";
import config from '../../playwright.config';
import { GeminiClient } from "../types";
import { FileHelper } from "../Utils/FileHelper";

export class AutoAgent extends BaseAgent {
    private browser: Browser | any;
    private page: Page | any;
    private context: BrowserContext | any;
    public actionLogs: string[] = [];
    public testOutputDir: string = '';

    constructor(geminiClient: GeminiClient) {
        super(geminiClient);
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

    private async getElementsTree(): Promise<string> {
        try {
            const snapshot = await this.page.accessibility.snapshot();
            return JSON.stringify(snapshot, null, 2);
        } catch (e) {
            return "Error getting snapshot";
        }
    }

    private async extractCode(rawText: string): Promise<string> {
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

    public async executeStep(step: string, contextNotes: string[]): Promise<void> {
        const pageElements = await this.waitForUIStability();

        const fullPrompt = `
            CURRENT PAGE STATE (JSON):
            ${pageElements}

            TESTCASE STEP: 
            ${step}

            NOTES:
            ${contextNotes.join('\n')}
        `;

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
            this.actionLogs.push(`Executed Success: ${step}`);
        } catch (e: any) {
            this.actionLogs.push(`Executed Failed: ${step} - ${e.message}`);
            console.error(`Step failed: ${e.message}`);
        }
    }
}