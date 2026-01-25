// import { InspectorAgent } from "./Agents/InspectorAgent";
// import { GEMINI_AUTO_AGENT_KEY, GEMINI_AUTO_AGENT_MODEL, PERSONA_DIR, RULES_DIR } from "./settings";
// import { LLMVendor } from "./types";
// import { FileHelper } from "./Utils/FileHelper";
// import { Logzer } from "./Utils/Logger";


// async function logAudit() {

//     // Init Agent to inspect logs
//     const inspector = new InspectorAgent({
//         vendor: LLMVendor.GEMINI,
//         apiKey: GEMINI_AUTO_AGENT_KEY as any,
//         model: GEMINI_AUTO_AGENT_MODEL,
//         personaTemplatePath: `${PERSONA_DIR}/extractor_persona.njk`,
//         additionalContexts: [`${RULES_DIR}/extract_test_case_rules.njk`],
//     });

//     console.log("[🕵️🕵️🕵️] >> Inspector is analyzing the execution.log...");
//     const report = await inspector.inspectLogFile(Logzer.logFilePath);
    
//     // Save the final technical report
//     FileHelper.writeFile('output/', 'technical_audit.md', report);
//     console.log("✅ Technical Audit Report generated in output/technical_audit.md");
// }

// logAudit();