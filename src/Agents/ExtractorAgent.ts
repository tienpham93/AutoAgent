import { BaseAgent } from "./BaseAgent";

export class ExtractorAgent extends BaseAgent {
    constructor(apiKey: string, model: string) {
        super(
            apiKey, 
            model,
            `You are a Test Data Extractor.
            Input: Raw Markdown content of a test case.
            Output: A VALID JSON object with this exact structure:
            {
                "title": "string",
                "goal": "string",
                "steps": ["step 1 string", "step 2 string"],
                "expectedResults": ["result 1 string"],
                "notes": "string (any extra context/selectors)"
            }
            - Do not include markdown formatting (like **bold**).
            - Extract 'steps' as a clean list of instructions.
            - Extract 'notes' to help the automation agent (e.g. selectors).`
        );
    }

    async parse(rawMarkdown: string): Promise<any> {
        const result = await this.sendToLLM(rawMarkdown);
        // Clean up code blocks if Gemini adds them
        const cleanJson = result.replace(/```json/g, "").replace(/```/g, "").trim();
        return await JSON.parse(cleanJson);
    }
}