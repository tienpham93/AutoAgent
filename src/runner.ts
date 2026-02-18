import { FileHelper } from './Utils/FileHelper';
import { spawn } from 'child_process';

const JSON_FILE = './extracted_all_testcase.json';
const MAX_CONCURRENT = 2;

async function runTests() {
    const rawData = FileHelper.readFile(JSON_FILE);
    const testCases = JSON.parse(rawData);
    const titles: string[] = testCases.map((tc: any) => tc.title);

    console.log(`🧵 Found ${titles.length} tests. Running with ${MAX_CONCURRENT} workers...`);

    const queue = [...titles];
    const activeWorkers = new Set();

    return new Promise((resolve) => {
        const next = () => {
            // If queue is empty and no workers are running, we are done
            if (queue.length === 0 && activeWorkers.size === 0) {
                return resolve(true);
            }

            // Spawn workers up to the limit
            while (queue.length > 0 && activeWorkers.size < MAX_CONCURRENT) {
                const title = queue.shift();
                const worker = spawn('npx', ['ts-node', './src/execution.ts', JSON_FILE, title!], {
                    shell: true,
                    stdio: 'inherit' // This shows the logs in your main terminal
                });

                activeWorkers.add(worker);
                console.log(`[🏃🏃🏃] >> STARTED ${title}`);

                worker.on('exit', (code) => {
                    activeWorkers.delete(worker);
                    console.log(`[🏁🏁🏁] >> FINISHED ${title} with code ${code}`);
                    next(); 
                });
            }
        };

        next();
    });
}

runTests().then(() => console.log("✅ All tests completed."));