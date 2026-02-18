import { Inspector } from "./Agents/Inspector";
import { AGENT_NODES } from "./constants";
import { GraphInstance } from "./Services/GraphService/GraphInstance";
import { GEMINI_AUTO_AGENT_KEY, GEMINI_AUTO_AGENT_MODEL, PERSONA_DIR, RULES_DIR } from "./settings";
import { AgentState, InspectionResult, LLMVendor } from "./types";
import { FileHelper } from "./Utils/FileHelper";

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

    // Retrieve logs that start with 'full_' and ending with '.log'
    const allFiles = FileHelper.readDirectory('./');
    const logFiles = allFiles.filter(file => 
        file.startsWith('full_') && file.endsWith('.log')
    );

    console.log(`[${inspector.agentId}][🔍] >> Found ${logFiles.length} logs to inspect: ${logFiles.join(', ')}`);

    const allInspectionResults: InspectionResult[] = [];

    // Iterate through each log file and run inspection
    for (const logFile of logFiles) {
        console.log(`[${inspector.agentId}][🕵️] >> Inspecting: ${logFile}...`);
        try {
            const response = await inspectionWorkflow.execute(
                {
                    inspector_logFilePath: logFile,
                },
                `inspection_${logFile}_${Date.now()}`
            );

            const record = {
                logFileName: logFile,
                timestamp: new Date().toISOString(),
                ...response.inspector_inspectionResult
            };

            allInspectionResults.push(record);
            console.log(`[${inspector.agentId}][✅] >> Finished inspecting ${logFile}`);

        } catch (error) {
            console.error(`[${inspector.agentId}][❌] >> Failed to inspect ${logFile}:`, error);
        }
    }

    if (allInspectionResults.length > 0) {
        await inspector.writeInspectionToFile(allInspectionResults, 'log_inspections.json');
        console.log(`[${inspector.agentId}][💾] >> All inspections saved to log_inspections.json`);
    }
}

logInspection();