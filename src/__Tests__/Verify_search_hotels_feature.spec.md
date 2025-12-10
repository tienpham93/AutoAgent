# ⭐ Search Feature ⭐

### 🔁 Hooks 🔁
### 🛫 Setups 🛫
1. Go to "https://www.agoda.com/"

### 🛬 Teardowns 🛬
1. Wait for 10s before close the browser

---

### 🧪 TC01 - Verify users can search hotels by a location's name 🧪

### 🎯 Goal 🎯
Verify that a user can successfully search for a list of hotel when input all valid data to required fields of search console.

### 👣 Step Actions 👣
1. Enter "Hong Kong" to "Enter a destination or property" input field
2. Select the 1st **Suggestion** from the suggestion list
3. Select 8th Dec to 14th Dec from Calendar
4. Select 2 Room, 4 Adults and 1 Children
5. Click Search button

### ✅ Expected Result ✅

6.1 Search Page is opened on another tab

6.2 The **Location** of the first 2 results in the results list must contains "Hong Kong"

### 📝 Notes 📝

📌 **Suggestion** can refer to locator data-element-name="search-box-sub-suggestion"

📌 **Location** can refer to locator data-selenium="area-city-text"

---
