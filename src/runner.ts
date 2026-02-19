import { FileHelper } from './Utils/FileHelper';
import { spawn } from 'child_process';
import { TerminalLogger } from './Utils/TerminalLogger';
import { CommonHelper } from './Utils/CommonHelper';

const JSON_FILE = './extracted_all_testcase.json';
const MAX_CONCURRENT = 2;

// Delay between launches -> to avoid missing video recordings
const STAGGER_DELAY = 3000;

TerminalLogger.initialize("full_runner");
console.log(`[🏃🏃🏃] >> Runner logs for system health starting...`);

async function runTests() {
    const rawData = FileHelper.readFile(JSON_FILE);
    const testCases = JSON.parse(rawData);
    const titles: string[] = testCases.map((tc: any) => tc.title);

    console.log(`[🏃🏃🏃] >> Found ${titles.length} tests. Running with max ${MAX_CONCURRENT} workers...`);

    const queue = [...titles];
    const activeWorkers = new Set();

    return new Promise((resolve) => {
        const next = async () => {
            if (queue.length === 0 && activeWorkers.size === 0) {
                return resolve(true);
            }

            // Check if we need to spawn more workers
            while (queue.length > 0 && activeWorkers.size < MAX_CONCURRENT) {
                const workerId = `Worker-${CommonHelper.generateUUID()}`;
                try {
                    const title = queue.shift();
                    const worker = spawn('npx', ['ts-node', './src/execution.ts', JSON_FILE, title!], {
                        shell: true,
                        stdio: 'inherit'
                    });
                    activeWorkers.add(worker);
                    console.log(`[${workerId}][🏃] >> 🚀 STARTED ${title}`);
    
                    worker.on('exit', (code) => {
                        activeWorkers.delete(worker);
                        console.log(`[${workerId}][🏃] >> 🏁 FINISHED ${title} with code ${code}`);
                        next(); 
                    });
    
                    if (queue.length > 0 && activeWorkers.size < MAX_CONCURRENT) {
                        console.log(`[${workerId}][🏃] >> ⏳ Staggering next worker launch (${STAGGER_DELAY}ms)...`);
                        await CommonHelper.sleep(STAGGER_DELAY);
                    }
                } catch (error) {
                    console.error(`[${workerId}][🏃] >> ❌ Worker Critical error:`, error);
                }

            }
        };

        next();
    });
}

runTests().then(() => console.log("[🏃🏃🏃] >> ✅ All tests completed."));