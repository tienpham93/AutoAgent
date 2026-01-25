import { Annotation, AnnotationRoot, LastValue, MessagesAnnotation } from "@langchain/langgraph";

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

export const AgentStateAnnotationSchema = Annotation.Root({
    // Common annotations
    ...MessagesAnnotation.spec,
    step: Annotation<string>(),
    notes: Annotation<string[]>(),
    error: Annotation<string | null>(),
    success: Annotation<boolean>(),
    attempts: Annotation<number>(),
    threadId: Annotation<string>(),

    // AutoAgent specific annotations
    extractor_rawTestCase: Annotation<string>(),
    extractor_extractedTestcases: Annotation<TestCase[]>(),

    autoAgent_domTree: Annotation<string>(),
    autoAgent_screenshot: Annotation<string>(),

    evaluator_videoPaths: Annotation<string[]>(),
    evaluator_jsonPath: Annotation<string>(),
    evaluator_evaluationResult: Annotation<EvaluationResult>(),
});

export type AgentState = typeof AgentStateAnnotationSchema.State;