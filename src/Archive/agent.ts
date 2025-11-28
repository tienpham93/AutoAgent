
import * as readline from 'readline';
import { GeminiClient } from "./geminiClient";
import { chromium } from 'playwright';

// Get Element tree with Accessibility version
const getElementsTree = async (page: any) => {
    try {
        const snapshot = await page.accessibility.snapshot();
        const jsonSnapshot = JSON.stringify(snapshot, null, 2); 
        // console.log("Elements tree >> ", jsonSnapshot);
        return jsonSnapshot;
    } catch (e) {
        return "Could not get page context.";
    }
}

const extractCode = (rawText: string) => {
    let clean = rawText.replace(/```javascript/g, "").replace(/```js/g, "").replace(/```/g, "");
    return clean.trim();
}

async function agent() {

    // Initialize Playwright Chromium browser
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('https://agoda.com/');

    // Initialize Gemini API
    const geminiChat = GeminiClient();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log(`\n--- 🤖 Auto Agent Started 🤖 ---`);

    const processInput = () => {
        rl.question('\x1b[36mYou: \x1b[0m', async (input) => {
            if (input.toLowerCase() === 'exit') {
                await browser.close();
                rl.close();
                return;
            }

            try {
                process.stdout.write('Reading page structure...');
                
                // Get Current elements tree
                const pageElements = await getElementsTree(page);

                process.stdout.write('\rThinking...');
                
                // B. Send Prompt + Context to Gemini
                // We combine the user's request with the current page state
                const fullPrompt = `
                    CURRENT PAGE STATE (JSON):
                    ${pageElements}

                    USER REQUEST: 
                    "${input}"
                `;

                const result = await geminiChat.sendMessage(fullPrompt);
                const codeToRun = extractCode(result.response.text());
                
                console.log(`\r\x1b[33mExecuting:\x1b[0m ${codeToRun.split('\n')[0]}...`);

                // Execute Code through terminal
                await eval(`(async () => { 
                    try {
                        ${codeToRun} 
                    } catch (e) { 
                        console.error("Playwright Error:", e.message); 
                    }
                })()`);

                console.log("\x1b[32mDone.\x1b[0m\n");

            } catch (error) {
                console.error("\nAI Error:", error);
            }

            processInput();
        });
    };

    processInput();
}

agent();