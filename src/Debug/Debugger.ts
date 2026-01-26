import * as readline from 'readline';
import { AutoBot } from '../Agents/AutoBot';
import { GEMINI_AUTO_AGENT_KEY, GEMINI_AUTO_AGENT_MODEL, PERSONA_DIR, RULES_DIR } from '../settings';
import { LLMVendor } from '../types';
import { CommonHelper } from '../Utils/CommonHelper';

process.env.DEBUG_MODE = "true";

async function main() {
    const autoBot = new AutoBot({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_AUTO_AGENT_KEY as any,
        model: GEMINI_AUTO_AGENT_MODEL,
        personaTemplatePath: `${PERSONA_DIR}/autobot_persona.njk`,
        additionalContexts: [`${RULES_DIR}/codegen_rules.njk`],
    });

    await autoBot.startBrowser();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log(`\n--- 🤖 Start Debugging 🤖 ---`);

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
                    process.stdout.write('\n ⏭️ Processing...\n');
                    const thread_id = `dryrun_${CommonHelper.generateUUID()}`;

                    await autoBot.execute(
                        {
                            step: input,
                        }, 
                        thread_id
                    );
                    console.log(' Done.');
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