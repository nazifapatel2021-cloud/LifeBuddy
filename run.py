"""
LifeBuddy Launcher
Starts the FastAPI application and opens your browser.
"""
import sys
import webbrowser
import threading
import time
import uvicorn

def open_browser():
    time.sleep(1.2)
    print("\n🌿 Opening LifeBuddy in your browser: http://localhost:8000")
    webbrowser.open("http://localhost:8000")

if __name__ == "__main__":
    print("=" * 60)
    print("  🌱 LifeBuddy - Your Mindful Everyday Companion")
    print("  Focus • Tasks • Habits • Expenses • Analytics")
    print("=" * 60)
    print("  API Docs available at: http://localhost:8000/docs")
    print("  To stop the server, press Ctrl + C")
    print("=" * 60)
    
    # Open browser automatically in background
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Run uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
