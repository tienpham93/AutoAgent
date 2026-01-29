# ⭐ Search Feature ⭐

### 🔁 Hooks 🔁
### 🛫 Setups 🛫
1. Go to "https://www.agoda.com/"
2. Click on "Flights" tab in search menu bar

### 🛬 Teardowns 🛬
1. Wait for 10s before close the browser

---

### 🧪 TC01_verify_search_flights 🧪

### 🎯 Goal 🎯
Verify that a user can successfully search for a list of flights when entering all of required fields.

### 👣 Step Actions 👣
1. Enter "Ho Chi Minh City" to "Flying from" input field
2. Select the 1st option from the "Flying from" suggestion list 
3. Enter "Hong Kong" to "Flying to" input field
4. Select the 1st option from the "Flying to" suggestion list
5. At Departure date picker, Select default departure date
6. At Flight Occupancy panel, Click Business class
7. Click SEARCH FLIGHTS button

### ✅ Expected Result ✅
7.1 User is navigated to the Search Flight page
7.2 The Flight Search bar displays correct searched details such as flying from Ho Chi Minh to Hong Kong, departure date is today, number of passenger is 1 and Business class

### 📝 Notes 📝
6. If is there any popup displaying, you should close it before executing step 7