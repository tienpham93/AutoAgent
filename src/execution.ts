import { AutoAgent } from './Agents/AutoAgent';
import { ExtractorAgent } from './Agents/ExtractorAgent';
import { FileHelper } from './Utils/FileHelper';
import { LLMVendor, TestCase } from './types';
import pLimit from 'p-limit';
import {
    GEMINI_EXTRACTOR_KEY,
    GEMINI_EXTRACTOR_MODEL,
    PERSONA_DIR,
    GEMINI_AUTO_AGENT_KEY,
    GEMINI_AUTO_AGENT_MODEL,
    TESTS_DIR
} from './settings';

const MAX_CONCURRENT_WORKERS = 3; 

// Single thread execution
async function testExecuting(file: string) {
    const testName = file.replace('.md', '');
    console.log(`[🛠️🛠️🛠️] >> ⚡ Starting processing for: ${file}`);

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
    });

    try {
        // READ & PARSE
        const rawMarkdown = FileHelper.readTextFile(`${TESTS_DIR}/${file}`);
        
        let listTestCase: [TestCase];
        try {
            listTestCase = await extractor.parse(rawMarkdown) as [TestCase];
            console.log(`[🚁🚁🚁] >> ✅ Loaded successfully:\n${JSON.stringify(listTestCase, null, 2)}`);
        } catch (error) {
            console.error(`[🚁🚁🚁] >> ❌ Failed to prase "${file}":`, error);
        }

        // EXECUTE TEST CASES
        autoBot.actionLogs = [];
        for (let testCase of listTestCase!) {            
            try {
                await autoBot.startBrowser(testCase!.title);
                
                for (let step of testCase!.steps) {
                    await autoBot.executeStep(step.action, step.notes);
                }
                await autoBot.stopBrowser();

                // POST EXECUTION
                const reportData = {
                    testFile: file,
                    testTitle: testCase!.title,
                    testGoal: testCase!.goal,
                    testStep: testCase!.steps,
                    executionLogs: [...autoBot.actionLogs], 
                    timestamp: new Date().toISOString()
                };
                
                await autoBot.extractLog(testName, reportData);
            } catch (err) {
                console.error(`[${file}] >> Error in case "${testCase!.title}"`, err);
                await autoBot.stopBrowser();
            } finally {
                autoBot.actionLogs = [];
            }
        }
        console.log(`[🛠️🛠️🛠️] >> ✅ Worker Finished file: ${file}`);
    } catch (err) {
        console.error(`[🛠️🛠️🛠️] >> ❌ Worker Critical error processing file ${file}:`, err);
    }
}

async function executions() {
    console.log(`[🛠️🛠️🛠️] >> ⚡ Starting with ${MAX_CONCURRENT_WORKERS} workers...`);

    const files = FileHelper.readDirectory(TESTS_DIR).filter(f => f.endsWith('.md'));

    const limit = pLimit(MAX_CONCURRENT_WORKERS);

    const tasks = files.map(file => {
        return limit(() => testExecuting(file));
    });

    await Promise.all(tasks);
}

executions()