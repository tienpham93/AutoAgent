
Automation that thinks. Automation that heals. 🧠⚡

A normal day for many automation testers looks like this:
1️⃣ Check the test run report.
2️⃣ Spot 15 failed tests.
3️⃣ Spend hours investigating the root cause.
4️⃣ Discover the UI changed (again) or a locator became brittle.
5️⃣ Manually update Page Object classes and selectors.
6️⃣ Re-run and pray. 🙏

In an era where AI is writing code faster than ever, why are we still carrying this "Automation Burden"? why don't we ship that burden to the agents 🚢

I’m excited to share a project I’ve been working on: the Agentic Automation Framework (built with LangChain, LangGraph, and Playwright). 
👉 Github [https://github.com/tienpham93/AutoAgent]
It’s a humble attempt to move from "writing scripts" to "giving instructions and contexts" using a 3-agent ecosystem:
📄 ExtractorAgent: It takes raw test cases (Text, PDF, or even messy Markdown) and translates them into structured, executable steps. It figures out the intent so you don't have to.
🦾 AutoAgent: The "Muscle." This agent doesn't rely on hardcoded selectors. It looks at the live elements tree and generates Playwright code on the fly. If a UI element moves, it re-scans, self-heals, and keeps going.
🕵️ EvaluatorAgent: The "Eyes." It literally watches the execution video and uses LLM-as-a-Judge to verify the results. It checks if the logic is correct and if the UI actually looks right to a human.

🌟 The "Cool" Stuff (Pros):
✅ Reducing Maintenance Heaviness: By moving away from static Page Objects and brittle selectors, the AutoAgent looks at the live elements tree and screenshots to make real-time decisions. It generates the right Playwright script for the right element on the fly.
✅ Massive Scalability: By providing instructions and a few examples, the agent can test infinite variations. Tell it to "create a meeting tomorrow" and it can autonomously handle scenarios for next week, next month, a leap year (Feb 29), or even a public holiday without extra code.
✅ LLM-as-a-Judge: Our EvaluatorAgent acts as a human inspector. It watches the execution video to judge quality and logic, moving past the limitations of static code assertions.

⚠️ The Reality Check (The Cons):
❌ API Quotas: Intelligent agents require compute. For large-scale datasets, you’ll need to manage your API usage or move to enterprise-tier licenses.
❌ AI being AI: Hallucinations are real. Whether it's a confusing prompt or the AI having a "creative" moment, it’s not 100% perfect yet. I wouldn’t use this to replace traditional frameworks for 100% of critical business logic, where consistency is life-or-death -> Perhap you can have both 🤞they are incomplete part of each other 💔

🔬 Why this matters for the future of QA
Because of its scalability, I believe this approach is a perfect fit for testing LLM-based or AI-Powered applications.

In these apps, "pass/fail" isn't enough. When you need to run massive datasets through an application to collect and evaluate outputs against complex criteria (Accuracy, Relevance, Hallucination, Safety/Harmlessness, and Tone of Voice...etc)
Traditional testing often falls short here, but an agentic framework can scale to meet that complexity.

I’m currently working in an LLM Evals team, perhap I’ll be sharing a deeper dive about the trendy term "LLM Evaluation" in another post 🚀
In the meantime, I’d love for you to check out the repo and share your thoughts.

#SoftwareTesting #Playwright #AIAgents #LangChain #QualityEngineering #TestAutomation #LLM