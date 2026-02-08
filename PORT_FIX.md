# Port 8000 Already in Use - Solution Guide

## 🚨 Problem: Port 8000 Already in Use

The error `[Errno 10048] only one usage of each socket address` means port 8000 is already being used by another application.

## 🔧 Solutions (Easiest First)

### Solution 1: Automatic Port Detection (Recommended)
The server now automatically finds an available port:
- ✅ Tries port 8000, 8001, 8002, etc.
- ✅ Shows which port it's using
- ✅ No manual changes needed

**Just run the server again:**
```cmd
START_HERE.bat
```

### Solution 2: Check What's Using Port 8000
```cmd
check_ports.bat
```

### Solution 3: Kill the Process Using Port 8000
1. **Find the PID** from `check_ports.bat` output
2. **Kill the process**:
   ```cmd
   taskkill /PID [PID_NUMBER] /F
   ```

### Solution 4: Restart Your Computer
Sometimes the simplest solution:
```cmd
# Save all work, then restart
shutdown /r /t 0
```

## 🎯 Expected Output After Fix

When you run `START_HERE.bat` now, you should see:
```
🚀 Starting Sarkari-Sarathi Backend Setup...
✅ Project structure verified
📁 Changed to backend directory
✅ Virtual environment created/activated
🌟 Running setup and starting server...
Starting server on port 8001  # or 8000 if available
📄 API docs at: http://localhost:8001/docs
```

## 🌟 Access Points After Fix

- **Backend**: http://localhost:8001 (or whatever port is chosen)
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8001/docs

## 🔍 Common Applications Using Port 8000

- **Other Python servers**
- **Development tools** (VS Code, PyCharm)
- **Communication apps** (Skype, Zoom)
- **System services**

## 💡 Pro Tips

1. **Use automatic port detection** - no manual changes needed
2. **Check ports first** with `check_ports.bat`
3. **Restart IDE** after killing processes
4. **Use different browser** if one has cached connections

---

**The server is designed to handle this automatically - just run START_HERE.bat again!** 🚀
