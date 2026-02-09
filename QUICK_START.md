# 🚀 Quick Start Guide - Sarkari-Sarathi

## ⚠️ Common Error: "Failed to fetch http://127.0.0.1:8000"

This error means **the backend server is not running**. Follow the steps below.

---

## ✅ Correct Way to Run the Application

### Step 1: Start the Backend Server (REQUIRED FIRST!)

Open **PowerShell** or **Command Prompt** in the project folder and run:

```powershell
cd backend
python main.py
```

**Wait until you see:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

This means the backend is ready!

### Step 2: Access the Application

You have **TWO options** to access the frontend:

#### Option A: Use Backend's Built-in Frontend (Recommended ✅)

Simply open your browser and go to:
```
http://localhost:8000/app
```

This is the **easiest and most reliable** method!

#### Option B: Use VS Code Live Server

1. Keep the backend running (from Step 1)
2. Open `frontend/index.html` in VS Code
3. Right-click and select "Open with Live Server"
4. The page will open at `http://127.0.0.1:5500/frontend/index.html`
5. The frontend will automatically connect to the backend at port 8000

---

## 🔧 Troubleshooting

### Error: "Failed to fetch"
- **Cause**: Backend is not running
- **Fix**: Run `python main.py` in the `backend` folder first

### Error: "Port 8000 already in use"
- **Cause**: Another process is using port 8000
- **Fix**: 
  ```powershell
  # Find and kill the process using port 8000
  netstat -ano | findstr :8000
  taskkill /PID <PID_NUMBER> /F
  ```

### Backend crashes or exits immediately
- **Cause**: Missing dependencies
- **Fix**: 
  ```powershell
  cd backend
  pip install -r requirements.txt
  ```

### CORS Error in browser console
- **Cause**: Blocked cross-origin request
- **Fix**: The backend already has CORS configured. Just make sure you're running the **latest code** and restart the backend.

---

## 📁 Project Structure

```
Nepali STT/
├── backend/           ← Backend server (FastAPI)
│   ├── main.py        ← RUN THIS FILE
│   ├── requirements.txt
│   └── templates/     ← Document templates (JSON)
│
├── frontend/          ← Web interface
│   ├── index.html
│   └── script.js
│
└── QUICK_START.md     ← This file
```

---

## 🎯 Quick Commands Reference

| Action | Command |
|--------|---------|
| Start Backend | `cd backend && python main.py` |
| Access App (Best) | Open `http://localhost:8000/app` |
| Check Port 8000 | `netstat -ano \| findstr :8000` |
| Install Dependencies | `pip install -r requirements.txt` |

---

## 💡 Tips

1. **Always start backend first** before opening the frontend
2. **Use `http://localhost:8000/app`** for the most reliable experience
3. Keep the **terminal window open** while using the app (closing it stops the server)
4. If you make changes to backend code, **restart the server** (Ctrl+C, then `python main.py`)

---

## 📞 API Endpoints (for developers)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/document-types` | GET | List all document types |
| `/template/{type}` | GET | Get template for a document |
| `/locations` | GET | Get Nepal administrative data |
| `/transcribe` | POST | Convert speech to text |
| `/generate-document` | POST | Generate document with AI |
| `/docs` | GET | Interactive API documentation |
