import { BaseAgent } from "./BaseAgent";



export class TranslatorAgent extends BaseAgent {
    constructor(apiKey: string, model: string) {
        super(
            apiKey, 
            model, 
            `You are a Localization Expert.
            Input: Source Text + Target Language.
            Output: ONLY the translated string. No explanations.
            Keep formatting and variables (like {name}) intact.`
        );
    }

    async localize(text: string, targetLang: string): Promise<string> {
        const prompt = `Translate this to ${targetLang}: "${text}"`;
        const result = await this.sendToLLM(prompt);
        return result.trim();
    }
}
