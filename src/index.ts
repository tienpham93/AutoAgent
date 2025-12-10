import * as dotenv from 'dotenv';
import { AutoAgent } from './Agents/AutoAgent';
import { ExtractorAgent } from './Agents/ExtractorAgent';
import { FileHelper } from './Utils/FileHelper';
import { LLMVendor, TestCase } from './types';
import { EvaluatorAgent } from './Agents/EvaluatorAgent';
import path from 'path';

// Load Gemini Configuration
dotenv.config({ path: path.resolve(process.cwd(), 'env/gemini.env') });
const GEMINI_AUTO_AGENT_KEY = process.env.GEMINI_AUTO_AGENT_KEY;
const GEMINI_AUTO_AGENT_MODEL = process.env.GEMINI_AUTO_AGENT_MODEL || "gemini-2.5-flash";
const GEMINI_EVALUATOR_KEY = process.env.GEMINI_EVALUATOR_KEY;
const GEMINI_EVALUATOR_MODEL = process.env.GEMINI_EVALUATOR_MODEL || "gemini-1.5-flash";

// Load Claude Configuration
dotenv.config({ path: path.resolve(process.cwd(), 'env/claude.env') });
const CLAUDE_EXTRACTOR_KEY = process.env.CLAUDE_EXTRACTOR_KEY;
const CLAUDE_EXTRACTOR_MODEL = process.env.CLAUDE_EXTRACTOR_MODEL || "claude-3-5-haiku-20241022";
const CLAUDE_AUTO_AGENT_KEY = process.env.CLAUDE_AUTO_AGENT_KEY;
const CLAUDE_AUTO_AGENT_MODEL = process.env.CLAUDE_AUTO_AGENT_MODEL || "claude-haiku-4-5-20251001";

// Declare Directories
const TESTS_DIR = process.cwd() + '/src/__Tests__';
const PERSONA_DIR = process.cwd() + '/src/Prompts/Persona';
// const CONTEXTS_DIR = process.cwd() + '/src/Prompts/Contexts';
// const WORKFLOWS_DIR = process.cwd() + '/src/Prompts/Workflows';


async function main() {
    // INIT AGENTS
    const extractor = new ExtractorAgent({
        vendor: LLMVendor.CLAUDE,
        apiKey: CLAUDE_EXTRACTOR_KEY as any,
        model: CLAUDE_EXTRACTOR_MODEL,
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

    const evaluator = new EvaluatorAgent({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_EVALUATOR_KEY as any,
        model: GEMINI_EVALUATOR_MODEL, 
        persona: FileHelper.readTextFile(`${PERSONA_DIR}/evaluator_persona.txt`),
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