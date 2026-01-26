// ... imports

import { AIMessage } from "@langchain/core/messages";
import { Evaluator } from "./Agents/Evaluator";
import { GEMINI_EVALUATOR_KEY, GEMINI_EVALUATOR_MODEL, OUTPUT_DIR, PERSONA_DIR, RULES_DIR } from "./settings";
import { LLMVendor } from "./types";
import { CommonHelper } from "./Utils/CommonHelper";
import { Logzer } from "./Utils/Logger";

async function evaluation() {
    // INIT AGENT
    const evaluator = new Evaluator({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_EVALUATOR_KEY as any,
        model: GEMINI_EVALUATOR_MODEL, 
        personaTemplatePath: `${PERSONA_DIR}/evaluator_persona.njk`,
        additionalContexts: [
            `${RULES_DIR}/evaluate_rules.njk`,
            `${RULES_DIR}/extract_test_eval_results.njk`,
        ]
    });

    // TO GET TEST RUNS RESULTS FROM OUTPUT DIR
    const testRuns = evaluator.getTestRuns(OUTPUT_DIR);
    console.log(`[🕵️🕵️🕵️] >> 📂 Found ${testRuns.length} test runs to evaluate.`);

    for (const run of testRuns) {
        try {
            console.log(`[🕵️🕵️🕵️] >> 🎯 Evaluating test run: ${run.folderName}`);
            const thread_id = `execution_${CommonHelper.generateUUID()}`;

            const response = await evaluator.execute(
                {
                    evaluator_videoPaths: run.videoPaths,
                    evaluator_jsonPath: run.jsonPath,
                },
                thread_id
            );

            const finalRecord = {
                timestamp: new Date().toISOString(),
                test_run_id: run.folderName,
                ...response.evaluator_evaluationResult
            };

            evaluator.appendEvaluationResult(finalRecord, 'evaluations.json');
        } catch (error) {
            console.error(`[🕵️🕵️🕵️] >> ❌ Failed to evaluate ${run.folderName}`);
        }
    }
}

evaluation();