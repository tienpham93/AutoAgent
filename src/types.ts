import { MessagesAnnotation, CompiledStateGraph, StateDefinition, AnnotationRoot, LastValue } from "@langchain/langgraph";


export type GeminiClient = {
    apiKey: string;
    model: string;
    persona: string;
    intialContexts?: string[];
};

export type TestCase = {
    title: string;
    goal: string;
    steps: Steps[];
};

type Steps = {
    action: string;
    expectedResults: string[];
    notes: string[]
}

export interface AgentConfig {
    vendor?: LLMVendor;
    apiKey: string;
    model: string;
    personaTemplatePath: string;
    additionalContexts?: string[];
}

export enum LLMVendor {
    GEMINI = 'gemini',
    CLAUDE = 'claude',
    OPENAI = 'openai'
}

export type AgentOptions = {
    persona?: string;
    workflow?: string[];
    keynotes?: string;
};

export interface TestRunData {
    folderName: string;
    jsonPath: string;
    videoPaths: string[];
}

export interface EvaluationResult {
    test_details: {
        test_name: string;
        test_goal: string;
        steps: Array<{
            step_number: number;
            action: string;
            expectedResults: string[];
            notes: string[];
            visual_observation: string;
            step_result: "PASSED" | "FAILED";
        }>;
    };
    final_judgement: string;
    final_result: "pass" | "fail";
}

export interface Step {
    step_number: number;
    action: string;
    expectedResults: string[];
    notes: string[];
    visual_observation: string;
    step_result: "PASSED" | "FAILED";
}

export interface EvaluationRecord {
    timestamp: string;
    test_run_id: string;
    test_details: { 
        test_name: string; 
        test_goal: string; 
        steps: Step[] 
    };
    final_judgement: string;
    final_result: "pass" | "fail";
}

export interface UploadedFileCtx {
    name: string;
    uri: string;
    mimeType: string;
}

export type AgentState = typeof MessagesAnnotation.State;
export type AgentUpdate = typeof MessagesAnnotation.Update;

export type AgentFlow = CompiledStateGraph<
    AgentState,         // S: The full State
    AgentUpdate,        // U: The Update type (what nodes return)
    string,             // N: The Node names (union of strings)
    StateDefinition,    // I: The Input type
    StateDefinition,    // O: The Output type
    StateDefinition     // C: The Config type (handles thread_id)
>;

export type AutomationState = AnnotationRoot<{
    messages: any;
    step: LastValue<string>;
    notes: LastValue<string[]>;
    snapshot: LastValue<string>;
    error: LastValue<string | null>;
    success: LastValue<boolean>;
    attempts: LastValue<number>;
    threadId: LastValue<string>;
}>;