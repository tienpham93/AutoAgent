import { AutoBot } from './Agents/AutoBot';
import { AgentState, LLMVendor, TestCase } from './types';
import { AGENT_NODES } from "./constants";
import {
    PERSONA_DIR,
    GEMINI_AUTO_AGENT_KEY,
    GEMINI_AUTO_AGENT_MODEL,
    SKILLS_DIR
} from './settings';
import { CommonHelper } from './Utils/CommonHelper';
import { TerminalLogger } from './Utils/TerminalLogger';
import { GraphInstance } from './Services/GraphService/GraphInstance';
import { FileHelper } from './Utils/FileHelper';

const sessionId = CommonHelper.generateUUID();
console.log(`[🧵🧵🧵] >> 🤖 Executing with Session ID: ${sessionId}`);
TerminalLogger.initialize("full_execution", sessionId);

const buildAutomationWorkflow = (autoBot: AutoBot) => {
    const graph = new GraphInstance();

    // NODE REGISTER
    graph.addNode(AGENT_NODES.SETUP_PERSONA, (state: AgentState) => autoBot.getSystemNode(state));
    graph.addNode(AGENT_NODES.CODE_GENERATOR, (state: AgentState) => autoBot.generatorNode(state));
    graph.addNode(AGENT_NODES.CODE_EXECUTOR, (state: AgentState) => autoBot.executorNode(state));

    // WORKFLOW: SETUP_PERSONA -> CODE_GENERATOR -> CODE_EXECUTOR
    graph.setEntryPoint(AGENT_NODES.SETUP_PERSONA);
    graph.addEdge(AGENT_NODES.SETUP_PERSONA, AGENT_NODES.CODE_GENERATOR);
    graph.addEdge(AGENT_NODES.CODE_GENERATOR, AGENT_NODES.CODE_EXECUTOR);

    // LOGICS: CODE_EXECUTOR -> (Success ? END : Retry CODE_GENERATOR)
    graph.addConditionalEdge(
        AGENT_NODES.CODE_EXECUTOR,
        (state: AgentState) => {
            console.log(`[${autoBot.agentId}][🤖] >> 🔄 Execution attempt: ${state.attempts}`);
            console.log(`[${autoBot.agentId}][🤖] >> ❔ Execution success: ${state.success}`);

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

    graph.buildWorkflow();
    return graph;
};

async function singleThreadRun(testCase: TestCase, sessionId: string) {
    const autoBot = new AutoBot(
        {
            vendor: LLMVendor.GEMINI,
            apiKey: GEMINI_AUTO_AGENT_KEY as any,
            model: GEMINI_AUTO_AGENT_MODEL,
            personaTemplatePath: `${PERSONA_DIR}/autobot_persona.njk`,
            additionalContexts: [
                `${SKILLS_DIR}/playwright-cli/SKILL.njk`
            ]
        },
        {
            sessionId: sessionId,
            isHeaded: true,
            recordVideo: true,
        }
    );

    const automationWorkflow = buildAutomationWorkflow(autoBot);
    autoBot.actionLogs = [];

    try {
        await autoBot.startBrowser(testCase.title);

        for (let step of testCase.steps) {
            const thread_id = `execution_${CommonHelper.generateUUID()}`;
            await automationWorkflow.execute(
                {
                    step: step.action,
                    notes: step.notes,
                    pwSpecificSkillsPaths: step.pwSpecificSkillsPaths,
                    pageContextPaths: step.pageContextPaths,
                    pageWorkflowPaths: step.pageWorkflowPaths
                },
                thread_id
            );
        }
    } catch (err) {
        console.error(`[${autoBot.agentId}][🤖] >> ❌ Error in case "${testCase.title}"`, err);
    } finally {
        await autoBot.stopBrowser(testCase.title);
        
        const reportData = {
            sessionId: sessionId,
            testTitle: testCase.title,
            testStep: testCase.steps,
            executionLogs: [...autoBot.actionLogs],
            timestamp: new Date().toISOString()
        };

        await autoBot.extractLog(testCase.title, reportData);
        autoBot.actionLogs = [];
    }
}

async function main() {
    // argv[2] = Path to JSON file
    const jsonPath = process.argv[2];
    
    // argv[3] = Test Case Title
    const testTitle = process.argv[3];

    try {
        // Read JSON and find the specific test case
        const rawData = FileHelper.readFile(jsonPath);
        const allTests: TestCase[] = JSON.parse(rawData);
        const testCase = allTests.find(t => t.title === testTitle);

        if (!testCase) {
            throw new Error(`Test case "${testTitle}" not found in ${jsonPath}`);
        }

        console.log(`[🧵🧵🧵] >> 🚀 Process started for: ${testTitle} (Session: ${sessionId})`);
        await singleThreadRun(testCase, sessionId);
        
        process.exit(0);
    } catch (err) {
        console.error(`[🧵🧵🧵] >> ❌ Process Failed for: ${testTitle}:`, err);
        process.exit(1);
    }
}

main();