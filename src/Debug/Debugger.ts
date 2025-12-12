import * as readline from 'readline';
import { AutoAgent } from '../Agents/AutoAgent';
import { FileHelper } from '../Utils/FileHelper';
import { GEMINI_AUTO_AGENT_KEY, GEMINI_AUTO_AGENT_MODEL, PERSONA_DIR } from '../settings';
import { LLMVendor } from '../types';

async function main() {
    const autoBot = new AutoAgent({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_AUTO_AGENT_KEY as any,
        model: GEMINI_AUTO_AGENT_MODEL || "gemini-2.5-flash",
        persona: FileHelper.readTextFile(`${PERSONA_DIR}/autobot_persona.txt`)
    });

    await autoBot.startBrowser();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log(`\n--- 🤖 Auto Agent Started 🤖 ---`);

    const processInput = () => {
        rl.question('\x1b[36mYou: \x1b[0m', async (input) => {
            if (input.toLowerCase() === 'exit') {
                await autoBot.stopBrowser();
                rl.close();
                return;
            }

            if (input.toLowerCase() === 'take snapshot') {
                await autoBot.getElementsTree(true);
                processInput();

            } else {
                try {
                    process.stdout.write('Reading page structure...');
                    
                    // Get Current elements tree
                    const pageElements = await autoBot.getElementsTree();                
                    const fullPrompt = `
                        CURRENT PAGE STATE (JSON):
                        ${pageElements}
    
                        USER REQUEST: 
                        "${input}"
                    `;
    
                    const pwRawScript = await autoBot.sendToLLM(fullPrompt);
                    const pwScript = await autoBot.extractCode(pwRawScript);
    
                    console.log(`[🤖🤖🤖] >> 🎭 Step Script: "${pwScript}"\n`);
    
                    const page = await autoBot.page;
                    // Execute Code through terminal
                    await eval(`(async () => { 
                        try {
                            ${pwScript}
                        } catch (e) { 
                            console.error("Playwright Error:", e.message); 
                        }
                    })()`);
                    console.log("\x1b[32mDone.\x1b[0m\n");
                } catch (error) {
                    console.error("\nAI Error:", error);
                }
    
                processInput();
            }
        });
    };

    processInput();
}

main();