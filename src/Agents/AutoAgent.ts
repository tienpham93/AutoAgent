import { Browser, Page, chromium } from "playwright";
import { BaseAgent } from "./BaseAgent";

export class AutoAgent extends BaseAgent {
    private browser: Browser | any;
    private page: Page | any;
    public actionLogs: string[] = [];

    constructor(apiKey: string, model: string) {
        super(
            apiKey,
            model,
            `You are a Playwright Automation Agent.
            INPUT: Global Notes, Accessibility Tree, Current Step.
            OUTPUT: Valid Playwright Code ONLY. No explanations.
            Assume 'page' exists.`
        );
    }

    public async startBrowser() {
        this.browser = await chromium.launch({ headless: false });
        const context = await this.browser.newContext();
        this.page = await context.newPage();
    }

    public async stopBrowser() {
        await this.browser.close();
    }

    private async getElementsTree(): Promise<string> {
        try {
            const snapshot = await this.page.accessibility.snapshot();
            return JSON.stringify(snapshot, null, 2); 
        } catch (e) { return "Error getting snapshot"; }
    }

    private async extractCode(rawText: string): Promise<string> {
        let clean = rawText.replace(/```javascript/g, "").replace(/```js/g, "").replace(/```/g, "");
        return clean.trim();
    }
    

    public async executeStep(step: string, contextNotes: string): Promise<void> {        
        const pageElements = await this.getElementsTree();
        
        const fullPrompt = `
            CURRENT PAGE STATE (JSON):
            ${pageElements}

            TESTCASE STEP: 
            ${step}

            NOTES:
            ${contextNotes}
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
            this.actionLogs.push(`Success: ${step}`);
        } catch (e: any) {
            this.actionLogs.push(`Failed: ${step} - ${e.message}`);
            console.error(`Step failed: ${e.message}`);
        }
    }
}