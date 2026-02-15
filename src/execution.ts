import { AutoBot } from './Agents/AutoBot';
import { Architect } from './Agents/Architect';
import { FileHelper } from './Utils/FileHelper';
import { AgentState, LLMVendor, TestCase } from './types';
import pLimit from 'p-limit';
import { AGENT_NODES } from "./constants";
import {
    GEMINI_EXTRACTOR_KEY,
    GEMINI_EXTRACTOR_MODEL,
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
const executionId = CommonHelper.generateUUID();
console.log(`[🧵🧵🧵] >> Execution ID: ${executionId}`);

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

async function testExecuting(file: string) {
    const testName = file.replace('.md', '');
    console.log(`[🧵🧵🧵] >> ⚡ Starting processing for: ${file}`);
    
    // INIT AGENT
    const architect = new Architect({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_EXTRACTOR_KEY as any,
        model: GEMINI_EXTRACTOR_MODEL,
        personaTemplatePath: `${PERSONA_DIR}/architect_persona.njk`,
        additionalContexts: [
            `${SKILLS_DIR}/playwright-cli/SKILL.njk`,
            `${RULES_DIR}/playwright_skills_catalog.njk`,
            `${RULES_DIR}/page_knowledge_catalog.njk`,
            `${RULES_DIR}/extract_test_case_rules.njk`
        ],
    });

    const autoBot = new AutoBot({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_AUTO_AGENT_KEY as any,
        model: GEMINI_AUTO_AGENT_MODEL,
        personaTemplatePath: `${PERSONA_DIR}/autobot_persona.njk`,
        additionalContexts: [
            `${SKILLS_DIR}/playwright-cli/SKILL.njk`
        ],
    });

    const extractionWorkflow = buildExtractionWorkflow(architect);
    const automationWorkflow = buildAutomationWorkflow(autoBot);

    try {
        // READ & PARSE
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
            console.log(`[${architect.agentId}][🚁] >> ✅ Loaded successfully:\n${JSON.stringify(listTestCase, null, 2)}`);

            // DELAY to Cool down after the heavy "Parse" operation
            await CommonHelper.sleep(5000);

        } catch (error) {
            console.error(`[${architect.agentId}][🚁] >> ❌ Failed to prase "${file}":`, error);
            return;
        }

        // AUTOMATION
        autoBot.actionLogs = [];

        for (let testCase of listTestCase!) {
            const reportData = {
                executionId: executionId,
                testFile: file,
                testTitle: testCase!.title,
                testGoal: testCase!.goal,
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
                await autoBot.stopBrowser();
                await autoBot.extractLog(testName, reportData);
                autoBot.actionLogs = [];
            }
        }
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
        const tasks = files.map(file => limit(() => testExecuting(file)));
        await Promise.all(tasks);
        console.log("[🧵🧵🧵] >> ✅ All workers finished execution.");
    } catch (err) {
        console.log(`[🧵🧵🧵] >> ❌ Critical Error: ${err}`);
    }
}

executions();