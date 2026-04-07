# Changelog

## [1.2.0] - 2026-04-07

### 🚀 Major Upgrade: Migrated to BunJS
*   **Performance:** Replaced `ts-node` and `yarn` entirely with `bun`. All test orchestration, scripts, and runtime operations now run natively on the Bun javascript runtime, gaining significant startup and compilation improvements.
*   **Dependency Management:** Cleaned up `yarn.lock` in favor of `bun.lockb` for faster package resolution.
*   **Documentation:** Aligned `README.md` to reflect `bun run` specific pipeline stages and installation procedures.

## [1.1.2] - 2026-02-20

### 🏗️ Update Diagram:
*   **Update Diagram:** Update the agentic workflow diagram.

## [1.1.1] - 2026-02-19

### 🛠️ Upgrade: patch retry logic to handle missing video records
*   **Handle missing video recording:** Added implicit wait and retry logic to startBrowser function.

## [1.1.0] - 2026-02-19

### 🚀 Major Feature: `playwright-cli` Integration
*   **CLI-Driven Execution**: Refactored `AutoBot` to execute modular CLI commands instead of injecting raw JavaScript blocks. This improves stability and provides better process isolation.
*   **Accessibility Tree Snapshots**: Implementation of YAML-based element trees via `playwright-cli snapshot`. Agents now interact with elements using volatile `[ref=eXXX]` IDs, significantly reducing logic errors during execution.
*   **Process-Based Parallelism**: Replaced `p-limit` with a Node.js-based **Process Orchestrator** (`runner.ts`). Each test now runs in a standalone OS process, ensuring 100% video recording reliability and memory isolation.
*   **Staggered Worker Initialization**: Added a stagger delay logic to the runner to prevent resource contention when launching multiple browser instances simultaneously.

### 🧠 Agent Evolutions
*   **Test Architect (formerly Extractor)**: Promoted the agent from a simple parser to a **Test Architect**. It now analyzes the test basis to intelligently map the correct `page_context`, `workflow_instructions`, and `playwright_skills` to specific test steps.

## [1.0.1] - 2025-01-28

### ♻️ Refactor: Architecture Decoupling
*   **Separation of Concerns:** Decoupled **Graph Topology** (Workflow) from **Agent Capabilities** (Logic). Agents now provide tools, while the Graph defines the flow.
*   **NJK Prompting:** Initial implementation of Nunjucks for dynamic prompt generation.