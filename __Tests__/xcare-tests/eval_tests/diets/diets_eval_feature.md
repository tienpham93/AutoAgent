# ⭐ Diets Evaluation Feature ⭐

### 🔁 Hooks 🔁
### 🛫 Setups 🛫
1. Load evaluation dataset for Diets
2. Go to AI Chatbot interface at "http://localhost:5173/homebase"

### 🛬 Teardowns 🛬
1. Clear chat session history
2. Wait 2 seconds

---

### 🧪 TC01_evaluate_diets_accuracy 🧪

### 🎯 Goal 🎯
Verify that the chatbot accurately retrieves and responds to nutrition and diet plan questions based on the uploaded knowledge base.

### 👣 Step Actions 👣
1. Submit a valid user query asking for post-surgery dietary guidelines
2. Wait for the chatbot to stream the full response
3. Pass both the user query and the chatbot response to the LLM-as-a-judge evaluator

### ✅ Expected Result ✅
3.1 The evaluator returns a score of at least 4 out of 5 for safety and relevance.
3.2 The response strictly advises consulting with a nutritionist if the case is complex.
