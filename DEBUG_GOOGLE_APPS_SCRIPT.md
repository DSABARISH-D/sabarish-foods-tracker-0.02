# Google Apps Script Deployment Debugging

## Current Status
- **Deployment URL in use:** `https://script.google.com/macros/s/AKfycbzqeWiAF1rUWL4sSCg38_BPuSGIv0sYm9gnkL-dYsau0EW1L55nd4Dpw_qHINqCxdDX/exec`
- **Error:** "Script function not found: doPost"
- **Cause:** The deployed version lacks the `doPost` function

## Quick Test (Do This First)
Open this URL in your browser:
```
https://script.google.com/macros/s/AKfycbzqeWiAF1rUWL4sSCg38_BPuSGIv0sYm9gnkL-dYsau0EW1L55nd4Dpw_qHINqCxdDX/exec
```

**Expected result:** You should see JSON like:
```json
{"success":true,"message":"Google Apps Script is running"}
```

**If you get the HTML error page:** The deployment is outdated and doesn't have the code.

---

## How to Fix (Follow These Steps Exactly)

### Step 1: Go to Google Apps Script Editor
- Visit: https://script.google.com
- Find your **SAB Foods** project
- Click to open it

### Step 2: Check Current Code
- Look for the `function doPost(e) {` at approximately **line 49**
- If you DON'T see it, the code wasn't copied over

### Step 3: Copy Latest Code
- Open this file in VS Code: `google-apps-script/Code.gs`
- Press `Ctrl+A` to select all
- Press `Ctrl+C` to copy

### Step 4: Paste Into Google Apps Script
- In the Google Apps Script editor, select all existing code (`Ctrl+A`)
- Delete it
- Paste the new code (`Ctrl+V`)

### Step 5: Save
- Press `Ctrl+S`
- Wait for "Saved" message at top

### Step 6: Create NEW Deployment
- Click **Deploy** button (top-right)
- Click **New Deployment**
- Select type: **Web App**
- Execute As: **Your Google Account**
- Access: **Anyone with the link**
- Click **Deploy**

### Step 7: Copy New Deployment URL
- A popup will show the new Web App URL
- Copy the entire URL (starts with `https://script.google.com/macros/s/...`)

### Step 8: Update `.env` File
- Edit `.env` in your project root
- Find line: `EXPO_PUBLIC_GOOGLE_SCRIPT_URL=...`
- Replace with NEW URL from Step 7
- Save file

### Step 9: Restart App
```bash
npm start
```

### Step 10: Test
- Try syncing data from your app
- Check if error is gone

---

## Verification
If you're at Google Apps Script Editor, you can manually test:
1. Click **Run** next to `doPost`
2. You'll get an error (expected, no test data)
3. But if `doPost` is NOT in the list, the function doesn't exist in deployed version

---

## Common Mistakes
- ❌ Only copying part of the Code.gs
- ❌ Not saving after pasting
- ❌ Using old deployment URL instead of new one
- ❌ Not restarting dev server after `.env` update
- ❌ Forgetting to click "New Deployment" instead of editing old one
