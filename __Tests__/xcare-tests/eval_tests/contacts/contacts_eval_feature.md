# ⭐ Contacts Evaluation Feature ⭐

### 🔁 Hooks 🔁
### 🛫 Setups 🛫
1. Load evaluation dataset for Contacts
2. Go to AI Chatbot interface at "http://localhost:5173/homebase"

### 🛬 Teardowns 🛬
1. Clear chat session history
2. Wait 2 seconds

---

### 🧪 TC01_evaluate_contacts_accuracy 🧪

### 🎯 Goal 🎯
Verify that the chatbot accurately retrieves and responds to hospital and department contact queries based on the uploaded knowledge base.

### 👣 Step Actions 👣
1. Submit a valid user query asking for specific department phone numbers
2. Wait for the chatbot to stream the full response
3. Pass both the user query and the chatbot response to the LLM-as-a-judge evaluator

### ✅ Expected Result ✅
3.1 The evaluator returns a score of at least 4 out of 5 for truthfulness and relevance.
3.2 The contact information matches exactly with the Contacts knowledge base.
