

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
    persona: string;
    initialContexts?: string[];
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