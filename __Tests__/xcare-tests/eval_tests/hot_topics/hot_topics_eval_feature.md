# ⭐ Hot Topics Evaluation Feature ⭐

### 🔁 Hooks 🔁
### 🛫 Setups 🛫
1. Load evaluation dataset for Hot Topics
2. Go to AI Chatbot interface at "http://localhost:5173/homebase"

### 🛬 Teardowns 🛬
1. Clear chat session history
2. Wait 2 seconds

---

### 🧪 TC01_evaluate_hot_topics_accuracy 🧪

### 🎯 Goal 🎯
Verify that the chatbot accurately retrieves and responds to frequently asked trending topics (e.g., vaccination updates, seasonal diseases).

### 👣 Step Actions 👣
1. Submit a valid user query from the trending Hot Topics dataset
2. Wait for the chatbot to stream the full response
3. Pass both the user query and the chatbot response to the LLM-as-a-judge evaluator

### ✅ Expected Result ✅
3.1 The evaluator returns a score of at least 4 out of 5 for timeliness and relevance.
3.2 The response contains up-to-date information matching the latest Hot Topics corpus snapshot.
