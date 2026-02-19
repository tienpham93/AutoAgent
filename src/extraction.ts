import { Architect } from './Agents/Architect';
import { FileHelper } from './Utils/FileHelper';
import { AgentState, LLMVendor, TestCase } from './types';
import { AGENT_NODES } from "./constants";
import {
    GEMINI_ARCHITECT_KEY,
    GEMINI_ARCHITECT_MODEL,
    PERSONA_DIR,
    TESTS_DIR,
    RULES_DIR,
    SKILLS_DIR
} from './settings';
import { CommonHelper } from './Utils/CommonHelper';
import { TerminalLogger } from './Utils/TerminalLogger';
import { GraphInstance } from './Services/GraphService/GraphInstance';

console.log(`[🧵🧵🧵] >> 🏗️ Start Extracting process`);
TerminalLogger.initialize("full_extraction");

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

async function main() {
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

    // ANAZYING & EXTRACT TEST CASES
    const files = FileHelper.readDirectory(TESTS_DIR).filter(f => f.endsWith('.md'));
    const listAllTestCases: TestCase[] = [];
    for (const file of files) {
        console.log(`[🧵🧵🧵] >> 🚀 Starting extracting for: ${file}`);

        const extractionWorkflow = buildExtractionWorkflow(architect);
        const rawMarkdown = FileHelper.readFile(`${TESTS_DIR}/${file}`);
        let listTestCase: TestCase[];
        let thread_id = `extraction_${CommonHelper.generateUUID()}`;
        try {
            const response = await extractionWorkflow.execute(
                {
                    architect_rawTestCase: rawMarkdown
                },
                thread_id
            )
            listTestCase = response.architect_extractedTestcases as [TestCase];
            console.log(`[${architect.agentId}][🏗️] >> ✅ Test cases Loaded successfully:\n${JSON.stringify(listTestCase, null, 2)}`);
            
            listAllTestCases.push(...listTestCase);
            // DELAY to Cool down after the heavy "Parse" operation
            await CommonHelper.sleep(5000);
        } catch (error) {
            console.error(`[${architect.agentId}][🏗️] >> ❌ Failed to prase "${file}":`, error);
            return;
        } 
    };
    FileHelper.writeFile(
        process.cwd(),
        `extracted_all_testcase.json`,
        listAllTestCases
    );
};

main();