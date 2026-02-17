import { AutoBot } from './Agents/AutoBot';
import { Architect } from './Agents/Architect';
import { FileHelper } from './Utils/FileHelper';
import { AgentState, LLMVendor, TestCase } from './types';
import pLimit from 'p-limit';
import { AGENT_NODES } from "./constants";
import {
    GEMINI_ARCHITECT_KEY,
    GEMINI_ARCHITECT_MODEL,
    PERSONA_DIR,
    GEMINI_AUTO_AGENT_KEY,
    GEMINI_AUTO_AGENT_MODEL,
    TESTS_DIR,
    RULES_DIR,
    SKILLS_DIR
} from './settings';
import { CommonHelper } from './Utils/CommonHelper';
import { TerminalLogger } from './Utils/TerminalLogger';
import { GraphInstance } from './Services/GraphService/GraphInstance';

const MAX_CONCURRENT_WORKERS = 2;
TerminalLogger.initialize();

const buildExtractionWorkflow = (architect: Architect) => {
    const graph = new GraphInstance();

    // NODE REGISTER
    graph.addNode(AGENT_NODES.SETUP_PERSONA, (state: AgentState) => architect.getSystemNode(state));
    graph.addNode(AGENT_NODES.EXTRACTION, (state: AgentState) => architect.extractionNode(state));

    // graph: SETUP_PERSONA -> EXTRACTION
    graph.setEntryPoint(AGENT_NODES.SETUP_PERSONA);
    graph.addEdge(AGENT_NODES.SETUP_PERSONA, AGENT_NODES.EXTRACTION);

    graph.buildWorkflow();
    return graph;
};

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

const initArchitect = () => {
    const architect = new Architect({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_ARCHITECT_KEY as any,
        model: GEMINI_ARCHITECT_MODEL,
        personaTemplatePath: `${PERSONA_DIR}/architect_persona.njk`,
        additionalContexts: [
            `${SKILLS_DIR}/playwright-cli/SKILL.njk`,
            `${RULES_DIR}/playwright_skills_catalog.njk`,
            `${RULES_DIR}/page_knowledge_catalog.njk`,
            `${RULES_DIR}/extract_test_case_rules.njk`
        ],
    });
    return architect;
};

const initAutoBot = (sessionId: string) => {
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
    return autoBot;
}

async function singleThreadRun(file: string) {
    const sessionId = CommonHelper.generateUUID();
    console.log(`[🧵🧵🧵] >> Executing Session ID: ${sessionId}`);

    const testName = file.replace('.md', '');
    console.log(`[🧵🧵🧵] >> ⚡ Starting processing for: ${file}`);

    try {
        // ANAZYING & EXTRACT TEST CASES
        const architect = initArchitect();
        const extractionWorkflow = buildExtractionWorkflow(architect);
        const rawMarkdown = FileHelper.readFile(`${TESTS_DIR}/${file}`);
        let listTestCase: [TestCase];
        let thread_id = `extraction_${CommonHelper.generateUUID()}`;
        try {
            const response = await extractionWorkflow.execute(
                {
                    architect_rawTestCase: rawMarkdown
                },
                thread_id
            )
            listTestCase = response.architect_extractedTestcases as [TestCase];
            console.log(`[${architect.agentId}][🚁] >> ✅ Test cases Loaded successfully:\n${JSON.stringify(listTestCase, null, 2)}`);

            // DELAY to Cool down after the heavy "Parse" operation
            await CommonHelper.sleep(5000);

        } catch (error) {
            console.error(`[${architect.agentId}][🚁] >> ❌ Failed to prase "${file}":`, error);
            return;
        }

        // EXECUTE TEST CASES
        const autoBot = initAutoBot(sessionId);
        const automationWorkflow = buildAutomationWorkflow(autoBot);
        autoBot.actionLogs = [];
        for (let testCase of listTestCase) {
            const reportData = {
                sessionId: sessionId,
                testFile: file,
                testTitle: testCase!.title,
                testStep: testCase!.steps,
                executionLogs: [...autoBot.actionLogs],
                timestamp: new Date().toISOString()
            };

            try {
                await autoBot.startBrowser(testCase!.title);

                for (let step of testCase!.steps) {
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
                console.error(`[${autoBot.agentId}][${file}] >> Error in case "${testCase!.title}"`, err);
            } finally {
                await autoBot.stopRecording(testCase!.title);
                await autoBot.extractLog(testName, reportData);
                autoBot.actionLogs = [];
            }
        };
        await autoBot.stopBrowser();
        console.log(`[🧵🧵🧵] >> ✅ Worker Finished file: ${file}`);
    } catch (err) {
        console.error(`[🧵🧵🧵] >> ❌ Worker Critical error processing file ${file}:`, err);
    }
}

async function executions() {
    console.log(`[🧵🧵🧵] >> Starting with ${MAX_CONCURRENT_WORKERS} workers...`);
    const files = FileHelper.readDirectory(TESTS_DIR).filter(f => f.endsWith('.md'));
    const limit = pLimit(MAX_CONCURRENT_WORKERS);

    try {
        const tasks = files.map(file => limit(() => 
            singleThreadRun(file)
        ));
        await Promise.all(tasks);
        console.log("[🧵🧵🧵] >> ✅ All workers finished execution.");
    } catch (err) {
        console.log(`[🧵🧵🧵] >> ❌ Critical Error: ${err}`);
    }
}

executions();