import path from 'path';
import * as dotenv from 'dotenv';

const rootDir = process.cwd();

// Load Gemini Configuration
dotenv.config({ path: path.resolve(rootDir, 'env/gemini.env') });
export const GEMINI_AUTO_AGENT_KEY = process.env.GEMINI_AUTO_AGENT_KEY;
export const GEMINI_AUTO_AGENT_MODEL = process.env.GEMINI_AUTO_AGENT_MODEL || "gemini-2.5-flash";
export const GEMINI_EVALUATOR_KEY = process.env.GEMINI_EVALUATOR_KEY;
export const GEMINI_EVALUATOR_MODEL = process.env.GEMINI_EVALUATOR_MODEL || "gemini-2.5-flash";
export const GEMINI_EXTRACTOR_KEY = process.env.GEMINI_EXTRACTOR_KEY;
export const GEMINI_EXTRACTOR_MODEL = process.env.GEMINI_EXTRACTOR_MODEL || "gemini-2.5-flash";

// Load Claude Configuration
dotenv.config({ path: path.resolve(rootDir, 'env/claude.env') });
export const CLAUDE_EXTRACTOR_KEY = process.env.CLAUDE_EXTRACTOR_KEY;
export const CLAUDE_EXTRACTOR_MODEL = process.env.CLAUDE_EXTRACTOR_MODEL || "claude-3-5-haiku-20241022";
export const CLAUDE_AUTO_AGENT_KEY = process.env.CLAUDE_AUTO_AGENT_KEY;
export const CLAUDE_AUTO_AGENT_MODEL = process.env.CLAUDE_AUTO_AGENT_MODEL || "claude-haiku-4-5-20251001";

// Declare Directories
export const TESTS_DIR = rootDir + '/src/__Tests__';
export const OUTPUT_DIR = rootDir + '/output';
export const REPORTS_DIR = rootDir + 'src/Report';
export const PERSONA_DIR = rootDir + '/src/Prompts/Agents/Persona';
export const RULES_DIR = rootDir + '/src/Prompts/Agents/Rules';
export const CONTEXTS_DIR = rootDir + '/src/Prompts/Pages/Contexts';
export const WORKFLOWS_DIR = rootDir + '/src/Prompts/Pages/Workflows';