import { Evaluator } from "./Agents/Evaluator";
import { AGENT_NODES } from "./constants";
import { GraphInstance } from "./Services/GraphService/GraphInstance";
import { GEMINI_EVALUATOR_KEY, GEMINI_EVALUATOR_MODEL, OUTPUT_DIR, PERSONA_DIR, RULES_DIR } from "./settings";
import { AgentState, LLMVendor } from "./types";
import { CommonHelper } from "./Utils/CommonHelper";

const buildEvaluationWorkflow = (evaluator: Evaluator) => {
    const graph = new GraphInstance();

    // NODE REGISTER
    graph.addNode(AGENT_NODES.SETUP_PERSONA, (state: AgentState) => evaluator.getSystemNode(state));
    graph.addNode(AGENT_NODES.EVALUATION, (state: AgentState) => evaluator.evaluationNode(state));
    graph.addNode(AGENT_NODES.POST_EVALUATION, (state: AgentState) => evaluator.postEvaluationNode(state));

    // WORKFLOW: SETUP_PERSONA -> EVALUATION -> POST_EVALUATION
    graph.setEntryPoint(AGENT_NODES.SETUP_PERSONA);
    graph.addEdge(AGENT_NODES.SETUP_PERSONA, AGENT_NODES.EVALUATION);
    graph.addEdge(AGENT_NODES.EVALUATION, AGENT_NODES.POST_EVALUATION);

    // LOGICS: EVALUATION -> (Success ? POST_EVALUATION : retry EVALUATION)
    graph.addConditionalEdge(
        AGENT_NODES.EVALUATION,
        (state: AgentState) => {
            console.log(`[${evaluator.agentId}][🕵️] >> 🔄 Evaluation attempt: ${state.attempts}`);
            console.log(`[${evaluator.agentId}][🕵️] >> ❔ Evaluation success: ${state.success}`);

            if (state.success) {
                return AGENT_NODES.POST_EVALUATION;
            }

            // Retry up to 3 attempts
            if (state.attempts >= 3) {
                console.log(`[${evaluator.agentId}][🕵️] >> ⚠️ Max attempts reached. Ending evaluation.`);
                return AGENT_NODES.END;
            }
            return AGENT_NODES.EVALUATION;
        },
        {
            [AGENT_NODES.POST_EVALUATION]: AGENT_NODES.POST_EVALUATION,
            [AGENT_NODES.EVALUATION]: AGENT_NODES.EVALUATION,
            [AGENT_NODES.END]: AGENT_NODES.END
        }
    );

    graph.buildWorkflow();
    return graph;
}

async function evaluation() {
    // INIT AGENT
    const evaluator = new Evaluator({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_EVALUATOR_KEY as any,
        model: GEMINI_EVALUATOR_MODEL,
        personaTemplatePath: `${PERSONA_DIR}/evaluator_persona.njk`,
        additionalContexts: [
            `${RULES_DIR}/evaluation_rules.njk`,
            `${RULES_DIR}/extract_test_evaluated_results.njk`,
        ]
    });

    const evaluationWorkflow = buildEvaluationWorkflow(evaluator);

    // TO GET TEST RUNS RESULTS FROM OUTPUT DIR
    const testRuns = evaluator.getTestRuns(OUTPUT_DIR);
    console.log(`[${evaluator.agentId}][🕵️] >> 📂 Found ${testRuns.length} test runs to evaluate.`);

    for (const run of testRuns) {
        try {
            console.log(`[${evaluator.agentId}][🕵️] >> 🎯 Evaluating test run: ${run.folderName}`);
            const thread_id = `execution_${CommonHelper.generateUUID()}`;

            const response = await evaluationWorkflow.execute(
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
            console.error(`[${evaluator.agentId}][🕵️] >> ❌ Failed to evaluate ${run.folderName}`);
        }
    }
}

evaluation();