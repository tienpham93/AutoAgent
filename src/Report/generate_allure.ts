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
const LOG_INSPECTION_PATH = path.join(PROJECT_ROOT, 'total_inspections.json');

function findAllVideos(folderPath: string): string[] {
    if (!fs.existsSync(folderPath)) return [];
    const files = fs.readdirSync(folderPath);
    return files.filter(f => f.endsWith('.webm')).sort((a, b) => {
        return fs.statSync(path.join(folderPath, a)).birthtimeMs - fs.statSync(path.join(folderPath, b)).birthtimeMs;
    });
}

function writeAttachment(content: string, ext: string): string {
    const uuid = crypto.randomUUID();
    const fileName = `${uuid}-attachment.${ext}`;
    fs.writeFileSync(path.join(ALLURE_RESULTS_DIR, fileName), content);
    return fileName;
}

function getAuditData(): any {
    if (!fs.existsSync(LOG_INSPECTION_PATH)) return null;
    try {
        return JSON.parse(fs.readFileSync(LOG_INSPECTION_PATH, 'utf-8'));
    } catch (e) { return null; }
}

function generateEnvironment(auditData: any = null) {
    let envContent = "";
    if (auditData) {
        const health = auditData.system_health?.system_health || {};
        const env = auditData.system_health?.environmental_factors || {};
        envContent += `System_Status=${health.status || 'Unknown'}\n`;
        envContent += `LLM_Service=${env.llm_service_health?.assessment || 'N/A'}\n`;
        envContent += `Network_Stability=${env.network_stability?.assessment || 'N/A'}\n`;
    }
    fs.writeFileSync(path.join(ALLURE_RESULTS_DIR, 'environment.properties'), envContent);
}

function preserveHistory() {
    const historySource = path.join(PREVIOUS_REPORT_DIR, 'history');
    const historyDest = path.join(ALLURE_RESULTS_DIR, 'history');
    if (fs.existsSync(historySource)) {
        if (!fs.existsSync(historyDest)) fs.mkdirSync(historyDest, { recursive: true });
        fs.readdirSync(historySource).forEach(file => {
            fs.copyFileSync(path.join(historySource, file), path.join(historyDest, file));
        });
    }
}

