# 🌱 LifeBuddy — Your Mindful Everyday Companion

**LifeBuddy** is an all-in-one daily lifestyle, focus, and productivity companion. It levels up the local Pomodoro timer into a full personal hub for **Deep Focus**, **Task Planning**, **Daily Habits**, and **Mindful Personal Finances** with cloud synchronization and seamless offline fallback.

---

## 🌟 Key Features

### 1. ☀️ Today's Command Center (Dashboard)
- **Personalized Daily Greeting & Mindful Quotes** that inspire focus and intention.
- **At-a-Glance Metrics**:
  - Daily Deep Focus Minutes vs Target Goal.
  - Pending Priority Tasks count.
  - Monthly & Daily spending vs your spending cap.
  - Daily habit check-in progress.
- **Quick-Action Flow**: Instant 1-click start for 25m Focus sessions or logging expenses.

### 2. ⏱️ Focus Room
- **Circular SVG Pomodoro Timer** with smooth animation ring (Focus, Short Break, Long Break).
- **Interactive Ambient Audio Synthesizer**: Pure Web Audio API generation for Gentle Rain, White Noise, Forest Wind, and Zen Singing Bowl chimes (no external audio files required!).
- **Mindful Breathing Guide**: Visual guide to center attention between focus blocks.
- **Distraction-Free Zen Mode**: Fullscreen minimalism (press `Esc` to exit).

### 3. 📋 Planner & Habit Tracker
- **Smart Task Planner**:
  - Filter tasks by *All*, *Today*, *Pending*, or *Done*.
  - Priority flags (*Urgent*, *High*, *Medium*, *Low*).
  - Category tags (*Work*, *Study*, *Personal*, *Health*).
  - Estimated vs completed Pomodoro counters.
- **Daily Habits & Routines**:
  - Emoji icons (💧 Water, 📖 Reading, 🏃 Exercise, 🧘 Meditation, etc.).
  - Consecutive day streak tracking (`🔥 X day streak`).
  - 1-click daily completion toggles.

### 4. 💰 Mindful Finances & Expenses
- **Monthly Spending Budget Meter**: Real-time progress bar with visual alerts (*Green* ➔ *Amber* ➔ *Red*).
- **Categorized Logging**: Food, Study/Books, Transport, Shopping, Bills, Health, Entertainment, and Income.
- **Recent Activity Ledger**: Filter and delete entries instantly.

### 5. 📊 Insights & Analytics
- **Weekly Deep Work Chart**: Interactive bar visualization of focus minutes over the last 7 days.
- **Spending Category Breakdown**: Visual percentages showing where your money went this month.
- **Historical Pomodoro & Streak Counters**.

### 6. ☁️ Cloud Sync & Offline-First Mode
- **Dual-Mode Engine**: Works 100% offline via LocalStorage, and automatically syncs with the secure **FastAPI + SQLite** backend when connected.
- **User Authentication**: Secure password hashing (PBKDF2 SHA-256) and JWT token authentication.
- **PWA Ready**: Installable on desktop and mobile devices.

---

## 🚀 Quick Start (Running LifeBuddy)

### Step 1: Run the application
In your terminal, simply execute:

```bash
python run.py
```

This single command will:
1. Initialize the SQLite database (`lifebuddy.db`).
2. Start the FastAPI server on `http://localhost:8000`.
3. Automatically open LifeBuddy in your default browser!

### Step 2: Accessing from your phone / mobile device
Ensure your phone is connected to the same Wi-Fi network as your PC. Open your phone's browser and go to:
```
http://<YOUR_COMPUTER_LOCAL_IP>:8000
```
*(You can find your computer's local IP by typing `ipconfig` in PowerShell).*

---

## 📂 Project Architecture

```
FocusFreak/
├── backend/
│   ├── database.py       # SQLite connection and automatic schema migration
│   ├── auth.py           # PBKDF2 password hashing & HMAC-SHA256 JWT tokens
│   ├── models.py         # Pydantic data validation schemas
│   └── main.py           # FastAPI REST API endpoints & static asset serving
├── css/
│   ├── variables.css     # Aesthetic themes (Sage, Lavender, Nordic, Sunset, Midnight)
│   ├── styles.css        # Glassmorphism cards, dashboard, widgets, animations
│   └── responsive.css    # Responsive mobile drawer, tablet & desktop grids
├── js/
│   ├── api.js            # Unified API client + offline LocalStorage fallback
│   ├── auth.js           # Authentication & Cloud Sync status controller
│   ├── audio.js          # Web Audio API sound synthesizer
│   ├── timer.js          # Pomodoro timer engine
│   ├── tasks.js          # Task manager with priorities & categories
│   ├── habits.js         # Daily habits manager with streak calculation
│   ├── expenses.js       # Expense manager & monthly budget tracker
│   ├── dashboard.js      # Today's command center coordinator
│   ├── stats.js          # Weekly analytics & charts
│   ├── theme.js          # Palette switcher
│   └── app.js            # Main application coordinator
├── static/
│   └── manifest.json     # PWA manifest
├── run.py                # Single-click launcher
├── index.html            # Unified LifeBuddy application interface
└── lifebuddy.db          # Portable SQLite database
```
