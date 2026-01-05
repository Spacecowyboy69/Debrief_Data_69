# How to Run the ADIZ Dashboard

## ⚠️ Important: Browser Security Restrictions

Modern browsers block loading files from the local file system (file://) for security reasons. This means if you just double-click `index.html`, the data won't load automatically.

## ✅ Solution: Use a Local Web Server

You have several easy options:

### Option 1: Python (Easiest - Works on Mac/Linux/Windows)

**If you have Python 3:**
```bash
cd adiz-dashboard
python3 -m http.server 8000
```

**If you have Python 2:**
```bash
cd adiz-dashboard
python -m SimpleHTTPServer 8000
```

Then open your browser to:
```
http://localhost:8000
```

### Option 2: Node.js (If you have npm)

```bash
cd adiz-dashboard
npx http-server -p 8000
```

Then open: `http://localhost:8000`

### Option 3: VS Code (If you use VS Code)

1. Install the "Live Server" extension
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Option 4: Manual Data Loading (Backup)

If you can't run a server:

1. Open `analyzers.html` directly
2. You'll see an error message
3. Click **"Show Manual Data Loader"**
4. Select `visualizer.html` from your computer
5. Click "Load Data"

## 🚀 Quick Start (After Server is Running)

1. Open `http://localhost:8000` in your browser
2. Click on **"Module 1: Single Event"**
3. Data loads automatically!
4. Select filters and analyze events

## 📝 Why This Happens

Browsers implement "CORS" (Cross-Origin Resource Security) which prevents:
- Loading files from `file://` URLs
- Fetching other local files via JavaScript
- This is for security - to prevent malicious websites from reading your files

Running a local web server makes the browser see it as `http://localhost` instead of `file://`, which bypasses these restrictions.

## 🆘 Still Having Issues?

Make sure:
- All files are in the same `adiz-dashboard` folder
- You're running the server from inside that folder
- You're accessing via `http://localhost:8000` not `file://`
- Your browser allows JavaScript (it should by default)

## 💡 Alternative: Host Online

You can also upload the entire `adiz-dashboard` folder to:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

Then access it via the URL they provide!
