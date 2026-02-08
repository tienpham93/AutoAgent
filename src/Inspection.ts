import { Inspector } from "./Agents/Inspector";
import { AGENT_NODES } from "./constants";
import { GraphInstance } from "./Services/GraphService/GraphInstance";
import { GEMINI_AUTO_AGENT_KEY, GEMINI_AUTO_AGENT_MODEL, PERSONA_DIR, RULES_DIR } from "./settings";
import { AgentState, LLMVendor } from "./types";

const buildInspectionWorkflow = (inspector: Inspector) => {
    const graph = new GraphInstance();

    // NODE REGISTER
    graph.addNode(AGENT_NODES.SETUP_PERSONA, (state: AgentState) => inspector.getSystemNode(state));
    graph.addNode(AGENT_NODES.INSPECTION, (state: AgentState) => inspector.InspectionNode(state));
    graph.addNode(AGENT_NODES.POST_INSPECTION, (state: AgentState) => inspector.postInspectionNode(state));

    // WORKFLOW: SETUP_PERSONA -> INSPECTION -> POST_INSPECTION
    graph.setEntryPoint(AGENT_NODES.SETUP_PERSONA);
    graph.addEdge(AGENT_NODES.SETUP_PERSONA, AGENT_NODES.INSPECTION);
    graph.addEdge(AGENT_NODES.INSPECTION, AGENT_NODES.POST_INSPECTION);

    graph.buildWorkflow();
    return graph;
}

async function logInspection() {

    // Init Agent
    const inspector = new Inspector({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_AUTO_AGENT_KEY as any,
        model: GEMINI_AUTO_AGENT_MODEL,
        personaTemplatePath: `${PERSONA_DIR}/inspector_persona.njk`,
        additionalContexts: [`${RULES_DIR}/analyze_log_rules.njk`],
    });

    const inspectionWorkflow = buildInspectionWorkflow(inspector);

    console.log(`[${inspector.agentId}][🔍] >> Starting log inspection...`);
    try {
        const response = await inspectionWorkflow.execute(
            {
                inspector_logFilePath: `full_execution.log`,
            },
            `inspection_${Date.now()}`
        );

        const finalRecord = {
            timestamp: new Date().toISOString(),
            ...response.inspector_inspectionResult
        };

        await inspector.writeInspectionToFile(finalRecord, 'log_inspections.json');

    } catch (error) {
        console.error(`[${inspector.agentId}][🕵️] >> ❌ Log inspection failed:`, error);
    }

}

logInspection();