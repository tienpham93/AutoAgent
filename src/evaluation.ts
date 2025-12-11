// ... imports

import { EvaluatorAgent } from "./Agents/EvaluatorAgent";
import { GEMINI_EVALUATOR_KEY, GEMINI_EVALUATOR_MODEL, OUTPUT_DIR, PERSONA_DIR } from "./settings";
import { LLMVendor } from "./types";
import { FileHelper } from "./Utils/FileHelper";

async function evaluation() {
    // INIT AGENT
    const evaluator = new EvaluatorAgent({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_EVALUATOR_KEY as any,
        model: GEMINI_EVALUATOR_MODEL, 
        persona: FileHelper.readTextFile(`${PERSONA_DIR}/evaluator_persona.txt`),
    });

    // TO GET TEST RUNS RESULTS FROM OUTPUT DIR
    const testRuns = evaluator.getTestRuns(OUTPUT_DIR);
    console.log(`[📂] Found ${testRuns.length} test runs to evaluate.`);

    for (const run of testRuns) {
        try {
            const evaluationResponse = await evaluator.evaluateRun(run.videoPaths, run.jsonPath);

            const finalRecord = {
                timestamp: new Date().toISOString(),
                test_run_id: run.folderName,
                ...evaluationResponse
            };

            evaluator.appendEvaluationResult(finalRecord, 'evaluations.json');
        } catch (error) {
            console.error(`[❌] Failed to evaluate ${run.folderName}`);
        }
    }
}

evaluation();