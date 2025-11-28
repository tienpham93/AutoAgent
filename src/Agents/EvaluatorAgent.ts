import { BaseAgent } from "./BaseAgent";

export class EvaluatorAgent extends BaseAgent {
    constructor(apiKey: string, model: string) {
        super(
            apiKey, 
            model, 
            `You are a QA Evaluator.
            Compare Execution Logs vs Expected Results.
            Output JSON: { "verdict": "PASS" | "FAIL", "reason": "string", "confidence": number }`
        );
    }

    async evaluateRun(goal: string, expected: string[], logs: string[]): Promise<any> {
        const prompt = `GOAL: ${goal}\nEXPECTED: ${JSON.stringify(expected)}\nLOGS: ${JSON.stringify(logs)}`;
        const result = await this.sendToLLM(prompt);
        try {
            return JSON.parse(result.replace(/```json/g, "").replace(/```/g, "").trim());
        } catch (e) { return { verdict: "ERROR", reason: "JSON Parse Error" }; }
    }
}