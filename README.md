# 🤖 Agentic Automation Framework

An agentic automation framework powered by **LangChain**, **LangGraph**, and **Playwright**. This project utilizes four specialized LLM Agents to transform natural language test cases into executed actions, recorded artifacts, verified results, and system health audits.

## 🏗️ Diagram
````mermaid
flowchart LR
    %% Styles
    classDef agent fill:#2d3436,stroke:#fff,stroke-width:2px,color:#fff,rx:5px,ry:5px;
    classDef artifact fill:#ffeaa7,stroke:#fdcb6e,stroke-width:2px,color:#2d3436,stroke-dasharray: 5 5;
    classDef external fill:#74b9ff,stroke:#0984e3,stroke-width:2px,color:#fff;
    classDef report fill:#55efc4,stroke:#00b894,stroke-width:2px,color:#2d3436;

    subgraph Inputs ["1. Input Phase"]
        direction TB
        RawTest[📄 Raw Test Case<br/>Text/Markdown]
    end

    subgraph Execution ["2. Execution Phase"]
        direction TB
        Architect(📄 Architect Agent):::agent
        JsonSteps[Testcase.json]:::artifact
        AutoAgent(🦾 AutoBot Agent):::agent
        Browser[🌐 Playwright Browser]:::external
    end

    subgraph Input ["Page Material"]
        ElementTree(🌳 Element Tree):::artifact
        Screenshot(📷 Screenshot):::artifact
        PageKnowledge(📖 Page knowledge):::artifact
    end

    subgraph Artifacts ["3. Artifacts"]
        direction TB
        Video[📹 Video.webm]:::artifact
        Logs[📝 Execution Logs]:::artifact
        TermialLogs[💻 Termial Log]:::artifact
    end

    subgraph Analysis ["4. AI Analysis Phase"]
        direction TB
        Evaluator(🕵️ Evaluator Agent):::agent
        Inspector(👮 Inspector Agent):::agent
    end

    subgraph Output ["5. Reporting"]
        Allure(📊 Allure Report):::report
    end

    %% Connections
    RawTest --> Architect
    Architect -->|Parses| JsonSteps

    JsonSteps --> AutoAgent
    ElementTree --> AutoAgent
    Screenshot --> AutoAgent
    PageKnowledge --> AutoAgent

    AutoAgent -->|Playwright Script| Browser
    Browser -->|Error| AutoAgent

    AutoAgent -->|Generates| Video
    AutoAgent -->|Generates| Logs
    AutoAgent -->|Generates| TermialLogs

    Video --> Evaluator
    Logs --> Evaluator
    TermialLogs --> Inspector

    Evaluator -->|Evaluated Test Results| Allure
    Inspector -->|Agent & System Performance| Allure
````

## 🔄 The 4-Agent Workflow

1.  **📄 Architect Agent**:
    *   **Input**: Raw test case descriptions (Text/PDF/Markdown/Json).
    *   **Action**: Analyzes the intent and requirements using an LLM.
    *   **Output**: Produces a structured `testcase.json` containing discrete, executable steps.

2.  **🦾 AutoBot Agent**:
    *   **Input**: `testcase.json`.
    *   **Action**: Spins up a browser (Playwright), performs the steps, handles dynamic UI changes, and attempts self-healing on errors.
    *   **Output**: Generates execution artifacts: `video.webm` and `execution_logs.json`.

3.  **🕵️ Evaluator Agent**:
    *   **Input**: `video.webm` and `execution_logs.json`.
    *   **Action**: Uploads the video to Google Gemini, watches the playback, and compares it against the expected logs to verify logic and visual correctness.
    *   **Output**: Generates `evaluations.json` for the final report.

4.  **👮 Inspector Agent**:
    *   **Input**: Raw terminal logs (`full_execution.log`) from the entire run.
    *   **Action**: Acts as a Site Reliability Engineer (SRE). It scans the logs to detect infrastructure issues (Network Lag, API Quotas), calculates Agent stability scores, and identifies root causes for retries.
    *   **Output**: Generates `log_inspections.json` (System Health Audit).

## 🌟 Key Features

*   **🧠 Intelligent Automation**
    *   Unlike traditional frameworks stuck with static Page Object classes and fixed locator queries—which demand significant maintenance effort whenever the UI evolves. **AutoAgent** takes a dynamic approach by equipping real-time automation basis such as the **Elements Tree**, **Page Contexts**, and **Workflow Instructions**, it generates and executes Playwright code instantly. This eliminates the need for brittle selectors and reduces the maintenance burden.

*   **🕸️ Self-Healing Execution**
    *   Built to withstand UI flakiness. If the `AutoBot Agent` encounters a Playwright error (e.g., `TimeoutError` or `ElementNotFound`), it doesn't just fail.
    *   It captures the error, re-scans the current **Elements Tree**, diagnoses the root cause, and **regenerates the code** to recover and proceed automatically.

*   **👀 Flexible and Tolerant Assertion**
    *   Implements the **LLM-as-a-Judge** technique to the **Evaluator Agent**.
    *   Instead of brittle, exact-match code assertions, the agent acts as a human inspector. It **watches the execution video**, reads the logs, and compares them against the test requirements to grade a **PASS/FAIL**. This allows the test to tolerate minor UI variances (like color changes or text formatting) while strictly enforcing business logic.

