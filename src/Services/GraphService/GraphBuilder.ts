import { StateGraph, START, END } from "@langchain/langgraph";
import { RunnableLike } from "@langchain/core/runnables";
import { AGENT_NODES } from "../../constants";
import { AgentState, AgentStateAnnotationSchema } from "../../types";

export class GraphBuilder {
    private graph: StateGraph<AgentState>;

    constructor() {
        this.graph = new StateGraph(AgentStateAnnotationSchema);
    }

    public addNode(name: string, action: RunnableLike<AgentState>): this {
        this.graph.addNode(name, action);
        return this;
    }

    public setEntryPoint(nodeName: any): this {
        this.graph.addEdge(START, nodeName);
        return this;
    }

    public addEdge(fromNode: any, toNode: any): this {
        this.graph.addEdge(fromNode, toNode);
        return this;
    }

    public addConditionalEdge(
        fromNode: any, 
        condition: (state: AgentState) => string, 
        pathMap: Record<string, string>
    ): this {
        // Map "END" string to the actual LangGraph END constant
        const safePathMap = { ...pathMap, [AGENT_NODES.END] : END } as Record<string, any>;
        this.graph.addConditionalEdges(fromNode, condition, safePathMap);
        return this;
    }

    // Sets the exit point of the graph
    public setExitPoint(nodeName: any): this {
        this.graph.addEdge(nodeName, END);
        return this;
    }

    // Resets the graph to an empty state
    public reset(): this {
        this.graph = new StateGraph(AgentStateAnnotationSchema);
        return this;
    }

    // Retry mechanism for a node
    public addRetryNode(
        nodeName: string, 
        maxRetries: number, 
        retryCondition: (state: AgentState) => boolean
    ): this {
        this.addConditionalEdge(
            nodeName,
            (state: AgentState) => {
                if (retryCondition(state) && (state.attempts || 0) < maxRetries) {
                    return nodeName; // Retry the same node
                }
                return AGENT_NODES.END; // Exit if max retries reached or condition not met
            },
            {
                [nodeName]: nodeName,
                [AGENT_NODES.END]: AGENT_NODES.END
            }
        );
        return this;
    }

    // Compiles the graph into a runnable workflow
    public build(): any {
        return this.graph.compile();
    }
}