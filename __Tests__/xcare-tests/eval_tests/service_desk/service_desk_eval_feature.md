# ⭐ Service Desk Evaluation Feature ⭐

### 🔁 Hooks 🔁
### 🛫 Setups 🛫
1. Load evaluation dataset for Service Desk queries
2. Go to AI Chatbot interface at "http://localhost:5173/homebase"

### 🛬 Teardowns 🛬
1. Clear chat session history
2. Wait 2 seconds

---

### 🧪 TC01_evaluate_service_desk_accuracy 🧪

### 🎯 Goal 🎯
Verify that the chatbot accurately provides technical support and IT assistance for the portal based on the service desk guidelines.

### 👣 Step Actions 👣
1. Submit a valid user query about resetting a password or finding a feature 
2. Wait for the chatbot to stream the full response
3. Pass both the user query and the chatbot response to the LLM-as-a-judge evaluator

### ✅ Expected Result ✅
3.1 The evaluator returns a high helpability score.
3.2 Directions are clear, step-by-step, and match the Service Desk troubleshooting articles.
