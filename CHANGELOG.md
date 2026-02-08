Here is the brief and concise changelog for your update.

## [1.0.1] - 2025-01-28

### ♻️ Refactor: Architecture Decoupling
*   **Separation of Concerns:** Decoupled **Graph Topology** (Workflow) from **Agent Capabilities** (Logic). Agents now provide tools, while the Graph defines the flow.
*   **GraphManager:** Centralized all LangGraph wiring, edge definitions, and conditional logic into `GraphManager.ts`.
*   **Agent Classes:**
    *   `BaseAgent`: Removed internal graph initialization (`initGraphFlow`) and abstract `extendGraph` method.
    *   `AutoBot`: Converted internal node closures into public, stateless methods (`generateCodeNode`, `executeCodeNode`).
*   **Execution:** Updated `execution.ts` to explicitly build workflows via `GraphManager` before invocation, improving visibility and debuggability.