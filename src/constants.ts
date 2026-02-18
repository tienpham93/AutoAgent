

export enum AGENT_NODES {
    SETUP_PERSONA = "setup_persona",
    START = "start",
    END = "end",

    // Architect Nodes
    EXTRACTION = "extraction",

    // AutoAgent Nodes
    CODE_GENERATOR = "code_generator",
    CODE_EXECUTOR = "code_executor",
    CHAT = "chat",

    // Evaluator Nodes
    EVALUATION = "evaluation",
    POST_EVALUATION = "post_evaluation",

    // Auditor Nodes
    INSPECTION = "inspection",
    POST_INSPECTION = "post_inspection"
}