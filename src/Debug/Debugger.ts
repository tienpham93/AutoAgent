import * as readline from 'readline';
import { AutoBot } from '../Agents/AutoBot';
import { GEMINI_AUTO_AGENT_KEY, GEMINI_AUTO_AGENT_MODEL, PERSONA_DIR, RULES_DIR } from '../settings';
import { AgentState, LLMVendor } from '../types';
import { CommonHelper } from '../Utils/CommonHelper';
import { AGENT_NODES } from '../constants';
import { GraphInstance } from '../Services/GraphService/GraphInstance';

process.env.DEBUG_MODE = "true";

const buildDryrunWorkflow = (autoBot: AutoBot) => {
    const graph = new GraphInstance();

    // REGISTER
    graph.addNode(AGENT_NODES.SETUP_PERSONA, (state: AgentState) => autoBot.getSystemNode(state));
    graph.addNode(AGENT_NODES.CHAT, (state: AgentState) => autoBot.chatNode(state));
    graph.addNode(AGENT_NODES.CODE_EXECUTOR, (state: AgentState) => autoBot.executorNode(state));

    // WORKFLOW: SETUP_PERSONA -> CHAT -> CODE_EXECUTOR
    graph.setEntryPoint(AGENT_NODES.SETUP_PERSONA);
    graph.addEdge(AGENT_NODES.SETUP_PERSONA, AGENT_NODES.CHAT);
    graph.addEdge(AGENT_NODES.CHAT, AGENT_NODES.CODE_EXECUTOR);

    graph.buildWorkflow();
    return graph;
}

async function dryrun() {
    const autoBot = new AutoBot({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_AUTO_AGENT_KEY as any,
        model: GEMINI_AUTO_AGENT_MODEL,
        personaTemplatePath: `${PERSONA_DIR}/autobot_persona.njk`,
        additionalContexts: [`${RULES_DIR}/codegen_rules.njk`],
    });

    const dryrunWorkflow = buildDryrunWorkflow(autoBot);

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

                    await dryrunWorkflow.execute(
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

dryrun();