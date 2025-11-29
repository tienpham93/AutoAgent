import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { AutoAgent } from './Agents/AutoAgent';
import { ExtractorAgent } from './Agents/ExtractorAgent';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.MODEL_NAME || "gemini-2.5-flash";
const TESTS_DIR = process.cwd() + '/src/__Tests__';
const RESULTS_DIR = process.cwd() + '/output/';

async function main() {
    if (!API_KEY) throw new Error("🚫 API Key missing 🚫");

    // Initialize Agents
    const extractor = new ExtractorAgent(API_KEY, MODEL);
    const autoBot = new AutoAgent(API_KEY, MODEL);

    const files = fs.readdirSync(TESTS_DIR).filter(f => f.endsWith('.md'));

    for (const file of files) {
        // 1. READ & PARSE TESTCASE
        const rawMarkdown = fs.readFileSync(path.join(TESTS_DIR, file), 'utf-8');
        console.log("[🚁🚁🚁] >> 🏗️ Parsing test case...");

        let testCase: any;
        try {
            testCase = await extractor.parse(rawMarkdown);
            console.log(`[🚁🚁🚁] >> ✅ Loaded successfully:\n${JSON.stringify(testCase, null, 2)}`);
        } catch (error) {
            console.error(`[🚁🚁🚁] >> ❌ Failed to prase "${file}":`, error);
        }


        // 2. EXECUTION TESTCASE
        await autoBot.startBrowser();

        autoBot.actionLogs = [];
        for (const step of testCase.steps) {
            try {
                await autoBot.executeStep(step, testCase.notes || "");
            } catch (error: any) {
                console.error(`[🤖🤖🤖] >> ☠️ Error executing step "${step}":`, error);
            }

        }
        await autoBot.stopBrowser();

        // 3. POST-PROCESS PREPARATION (Save Data)
        const reportData = {
            testFile: file,
            testTitle: testCase.title,
            testGoal: testCase.goal,
            expectedResults: testCase.expectedResults,
            executionLogs: autoBot.actionLogs, // <--- The Evaluator will need this later
            timestamp: new Date().toISOString()
        };

        if (!fs.existsSync(RESULTS_DIR)) {
            fs.mkdirSync(RESULTS_DIR, { recursive: true });
        }
        const reportPath = path.join(RESULTS_DIR, `${file.replace('.md', '')}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

        console.log(`   💾 Execution data saved to: results/${path.basename(reportPath)}`);
        console.log(`════════════════════════════════════════`);
    }
}

main();