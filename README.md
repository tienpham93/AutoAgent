# 🤖 Agentic Automation Framework

An agentic automation framework powered by **LangChain**, **LangGraph**, and **Playwright**. This project utilizes four specialized LLM Agents to transform natural language test cases into executed actions, recorded artifacts, verified results, and system health audits.

## 🔄 The 4-Agent Workflow

1.  **🧠 Architect Agent**:
    *   **Action**: Analyzes raw test basis (Markdown/Feature files), maps proper `playwright-cli` skills and page knowledges, and extracts them into a structured execution plan.
    *   **Output**: Produces `extracted_all_testcase.json`.

2.  **🤖 AutoBot Agent**:
    *   **Action**: Consumes the JSON plan, spawns a browser via `playwright-cli`, interprets the **Elements Tree**, and executes steps while handling dynamic UI changes and self-healing.
    *   **Output**: Execution artifacts: `video.webm`, snapshots, and `execution_logs.json`.

3.  **🕵️ Evaluator Agent**:
    *   **Action**: Uploads the execution video to Google Gemini (Multimodal), watches the playback, and compares visual evidence against the test requirements.
    *   **Output**: Generates `evaluations.json`.

4.  **👮 Inspector Agent**:
    *   **Action**: Scans all terminal logs (`full_*.log`). It acts as an SRE to detect syntax errors, LLM hallucinations, and infrastructure lag.
    *   **Output**: Generates `log_inspections.json` (The System Audit).


## 🏗️ Diagram
````mermaid
flowchart LR
    %% Styles
    classDef agent fill:#2d3436,stroke:#fff,stroke-width:2px,color:#fff,rx:5px,ry:5px;
    classDef artifact fill:#ffeaa7,stroke:#fdcb6e,stroke-width:2px,color:#2d3436,stroke-dasharray: 6 6;
    classDef external fill:#74b9ff,stroke:#0984e3,stroke-width:2px,color:#ffffff;
    classDef report fill:#55efc4,stroke:#00b894,stroke-width:2px,color:#2d3436;

    subgraph Extraction ["🏗️ EXTRACTION 🏗️"]
        Architect(🧠 Architect Agent):::agent
        direction TB
        RawTest[📄 Raw Test Case<br/>Text/Markdown]
        PageCatalog[📖 Page Catalog<br/>Contexts & workflow njk Paths]
        PlaywrightSkillsCatalog[🎭 Playwright-cli Catalog<br/>Referenced cli scripts Paths]
    end

    subgraph Execution ["🦾 EXECUTION 🦾"]
        direction TB
        extractedTestCaseJson[extracted_all_testcase.json]:::artifact
        AutoAgent(🤖 AutoBot Agent):::agent
        Browser[🌐 Playwright Browser]:::external
        PageMaterial(🌳 Element snapshot <br/> 📷 Screenshot <br/> 💥 Errors):::artifact
    end
    
    subgraph Evaluation ["🔬 EVALUATION 🔬"]
        direction TB
        subgraph Output ["📂 Output"]
            direction TB
            Video[📹 Video.webm]:::artifact
            Logs[📝 Execution Logs]:::artifact
        end
        Evaluator(🕵️ Evaluator Agent):::agent
        EvaluationJson[evaluations.json]:::artifact
    end

    subgraph Inspection ["🔍 INSPECTION 🔍"]
        Inspector(👮 Inspector Agent):::agent
        direction TB
        ExtractionTermialLogs[Extraction Termial Logs]:::artifact       
        ExecutionTermialLogs[Execution Termial Logs]:::artifact
        EvaluationTermialLogs[Evaluation Termial Logs]:::artifact
    end
    
    %% Connections
    RawTest --> Architect
    PageCatalog --> Architect
    PlaywrightSkillsCatalog --> Architect

    Architect --> |Parses and Mapping| extractedTestCaseJson
    Architect --> |Capture Termial Logs| ExtractionTermialLogs

    extractedTestCaseJson --> AutoAgent

    AutoAgent --> |Playwright cli commands| Browser
    Browser --> |capture| PageMaterial
    PageMaterial --> |Return| AutoAgent

    AutoAgent -->|Record| Video
    AutoAgent -->|Record| Logs
    AutoAgent -->|Capture Termial Logs| ExecutionTermialLogs

    Evaluator -->|Generate| EvaluationJson
    Evaluator -->|Capture Termial Logs| EvaluationTermialLogs

    Video --> Evaluator
    Logs --> Evaluator

    ExtractionTermialLogs --> Inspector
    ExecutionTermialLogs --> Inspector
    EvaluationTermialLogs --> Inspector
