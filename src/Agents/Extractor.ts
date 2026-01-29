import { AGENT_NODES } from "../constants";
import { GraphBuilder } from "../Services/GraphService/GraphBuilder";
import { AgentConfig } from "../types";
import { CommonHelper } from "../Utils/CommonHelper";
import { BaseAgent } from "./BaseAgent";

export class Extractor extends BaseAgent {

    constructor(config: AgentConfig) {
        super(config);
        this.agentId = `Extractor_${CommonHelper.generateUUID()}`;
    }

    protected extendGraph(builder: GraphBuilder): void {
        /**
         * 🟢 Define Nodes
        */
        const ExtractionNode = async (state: any) => {
            const userMessage = await this.buildMessageContent(
                [
                    {
                        type: "text",
                        text: state.extractor_rawTestCase
                    },
                ]
            );

            const messagesForLLM = [...state.messages, userMessage];


            const response = await this.sendToLLM({ ...state, messages: messagesForLLM });
            const contentString = response.content.toString();

            // Clean up code blocks
            const cleanJson = contentString.replace(/```json/g, "").replace(/```/g, "").trim();
            
            let parsedResult;
            try {
                parsedResult = JSON.parse(cleanJson);
            } catch (e) {
                console.error(`[${this.agentId}][🚁] >> JSON Parse Error:`, cleanJson);
                throw e;
            }

            return {
                ...state,
                extractor_extractedTestcases: parsedResult
            };
        };

        /**
         * ✏️ Draw Testcase Extraction Flow
        */
        // REGISTER
        builder.addNode(AGENT_NODES.EXTRACTION, ExtractionNode);

        // WORKFLOW: SETUP_PERSONA -> EXTRACTION
        builder.addEdge(AGENT_NODES.SETUP_PERSONA, AGENT_NODES.EXTRACTION);
    }
}