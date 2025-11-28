# ⭐ Search Feature ⭐

### 🧪 TC01 - Verify users can search hotels by a location's name 🧪

### 🎯 Goal 🎯
Verify that a registered user can successfully log in with valid credentials.

### 👣 Steps 👣
1. Go to "https://www.agoda.com/"
2. Enter "Hong Kong" to "Enter a destination or property" input field
3. Select the 1st **Suggestion** from the suggestion list
4. Select 8th Dec to 14th Dec from Calendar
5. Select 2 Room, 4 Adults and 0 Children
6. Click Search button
7. There a new tab will be opened, switch to that tab
8. Set page waits for 20s

### ✅ Expected Result ✅

6.1 Search Page is opened on another tab

6.2 The **Location** of the first 2 results in the results list must contains "Hong Kong"

### 📝 Notes 📝

 📌 **Suggestion** can refer to locator data-element-name="search-box-sub-suggestion"

 📌 **Location** can refer to locator data-selenium="area-city-text"

---
