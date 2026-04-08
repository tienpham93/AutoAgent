# ⭐ Homebase & Dashboard Navigation Feature ⭐

### 🔁 Hooks 🔁
### 🛫 Setups 🛫
1. Set "authToken" in local storage to a valid mock token
2. Set "tokenExpiry" in local storage to a valid future timestamp
3. Go to "http://localhost:5173/homebase"

### 🛬 Teardowns 🛬
1. Clear local storage
2. Wait 2 seconds

---

### 🧪 TC01_verify_homebase_access_with_auth 🧪

### 🎯 Goal 🎯
Verify that an authenticated user can access the Homebase portal correctly without being redirected to login.

### 👣 Step Actions 👣
1. Load the Homebase page URL directly ("/homebase")

### ✅ Expected Result ✅
1.1 User successfully views the Homebase page
1.2 User is not redirected to the Login page ("/")

### 📝 Notes 📝
Ensure local storage is properly mocked with unexpired token before loading the page.

---

### 🧪 TC02_verify_route_protection_redirect 🧪

### 🎯 Goal 🎯
Verify that an unauthenticated user is redirected to the login page when attempting to access a protected route.

### 👣 Step Actions 👣
1. Clear the "authToken" and "tokenExpiry" from local storage
2. Go to "http://localhost:5173/dashboard"

### ✅ Expected Result ✅
2.1 User is immediately navigated to the Login page
2.2 The URL updates to "/"
2.3 Dashboard content is not visible
