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

export interface InspectionResult {
    system_health: {
        status: "HEALTHY" | "DEGRADED" | "CRITICAL";
        total_workers_started: number;
        total_workers_finished: number;
        fatal_crashes_count: number;
        critical_logs: string[];
    };
    environmental_factors: {
        network_stability: {
            timeout_events: number;
            assessment: string;
        };
        llm_service_health: {
            parsing_failures: number;
            quota_warnings: number;
            assessment: string;
        };
        system_overhead: {
            throttle_events_count: number;
            estimated_idle_time_ms: number;
        };
    };
    agent_performance_matrix: Array<{
        agent_id: string;
        role: "AutoBot" | "Extractor";
        assigned_file: string;
        metrics: {
            steps_attempted: number;
            self_healing_trigger_count: number;
            did_recover: boolean;
        };
        root_cause_analysis: string;
    }>;
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
    execution_id: string;
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

    inspector_logFilePath: Annotation<string>(),
    inspector_inspectionResult: Annotation<InspectionResult>(),
});

export type AgentState = typeof AgentStateAnnotationSchema.State;