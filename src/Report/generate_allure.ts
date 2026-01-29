import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EvaluationRecord } from '../types';
import { OUTPUT_DIR } from '../settings';

const PROJECT_ROOT = process.cwd();
const INPUT_FILE = path.join(PROJECT_ROOT, 'evaluations.json');
const ALLURE_RESULTS_DIR = path.join(PROJECT_ROOT, 'allure-results');

const PREVIOUS_REPORT_DIR = path.join(PROJECT_ROOT, 'allure-report'); 
const TEST_OUTPUT_DIR = OUTPUT_DIR;
const LOG_INSPECTION_PATH = path.join(PROJECT_ROOT, 'log_inspections.json');

function findAllVideos(folderPath: string): string[] {
    if (!fs.existsSync(folderPath)) return [];
    const files = fs.readdirSync(folderPath);
    const videos = files.filter(f => f.endsWith('.webm'));
    if (videos.length === 0) return [];
    videos.sort((a, b) => {
        const timeA = fs.statSync(path.join(folderPath, a)).birthtimeMs;
        const timeB = fs.statSync(path.join(folderPath, b)).birthtimeMs;
        return timeA - timeB;
    });
    return videos;
}

function writeAttachment(content: string, ext: string): string {
    const uuid = crypto.randomUUID();
    const fileName = `${uuid}-attachment.${ext}`;
    fs.writeFileSync(path.join(ALLURE_RESULTS_DIR, fileName), content);
    return fileName;
}

function generateCategories() {
    const categories = [
        { name: "AI & System Anomalies", matchedStatuses: ["failed", "broken"], messageRegex: ".*" }
    ];
    fs.writeFileSync(path.join(ALLURE_RESULTS_DIR, 'categories.json'), JSON.stringify(categories, null, 2));
}

function getAuditData(): any {
    if (!fs.existsSync(LOG_INSPECTION_PATH)) return null;
    try {
        return JSON.parse(fs.readFileSync(LOG_INSPECTION_PATH, 'utf-8'));
    } catch (e) {
        return null;
    }
}

function generateEnvironment(auditData: any = null) {
    let envContent = "";
    if (auditData) {
        envContent += `System_Status=${auditData.system_health?.status || 'Unknown'}\n`;
        envContent += `Network=${auditData.environmental_factors?.network_stability?.assessment?.replace(/\n/g, ' ') || 'N/A'}\n`;
    }
    fs.writeFileSync(path.join(ALLURE_RESULTS_DIR, 'environment.properties'), envContent);
}

/**
 * 2️⃣ HISTORY PRESERVATION FUNCTION
 * Copies 'history' from the old report to the new results
 */
function preserveHistory() {
    const historySource = path.join(PREVIOUS_REPORT_DIR, 'history');
    const historyDest = path.join(ALLURE_RESULTS_DIR, 'history');

    if (fs.existsSync(historySource)) {
        console.log("[⏳⏳⏳] >> 📜 Found previous history. Copying to new results...");
        
        if (!fs.existsSync(historyDest)) {
            fs.mkdirSync(historyDest, { recursive: true });
        }

        const files = fs.readdirSync(historySource);
        files.forEach(file => {
            const srcFile = path.join(historySource, file);
            const destFile = path.join(historyDest, file);
            fs.copyFileSync(srcFile, destFile);
        });
        console.log(`[⏳⏳⏳] >> ✅ Restored ${files.length} history files (Trend graph will update).`);
    } else {
        console.log("[⏳⏳⏳] >> ℹ️ No previous history found (First run or report cleaned).");
    }
}