````

## 🛠️ Tech Stack

*   **Language**: TypeScript, Node.js (v20+)
*   **AI Orchestration**: LangChain, LangGraph
*   **Automation Engine**: `@playwright/cli` & Playwright
*   **LLMs**: Google Gemini (Pro/Flash), Anthropic Claude 3.5
*   **Reporting**: Allure Report
*   **Templating**: Nunjucks (`.njk`)

## 📂 Project Structure

Based on the latest organization:

```plaintext
src/
├── Agents/              # Agent logic (AutoBot, Architect, Evaluator, Inspector, etc.)
├── Prompts/
│   ├── Agents/          # Agent Personas and general Reasoning Rules
│   │   ├── Persona/     
│   │   └── Rules/       
│   ├── Pages/           # Domain Knowledge
│   │   ├── Contexts/    # Page object logic & identification
│   │   └── Workflows/   # Sequential logic & decision trees
│   └── skills/          # Playwright-cli skill definitions
│       └── playwright-cli/
│           └── references/ # Mocking, storage, and session guides
├── Report/              # Allure report generation logic
├── Services/            # GraphService & LangGraph definitions
├── Utils/               # Common helpers & File I/O
├── execution.ts         # Worker logic for individual test execution
├── extraction.ts        # Orchestrator for test case parsing
├── evaluation.ts        # Orchestrator for video-based verification
├── inspection.ts        # Orchestrator for log auditing
├── runner.ts            # Parallel execution orchestrator (Multi-worker)
├── settings.ts          # Environment & Path configurations
├── types.ts             # Global TS Interfaces
└── constants.ts         # Agent Node & State constants
```

***

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone git@github.com:tien-pham/AutoAgent.git

# Install dependencies
yarn install

# Install Playwright browsers and CLI tools
npx playwright install
```

### 🏃 Execution Commands

The framework is designed to run in a specific pipeline. You can run individual stages or the full End-to-End flow.

| Command | Description |
| :--- | :--- |
| `yarn test:extract` | Run extraction.ts to parses Markdown feature files into `extracted_all_testcase.json`. |
| `yarn test:run` | Triggers the **Runner** to execute test cases in parallel (configurable workers). |
| `yarn test:eval` | Run evaluation.ts that sends execution videos to Gemini for visual verification. |
| `yarn test:inspect` | Audits the `full_*.log` files for agent performance errors. |
| `yarn test:allure` | Compiles all JSON results into a searchable Allure Report. |
| **`yarn test:e2e`** | **Runs the full pipeline (Extract -> Run -> Eval -> Inspect -> Allure).** |
| `yarn test:cleanup` | Removes the `output/` folder and old artifacts. |

***

## 🔬 Way of Working: Manual Debugging with `playwright-cli`

When a test step fails or you are building a new **Page Context**, you should use the manual debugging workflow. This allows you to verify exactly how the `playwright-cli` interacts with the site before committing logic to an AI Agent.

### 1. Manual Exploration
Launch a manual CLI session to test selectors and commands:
```bash
# Open the browser
yarn pwcli open https://www.agoda.com

# Take a snapshot to see the YAML element tree (and get [ref=eXXX] IDs)
yarn pwcli snapshot

# Test an interaction using a ref found in the snapshot
yarn pwcli click e144
yarn pwcli fill e144 "Hong Kong"
```

### 2. Building Page Knowledges (.njk)
If the manual `click` or `fill` works, use that structural information to update your templates:
1.  **Contexts** (`Prompts/Pages/Contexts/`): Define component names and mapping logic using the stable ARIA names/roles found in your manual `snapshot`.
2.  **Workflows** (`Prompts/Pages/Workflows/`): Define "Decision Logic" (when to RETRY, when to SKIP) based on the visual behavior you observed during manual testing.

### 3. Rapid Bootstrapping
You don't need to write `.njk` files from scratch:
*   Run `yarn pwcli snapshot --filename=temp.yml`.
*   Copy the content of `temp.yml` and a similar existing `.njk` file.
*   Ask Gemini/ChatGPT: *"Using the provided YAML structure, generate a new Page Context template following this NJK format."*

***
## 🏅 Author: **tien-pham** 🏅