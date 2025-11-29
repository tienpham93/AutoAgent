

export type GeminiClient = {
    apiKey: string;
    model: string;
    persona: string;
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


export type AgentOptions = {
    persona?: string;
    workflow?: string[];
    keynotes?: string;
};