import * as dotenv from 'dotenv';
import { AutoAgent } from './Agents/AutoAgent';
import { ExtractorAgent } from './Agents/ExtractorAgent';
import { FileHelper } from './Utils/FileHelper';
import { TestCase } from './types';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.MODEL_NAME || "gemini-2.5-flash";
const TESTS_DIR = process.cwd() + '/src/__Tests__';
const PERSONA_DIR = process.cwd() + '/src/Prompts/Persona';
// const CONTEXTS_DIR = process.cwd() + '/src/Prompts/Contexts';
// const WORKFLOWS_DIR = process.cwd() + '/src/Prompts/Workflows';

async function main() {
    
    // INIT AGENTS
    if (!API_KEY) throw new Error("🚫 API Key missing 🚫");

    const extractor = new ExtractorAgent({
        apiKey: API_KEY,
        model: MODEL,
        persona: FileHelper.readTextFile(`${PERSONA_DIR}/extractor_persona.txt`)
    });

    const autoBot = new AutoAgent({
        apiKey: API_KEY,
        model: MODEL,
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

main();