import { Inspector } from "./Agents/Inspector";
import { GEMINI_AUTO_AGENT_KEY, GEMINI_AUTO_AGENT_MODEL, PERSONA_DIR, RULES_DIR } from "./settings";
import { LLMVendor } from "./types";

async function logInspection() {

    // Init Agent
    const inspector = new Inspector({
        vendor: LLMVendor.GEMINI,
        apiKey: GEMINI_AUTO_AGENT_KEY as any,
        model: GEMINI_AUTO_AGENT_MODEL,
        personaTemplatePath: `${PERSONA_DIR}/inspector_persona.njk`,
        additionalContexts: [`${RULES_DIR}/analyze_log_rules.njk`],
    });

    console.log(`[${inspector.agentId}][🔍] >> Starting log inspection...`);
    try {
        const response = await inspector.execute(
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