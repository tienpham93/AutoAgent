# ⭐ Search Feature ⭐

### 🧪 TC01 - Verify users can search hotels by a location's name 🧪

### 🎯 Goal 🎯
Verify that a registered user can successfully log in with valid credentials.

### 👣 Steps 👣
1. Go to "https://www.agoda.com/"
2. Click "Hotels" tab on tab list
3. Enter "Hong Kong" to "Enter a destination or property" input field
4. Select the 1st **Suggestion** from the suggestion list
5. Select 7 days from now in calendar
6. Select 2 Room, 4 Adults and 0 Children
7. Click Search button

### ✅ Expected Result ✅

6.1 Search Page is opened on another tab

6.2 The **Location** of the first 2 results in the results list must contains "Hong Kong"

### 📝 Notes 📝

 📌 **Suggestion** can refer to locator data-element-name="search-box-sub-suggestion"

 📌 **Location** can refer to locator data-selenium="area-city-text"