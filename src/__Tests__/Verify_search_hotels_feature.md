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
3. Select **Today** is **Checkin date**
4. Select **Checkout date** date is next 4 days from the checkin date
5. Select 2 Room, 4 Adults and 1 Children
6. Click Search button

### ✅ Expected Result ✅

6.1 Search Page is opened on another tab

6.2 The **Location** of the first 2 results in the results list must contains "Hong Kong"

### 📝 Notes 📝
📌 **Today** is the current date that running this testcase NOT the default checkin date in the DayPicker-Day

📌 **Checkin date** can refer this xpath (//*[@class="DayPicker-Day"]//span[contains(text(), '<put_checkin_day_here>')])[1]

📌 **Checkout date** can refer this xpath (//*[@class="DayPicker-Day"]//span[contains(text(), '<put_checkout_day_here>')])[2]

📌 **Suggestion** can refer this css[data-element-name="search-box-sub-suggestion"]

📌 **Location** can refer this css [data-selenium="area-city-text"]

---
