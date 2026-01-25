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
    TESTS_DIR,
    RULES_DIR
} from './settings';
import { CommonHelper } from './Utils/CommonHelper';
import { Logzer } from './Utils/Logger';

const MAX_CONCURRENT_WORKERS = 1; 

// Single thread execution
async function testExecuting(file: string) {
    const testName = file.replace('.md', '');
    console.log(`[🧵🧵🧵] >> ⚡ Starting processing for: ${file}`);

    // INIT AGENTS
    const extractor = new ExtractorAgent({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_EXTRACTOR_KEY as any,
        model: GEMINI_EXTRACTOR_MODEL,
        personaTemplatePath: `${PERSONA_DIR}/extractor_persona.njk`,
        additionalContexts: [`${RULES_DIR}/extract_test_case_rules.njk`],
    });

    const autoBot = new AutoAgent({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_AUTO_AGENT_KEY as any,
        model: GEMINI_AUTO_AGENT_MODEL,
        personaTemplatePath: `${PERSONA_DIR}/autobot_persona.njk`,
        additionalContexts: [`${RULES_DIR}/codegen_rules.njk`],
    });

    try {
        // READ & PARSE
        const rawMarkdown = FileHelper.readTextFile(`${TESTS_DIR}/${file}`);
        
        let listTestCase: [TestCase];
        try {
            const thread_id = `extraction_${CommonHelper.generateUUID()}`;

            const response = await extractor.execute(
                {
                    extractor_rawTestCase: rawMarkdown
                }, 
                thread_id
            )
            listTestCase = response.extractor_extractedTestcases as [TestCase];
            console.log(`[🚁🚁🚁] >> ✅ Loaded successfully:\n${JSON.stringify(listTestCase, null, 2)}`);
            
            // DELAY to Cool down after the heavy "Parse" operation
            await CommonHelper.sleep(5000); 

        } catch (error) {
            console.error(`[🚁🚁🚁] >> ❌ Failed to prase "${file}":`, error);
            return; 
        }

        // EXECUTE TEST CASES
        autoBot.actionLogs = [];
        for (let testCase of listTestCase!) {      
            const reportData = {
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
                    // DELAY to ensures max 30 RPM per worker (Total 60 RPM for 2 workers)
                    const thread_id = `execution_${CommonHelper.generateUUID()}`;

                    await autoBot.execute(
                        {
                            step: step.action,
                            notes: step.notes
                        }, 
                        thread_id
                    );
                }
            } catch (err) {
                console.error(`[${file}] >> Error in case "${testCase!.title}"`, err);
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
        const tasks = files.map(file => {
            return limit(() => testExecuting(file));
        });

        await Promise.all(tasks);
        console.log("🏁 All workers finished execution.");

    } catch (err) {
        console.log(`[🕵️🕵️🕵️] >> ❌ Critical Error: ${err}`);
    } finally {
        Logzer.logStream.end();
    }
}

executions()