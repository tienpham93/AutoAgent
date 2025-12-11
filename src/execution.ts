import { AutoAgent } from './Agents/AutoAgent';
import { ExtractorAgent } from './Agents/ExtractorAgent';
import { FileHelper } from './Utils/FileHelper';
import { LLMVendor, TestCase } from './types';
import {
    GEMINI_EXTRACTOR_KEY,
    GEMINI_EXTRACTOR_MODEL,
    PERSONA_DIR,
    GEMINI_AUTO_AGENT_KEY,
    GEMINI_AUTO_AGENT_MODEL,
    TESTS_DIR
} from './settings';


async function execution() {
    // INIT AGENTS
    const extractor = new ExtractorAgent({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_EXTRACTOR_KEY as any,
        model: GEMINI_EXTRACTOR_MODEL,
        persona: FileHelper.readTextFile(`${PERSONA_DIR}/extractor_persona.txt`)
    });

    const autoBot = new AutoAgent({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_AUTO_AGENT_KEY as any,
        model: GEMINI_AUTO_AGENT_MODEL,
        persona: FileHelper.readTextFile(`${PERSONA_DIR}/autobot_persona.txt`),
        // intialContexts: [
        //         FileHelper.readTextFile(`${CONTEXTS_DIR}/homepage-context.txt`),
        //         FileHelper.readTextFile(`${WORKFLOWS_DIR}/homepage-workflow.txt`)
        //     ]
    });

    // READ & PARSE TESTCASE
    const files = FileHelper.readDirectory(TESTS_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
        const rawMarkdown = FileHelper.readTextFile(`${TESTS_DIR}/${file}`);
        console.log("[🚁🚁🚁] >> 🏗️ Parsing test case...");

        let testCase: TestCase;
        try {
            testCase = await extractor.parse(rawMarkdown);
            console.log(`[🚁🚁🚁] >> ✅ Loaded successfully:\n${JSON.stringify(testCase, null, 2)}`);
        } catch (error) {
            console.error(`[🚁🚁🚁] >> ❌ Failed to prase "${file}":`, error);
        }
        const testName = file.replace('.md', '');

        // EXECUTING TESTCASE
        await autoBot.startBrowser(testName);

        autoBot.actionLogs = [];
        for (const step of testCase!.steps) {
            await autoBot.executeStep(step.action, step.notes);
        }
        await autoBot.stopBrowser();

        // POST EXECUTION
        const reportData = {
            testFile: file,
            testTitle: testCase!.title,
            testGoal: testCase!.goal,
            testStep: testCase!.steps,
            executionLogs: autoBot.actionLogs, // <--- The Evaluator will need this later
            timestamp: new Date().toISOString()
        };
        await autoBot.extractLog(testName, reportData);
    }
}

execution();