function generateAllureReport() {
    console.log("[📉📉📉] >> ⏭️ Converting Evaluations to Allure...");

    if (fs.existsSync(ALLURE_RESULTS_DIR)) {
        fs.rmSync(ALLURE_RESULTS_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(ALLURE_RESULTS_DIR, { recursive: true });

    preserveHistory();

    const auditData = getAuditData();
    const agentMatrix = auditData?.agent_performance_matrix || [];

    if (fs.existsSync(INPUT_FILE)) {
        const data: EvaluationRecord[] = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
        
        data.forEach((record) => {
            const testUuid = crypto.randomUUID();
            const start = Date.now();
            
            const executorAgent = agentMatrix.find((a: any) => 
                a.test_run_ids && a.test_run_ids.includes(record.test_run_id)
            );

            let supportAgents: any[] = [];
            if (executorAgent && executorAgent.assigned_file) {
                supportAgents = agentMatrix.filter((a: any) => 
                    a.assigned_file === executorAgent.assigned_file && 
                    a.agent_id !== executorAgent.agent_id
                );
            }

            let descHtml = "";

            if (executorAgent) {
                const healed = executorAgent.metrics?.self_healing_trigger_count || 0;
                descHtml += `
                <h3>🤖 AutoBot Agent</h3>
                <ul>
                    <li><b>Agent ID:</b> ${executorAgent.agent_id}</li>
                    <li><b>File:</b> ${executorAgent.assigned_file}</li>
                    <li><b>Stability:</b> ${healed === 0 ? "🟢 Stable" : `🟠 Unstable (Triggered Self-Healing <b>${healed}</b> times)`}</li>
                    <li><b>Root Cause:</b> <i>${executorAgent.root_cause_analysis}</i></li>
                </ul>`;
            }

            if (supportAgents.length > 0) {
                descHtml += `<h3>🚁 Extractor Agents</h3><ul>`;
                supportAgents.forEach(support => {
                    descHtml += `<li><b>Agent ID:</b> ${support.agent_id}<br/><b>Result:</b> ${support.root_cause_analysis}</li>`;
                });
                descHtml += `</ul>`;
            }

            const attachments: any[] = [];
            const sourceFolder = path.join(TEST_OUTPUT_DIR, record.test_run_id);
            const videoFiles = findAllVideos(sourceFolder);
            videoFiles.forEach((videoFileName, index) => {
                const sourceVideoPath = path.join(sourceFolder, videoFileName);
                const attachmentUuid = crypto.randomUUID();
                const newVideoName = `${attachmentUuid}-attachment.webm`;
                try {
                    fs.copyFileSync(sourceVideoPath, path.join(ALLURE_RESULTS_DIR, newVideoName));
                    attachments.push({ name: `Recording Part ${index + 1}`, source: newVideoName, type: "video/webm" });
                } catch(e) {}
            });

            const allureResult = {
                uuid: testUuid,
                historyId: record.test_run_id, // CRITICAL: This must remain constant for Trend to work
                fullName: record.test_details.test_name || record.test_run_id,
                name: `[${record.execution_id}] - [${record.test_details.test_name}]`,
                status: record.final_result.toLowerCase() === 'pass' ? 'passed' : 'failed',
                start: start,
                stop: start + 1000,
                description: `**Goal:** ${record.test_details.test_goal}\n\n**AI Verdict:** ${record.final_judgement}`,
                descriptionHtml: `
                    <b>Goal:</b> ${record.test_details.test_goal}<br/>
                    <b>AI Verdict:</b> ${record.final_judgement}
                    <hr/>
                    ${descHtml}
                `,
                labels: [
                    { name: "feature", value: "Test Executions" }, 
                    { name: "suite", value: "Test Executions" },   
                    { name: "story", value: record.test_run_id }
                ],
                attachments: attachments,
                steps: record.test_details.steps.map(step => {
                    const txtName = writeAttachment(`EXPECTED: ${step.expectedResults}\nVISUAL: ${step.visual_observation}`, 'txt');
                    return {
                        name: `Step ${step.step_number}: ${step.action}`,
                        status: step.step_result.toUpperCase() === 'PASSED' ? 'passed' : 'failed',
                        start: start, stop: start,
                        attachments: [{ name: "AI Analysis", source: txtName, type: "text/plain" }]
                    };
                })
            };
            fs.writeFileSync(path.join(ALLURE_RESULTS_DIR, `${testUuid}-result.json`), JSON.stringify(allureResult, null, 2));
        });
    }

    generateEnvironment(auditData);
    generateCategories();
    
    console.log(`[📉📉📉] >> ✅ Report Generation Complete.`);
}

generateAllureReport();