function generateAllureReport() {
    console.log("[📉📉📉] >> ⏭️ Converting Evaluations to Allure...");

    if (fs.existsSync(ALLURE_RESULTS_DIR)) fs.rmSync(ALLURE_RESULTS_DIR, { recursive: true, force: true });
    fs.mkdirSync(ALLURE_RESULTS_DIR, { recursive: true });

    preserveHistory();
    const auditData = getAuditData();
    const agentMatrix = auditData?.agent_performance_matrix || [];

    if (fs.existsSync(INPUT_FILE)) {
        const data: EvaluationRecord[] = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

        data.forEach((record) => {
            const testUuid = crypto.randomUUID();
            const start = Date.now();

            // 1. FIND AGENTS BASED ON NEW METADATA STRUCTURE
            const autoBot = agentMatrix.find((a: any) => 
                a.role === 'AutoBot' && a.metadata?.session_id === record.execution_id
            );

            const evaluator = agentMatrix.find((a: any) => 
                a.role === 'Evaluator' && a.metadata?.execution_id_referenced?.includes(record.execution_id)
            );

            const architect = agentMatrix.find((a: any) => a.role === 'Architect');

            let descHtml = `<h2>🧠 AI Agent Audit</h2>`;

            // 🤖 AUTOBOT SECTION
            if (autoBot) {
                const fatalErrors = autoBot.metadata.fatal_errors || [];
                descHtml += `
                <div style="padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 10px;">
                    <h3 style="margin-top:0;">🤖 AutoBot (Execution)</h3>
                    <b>Summary:</b> ${autoBot.metadata.overall_summary}<br/>
                    <b>Success Rate:</b> ${autoBot.metadata.execution_success_rate}<br/>
                    <b>Self-Healing:</b> ${autoBot.metadata.self_healing_attempts} times<br/>
                    <b>Video:</b> ${autoBot.metadata.video_status === 'Saved' ? '✅ Saved' : '❌ Failed'}<br/>
                    ${fatalErrors.length > 0 ? `<p style="color:red;"><b>Fatal Errors:</b> ${fatalErrors.join(', ')}</p>` : ''}
                    <p><i>${autoBot.behavioral_summary}</i></p>
                </div>`;
            }

            // 🕵️ EVALUATOR SECTION
            if (evaluator) {
                descHtml += `
                <div style="padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 10px;">
                    <h3 style="margin-top:0;">🕵️ Evaluator (Visual Analysis)</h3>
                    <b>Summary:</b> ${evaluator.metadata.overall_summary}<br/>
                    <b>Analysis Result:</b> ${record.final_result.toUpperCase()}<br/>
                    <b>Accuracy:</b> ${evaluator.metadata.evaluation_success_rate}<br/>
                    <p><i>${evaluator.behavioral_summary}</i></p>
                </div>`;
            }

            // 🏗️ ARCHITECT SECTION
            if (architect) {
                descHtml += `
                <div style="padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <h3 style="margin-top:0;">🏗️ Architect (Instruction Parsing)</h3>
                    <b>Files:</b> ${architect.metadata.files_processed?.join(', ')}<br/>
                    <b>Success:</b> ${architect.metadata.extraction_success_rate}<br/>
                    <p><i>${architect.metadata.overall_summary}</i></p>
                </div>`;
            }

            const attachments: any[] = [];
            const sourceFolder = path.join(TEST_OUTPUT_DIR, `${record.test_details.test_name}_${record.execution_id}`);
            const videoFiles = findAllVideos(sourceFolder);
            videoFiles.forEach((videoFileName, index) => {
                const sourceVideoPath = path.join(sourceFolder, videoFileName);
                const attachmentUuid = crypto.randomUUID();
                const newVideoName = `${attachmentUuid}-attachment.webm`;
                try {
                    fs.copyFileSync(sourceVideoPath, path.join(ALLURE_RESULTS_DIR, newVideoName));
                    attachments.push({ name: videoFileName, source: newVideoName, type: "video/webm" });
                } catch(e) {}
            });

            const allureResult = {
                uuid: testUuid,
                historyId: record.test_details.test_name,
                fullName: record.test_details.test_name,
                name: `${record.test_details.test_name} [${record.execution_id}]`,
                status: record.final_result.toLowerCase() === 'pass' ? 'passed' : 'failed',
                start: start,
                stop: start + 5000,
                description: `Verdict: ${record.final_judgement}`,
                descriptionHtml: `
                    <div style="background-color: ${record.final_result === 'pass' ? '#e6fffa' : '#fff5f5'}; padding: 15px; border-radius: 5px; border-left: 5px solid ${record.final_result === 'pass' ? '#38b2ac' : '#e53e3e'};">
                        <b>Final Verdict:</b> ${record.final_judgement}
                    </div>
                    <br/>
                    ${descHtml}
                `,
                labels: [
                    { name: "feature", value: "AI-Powered Test Suite" },
                    { name: "suite", value: record.test_details.test_name },
                    { name: "tag", value: record.final_result }
                ],
                attachments: attachments,
                steps: record.test_details.steps.map(step => {
                    const txtName = writeAttachment(`ACTION: ${step.action}\n\nVISUAL OBSERVATION: ${step.visual_observation}`, 'txt');
                    return {
                        name: `Step ${step.step_number}: ${step.action}`,
                        status: step.step_result.toUpperCase() === 'PASSED' ? 'passed' : 'failed',
                        start: start, stop: start,
                        attachments: [{ name: "Visual Analysis Log", source: txtName, type: "text/plain" }]
                    };
                })
            };
            fs.writeFileSync(path.join(ALLURE_RESULTS_DIR, `${testUuid}-result.json`), JSON.stringify(allureResult, null, 2));
        });
    }

    generateEnvironment(auditData);
    console.log(`[📉📉📉] >> ✅ Allure Results Generated Successfully.`);
}

generateAllureReport();