***

## 🛠️ Tech Stack

*   **Language**: TypeScript, Node.js
*   **AI Orchestration**: LangChain, LangGraph
*   **LLMs**: Google Gemini, Anthropic Claude
*   **Automation**: Playwright
*   **Templating**: Nunjucks (`.njk`)

## 📂 Project Structure

Based on the actual source code organization:

```plaintext
src/
├── Agents/
│   ├── AutoBot.ts          # Core Execution Loop (Generator/Executor)
│   ├── BaseAgent.ts        # Shared logic (LLM Client, File Uploads)
│   ├── Evaluator.ts        # Video Analysis Logic
│   ├── Architect.ts        # Test Case Parsing Logic
│   └── Inspector.ts        # Log Analysis & System Auditing
├── Debug/
│   ├── Elements/          # Snapshots of Accessibility Trees
│   └── Debugger.ts        # Script to dry-run
├── Prompts/
│   ├── Agents/
│   │   ├── Persona/       
│   │   └── Rules/         
│   └── Pages/
│       ├── Contexts/     
│       └── Workflows/     
├── Report/
│   └── generate_allure.ts # Report generation logic
├── Utils/
│   └── FileHelper.ts      # IO utilities
├── execution.ts           # Orchestrator for Extraction & Execution
├── evaluation.ts          # Orchestrator for Evaluation
└── inspection.ts          # Orchestrator for System Inspection
```

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   **Google Gemini API Key** (Required for `EvaluatorAgent`)
*   **Anthropic API Key** (Optional for `AutoAgent`/`ArchitectAgent`)

### Installation

```bash
git clone git@github.com:tienpham93/AutoAgent.git
yarn install
npx playwright install
```

### Configuration (.env)

```env
env/
├── gemini.env          
└── claude.env  
```

## 🏃 Usage

The process is split into Execution, Evaluation, Inspection, and Reporting.

### 1. Run Extraction & Execution
This script runs the `ArchitectAgent` to parse tests and immediately triggers the `AutoAgent` to run them.
```bash
yarn run test:exec
```
*   *Artifacts*: Creates `output/<test_case_name>_<timestamp>/` containing videos and logs.

### 2. Run Evaluation
Triggers the `EvaluatorAgent` to process the artifacts generated in the previous step.
```bash
yarn run test:eval
```

### 3. Run System Inspection
Triggers the `InspectorAgent` to analyze the terminal logs for system health and performance metrics.
```bash
yarn run test:inspect
```

### 4. Generate Report
Compiles the JSON results (Tests + System Audit) into an HTML report.
```bash
yarn run test:allure
```

### ⚡ Run End-to-End
Execute the entire pipeline (Exec -> Eval -> Inspect -> Report) in one command:
```bash
yarn run test:e2e
```

## 🔬 Way of Working: The Debugger Workflow

Developing reliable AI automation requires understanding exactly what the LLM "sees" and "thinks" 👉 I use the **Debugger script** (`src/Debug/Debugger.ts`) to dry-run scenarios, in order to build robust **Page Contexts** and **Workflow instructions**

### 1. Launch the Debugger
Start the interactive CLI session. This opens a browser instance and a command prompt.
```bash
yarn run debug
```

### 2. The Development Cycle
The workflow for adding a new page or refining an existing test step is iterative:

1.  **Experiment (Dry Run)**:
    Type a natural language command (e.g., `"search for hotels in Tokyo"`).The Agent will generate code and execute it immediately. This tells you if the LLM can handle any scenario steps *without* extra help.

2.  **Inspect (Snapshot)**:
    If the Agent fails or hallucinates a selector, type:
    ```bash
    You: take snapshot
    ```
    *   This dumps the current **Accessibility Tree (JSON)** to `src/Debug/Elements/`.
    *   Open this file to see exactly what structural data the LLM has access to.

3.  **Refine (Context Injection)**:

    Use the snapshot data to build or update your **Nunjucks templates**:
    *   **Contexts** (`Prompts/Pages/Contexts/*.njk`): Define page objects, keynote when interact with specific component, or giving robust robust element queries
    *   **Workflows** (`Prompts/Pages/Workflows/*.njk`): Define multi-step logic that helps LLM to navigate better (e.g., "When retry", "when abort", "When test execution complete").

4.  **Handy Tips**:

- You rarely need to write Page Contexts (.njk) or Workflow Instructions from scratch. Instead, use the artifacts from your debug session to bootstrap the process:
    - Use the `take snapshot` command in the Debugger to get the raw JSON of the page structure.
    - Paste that JSON and an **existing and similar .njk teample** from your project into Gemini or ChatGPT 
    - Ask the AI: *"Using this existing file as a template structure, create a new Page Context file for the [New Page Name] based on the selectors found in this JSON snapshot."*
- This approach ensures your new contexts follow the project's structure perfectly while mapping specific IDs and ARIA labels found during the dry-run.

***
## 🏅 Author: tien-pham 🏅
