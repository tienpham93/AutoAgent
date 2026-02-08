import { RunnableConfig } from "@langchain/core/runnables";
import { AgentState } from "../../types";
import { GraphBuilder } from "./GraphBuilder";

export class GraphInstance {

    public workflowRunnable: any;
    public builder: GraphBuilder;

    constructor() {
        this.workflowRunnable = null;
        this.builder = new GraphBuilder();
    }

    public addNode(name: string, action: any) {
        this.builder.addNode(name, action);
    }

    public setEntryPoint(nodeName: any) {
        this.builder.setEntryPoint(nodeName);
    }

    public addEdge(fromNode: any, toNode: any) {
        this.builder.addEdge(fromNode, toNode);
    }

    public addConditionalEdge(fromNode: any, condition: (state: AgentState) => string, pathMap: Record<string, string>) {
        this.builder.addConditionalEdge(fromNode, condition, pathMap);
    }

    public buildWorkflow() {
        if (!this.builder) {
            throw new Error("[📈📈📈] >> ❌ GraphWorkflow: Builder not initialized");
        }
        this.workflowRunnable = this.builder.build();
    }

    public async execute(inputs: Partial<AgentState>, threadId: string = "agentId-xxxxxx"): Promise<AgentState> {
        const config: RunnableConfig = { configurable: { thread_id: threadId } };
        return await this.workflowRunnable.invoke(inputs, config);
    }
}