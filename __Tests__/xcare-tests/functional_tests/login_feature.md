# ⭐ Login Feature ⭐

### 🔁 Hooks 🔁
### 🛫 Setups 🛫
1. Go to "http://localhost:5173/"

### 🛬 Teardowns 🛬
1. Clear local storage
2. Wait 2 seconds

---

### 🧪 TC01_verify_successful_login 🧪

### 🎯 Goal 🎯
Verify that a user can successfully login to the XCare portal when using valid credentials.

### 👣 Step Actions 👣
1. Enter "doctor_smith" to "Username" input field
2. Enter "SecurePass123!" to "Password" input field
3. Click "Sign In" button

### ✅ Expected Result ✅
3.1 User is navigated to the Homebase page ("/homebase")
3.2 Local storage contains "authToken" and "user"
3.3 No error message is displayed on the screen

### 📝 Notes 📝
If there is a previous session, clear the local storage before executing step 1.

---

### 🧪 TC02_verify_failed_login 🧪

### 🎯 Goal 🎯
Verify that a user sees an error message when entering invalid credentials.

### 👣 Step Actions 👣
1. Enter "invalid_user" to "Username" input field
2. Enter "wrong_password" to "Password" input field
3. Click "Sign In" button

### ✅ Expected Result ✅
3.1 User remains on the Login page
3.2 An error message "Invalid username or password" is displayed below the Sign In button
3.3 Local storage does not contain "authToken"
