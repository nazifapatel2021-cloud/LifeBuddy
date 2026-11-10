"""
LifeBuddy Realistic Synthetic Data Generator
Generates 90 days of longitudinal data across 5 distinct user personas with realistic
psychological and behavioral dynamics (sleep-focus lag, mood-spending spikes, circadian peaks).
Uses a fixed seed for 100% academic reproducibility.
"""

import sys
import os
import random
import uuid
import json
from datetime import datetime, date, timedelta
import numpy as np

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# Ensure project root is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.database import get_db_connection, init_db
from backend.auth import hash_password

SEED = 42

PERSONAS = [
    {
        "username": "alex_student",
        "email": "alex@lifebuddy.edu",
        "password": "password123",
        "name": "Alex (Deep Work Student)",
        "budget": 600.0,
        "days": 90,
        "type": "student"
    },
    {
        "username": "maya_freelancer",
        "email": "maya@lifebuddy.dev",
        "password": "password123",
        "name": "Maya (Burnout Freelancer)",
        "budget": 1800.0,
        "days": 90,
        "type": "burnout"
    },
    {
        "username": "sam_habits",
        "email": "sam@lifebuddy.org",
        "password": "password123",
        "name": "Sam (Disciplined Habit Builder)",
        "budget": 1200.0,
        "days": 90,
        "type": "habit_builder"
    },
    {
        "username": "jordan_nightowl",
        "email": "jordan@lifebuddy.io",
        "password": "password123",
        "name": "Jordan (Night Owl Developer)",
        "budget": 1500.0,
        "days": 90,
        "type": "night_owl"
    },
    {
        "username": "taylor_coldstart",
        "email": "taylor@lifebuddy.com",
        "password": "password123",
        "name": "Taylor (Cold Start - 4 Days)",
        "budget": 800.0,
        "days": 4,
        "type": "cold_start"
    }
]

STUDY_TASKS = [
    ("DBMS Normalization & B+ Trees assignment", "study", "urgent", 3),
    ("Operating Systems virtual memory lab", "study", "high", 4),
    ("Computer Networks TCP congestion report", "study", "medium", 2),
    ("Read Linear Algebra Chapter 5", "study", "low", 2),
    ("Software Engineering design patterns essay", "study", "medium", 3),
    ("Data Structures Graph algorithms quiz prep", "study", "urgent", 3),
    ("Compiler Construction lexical analyzer", "study", "high", 4)
]

WORK_TASKS = [
    ("Refactor authentication JWT middleware", "work", "urgent", 3),
    ("Design Figma dashboard components for client", "work", "high", 4),
    ("Optimize PostgreSQL indexing queries", "work", "medium", 2),
    ("Fix payment webhook race condition", "work", "urgent", 2),
    ("Write unit tests for checkout service", "work", "medium", 3),
    ("Client weekly sprint review prep", "work", "low", 1),
    ("Implement responsive mobile drawer navigation", "work", "high", 3)
]

PERSONAL_TASKS = [
    ("Weekly meal prep & groceries", "personal", "medium", 1),
    ("Deep clean apartment and workspace", "personal", "low", 2),
    ("Call family & catch up", "personal", "medium", 1),
    ("Review monthly bank statement", "personal", "high", 1)
]

EXPENSE_ITEMS = {
    "Food": [("Campus cafeteria lunch", 8.50), ("Matcha latte & croissant", 6.20), ("Grocery haul at Trader Joe's", 58.40), ("Chipotle burrito bowl", 12.80), ("Takeout sushi dinner", 24.50)],
    "Transport": [("Metro monthly pass reload", 25.00), ("Uber ride home from late lab", 18.50), ("Gas station refill", 38.00)],
    "Study": [("Used Database System Concepts textbook", 45.00), ("Notion student plus renewal", 12.00), ("Technical notebook & gel pens", 9.50)],
    "Shopping": [("Ergonomic desk wrist rest", 22.00), ("Uniqlo warm hoodie", 49.90), ("Noise-canceling foam tips", 14.99), ("Mechanical keyboard keycaps", 65.00)],
    "Bills": [("Electric & utility bill", 65.00), ("Fiber internet split", 35.00), ("Cloud server VPS hosting", 12.00)],
    "Health": [("Gym membership monthly", 40.00), ("Multivitamins & Omega-3", 19.50), ("Pharmacy cold medicine", 11.20)],
    "Entertainment": [("Cinema tickets & popcorn", 16.50), ("Spotify Premium subscription", 10.99), ("Steam indie game on sale", 14.99)]
}

def generate_data():
    random.seed(SEED)
    np.random.seed(SEED)

    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    end_date = date.today()

    print("[*] Generating realistic demo data across 5 personas...")

    for persona in PERSONAS:
        # 1. Create or retrieve user
        cursor.execute("SELECT id FROM users WHERE username = ?", (persona["username"],))
        existing_user = cursor.fetchone()
        if existing_user:
            user_id = existing_user["id"]
            # Clean up old data for clean deterministic seed
            cursor.execute("DELETE FROM daily_logs WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM focus_sessions WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM tasks WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM habits WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM expenses WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM user_settings WHERE user_id = ?", (user_id,))
        else:
            pw_hash = hash_password(persona["password"])
            now = datetime.utcnow().isoformat()
            cursor.execute(
                "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (persona["username"], persona["email"], pw_hash, now)
            )
            user_id = cursor.lastrowid

        # 2. Settings
        cursor.execute("""
            INSERT INTO user_settings (user_id, monthly_budget, currency_symbol, focus_duration, short_break, long_break, theme)
            VALUES (?, ?, '$', 25, 5, 15, 'sage')
        """, (user_id, persona["budget"]))

        # 3. Habits
        habits_config = [
            ("💧 Drink 2L Water", "💧"),
            ("🏃 20m Morning Exercise", "🏃"),
            ("📖 Read 15 mins", "📖"),
            ("🧘 Mindful Breathing", "🧘")
        ]
        user_habits = []
        for h_title, h_icon in habits_config:
            h_id = f"habit_{persona['username']}_{len(user_habits)}"
            user_habits.append({
                "id": h_id,
                "title": h_title,
                "icon": h_icon,
                "history": []
            })

        # 4. Generate daily history
        num_days = persona["days"]
        start_date = end_date - timedelta(days=num_days - 1)

        # Baseline traits per persona
        p_type = persona["type"]

        for d_offset in range(num_days):
            current_date = start_date + timedelta(days=d_offset)
            date_str = current_date.isoformat()
            is_weekend = current_date.weekday() >= 5

            # Dynamic Wellness Modeling
            if p_type == "student":
                # Regular schedule, slight dip in sleep mid-week
                base_sleep = 7.8 - (0.8 if current_date.weekday() in [2, 3] else 0) + np.random.normal(0, 0.4)
                sleep_hours = round(float(np.clip(base_sleep, 4.5, 9.5)), 1)
                # Mood depends on sleep
                mood = int(np.clip(round(2.5 + 0.3 * sleep_hours + np.random.normal(0, 0.5)), 1, 5))

            elif p_type == "burnout":
                # Chronic sleep deprivation cycles; low mood days trigger impulse retail spending
                burnout_wave = np.sin(d_offset / 5.0) # cyclical burnout waves
                base_sleep = 5.8 + 1.2 * burnout_wave + np.random.normal(0, 0.7)
                sleep_hours = round(float(np.clip(base_sleep, 3.5, 8.5)), 1)
                mood = int(np.clip(round(2.2 + 0.35 * sleep_hours + np.random.normal(0, 0.6)), 1, 5))

            elif p_type == "habit_builder":
                # Very stable sleep, high mood
                sleep_hours = round(float(np.clip(7.6 + np.random.normal(0, 0.3), 6.5, 8.5)), 1)
                mood = int(np.clip(round(3.8 + np.random.normal(0, 0.4)), 3, 5))

            elif p_type == "night_owl":
                # Late night sleep, moderate consistency
                sleep_hours = round(float(np.clip(6.8 + np.random.normal(0, 0.5), 5.0, 8.5)), 1)
                mood = int(np.clip(round(3.0 + np.random.normal(0, 0.6)), 1, 5))

            else: # cold start
                sleep_hours = 7.5
                mood = 4

            # Insert Daily Wellness Log
            cursor.execute("""
                INSERT INTO daily_logs (id, user_id, date, mood, sleep_hours, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (f"log_{persona['username']}_{date_str}", user_id, date_str, mood, sleep_hours, f"Day reflection for {date_str}", date_str + "T21:00:00"))

            # Habit check-ins
            for h in user_habits:
                prob = 0.5
                if p_type == "habit_builder":
                    prob = 0.88
                elif p_type == "student":
                    prob = 0.75 if not is_weekend else 0.5
                elif p_type == "burnout":
                    prob = 0.35 if mood <= 2 else 0.65
                elif p_type == "night_owl":
                    prob = 0.65

                if random.random() < prob:
                    h["history"].append(date_str)

            # Generate Focus Sessions & Tasks
            # Focus duration heavily driven by sleep and mood (Causal connection!)
            if p_type == "burnout":
                focus_session_count = max(0, int(round((sleep_hours - 3.5) * 1.3 + (mood - 2) * 0.8 + np.random.normal(0, 0.6))))
            elif p_type == "student":
                base_sessions = 5 if not is_weekend else 2
                focus_session_count = max(1, int(round(base_sessions * (sleep_hours / 7.5) + np.random.normal(0, 0.8))))
            elif p_type == "night_owl":
                focus_session_count = 4 if not is_weekend else 3
            else:
                focus_session_count = 3 if not is_weekend else 1

            # Pick hours based on persona circadian preference
            if p_type == "night_owl":
                candidate_hours = [20, 21, 22, 23, 0, 1, 14, 15]
            elif p_type == "student":
                candidate_hours = [9, 10, 11, 14, 15, 16]
            elif p_type == "habit_builder":
                candidate_hours = [8, 9, 10, 11]
            else:
                candidate_hours = [10, 11, 14, 15, 16, 17]

            for s_idx in range(focus_session_count):
                hour = random.choice(candidate_hours)
                minute = random.choice([0, 15, 30])
                duration = 25
                start_iso = f"{date_str}T{hour:02d}:{minute:02d}:00"
                end_iso = f"{date_str}T{hour:02d}:{minute + 25:02d}:00"
                # Interruptions rise when sleep is low
                interruptions = max(0, int(np.random.poisson(max(0.1, 4.0 - 0.45 * sleep_hours))))

                cursor.execute("""
                    INSERT INTO focus_sessions (id, user_id, task_id, mode, duration_minutes, start_time, end_time, interruptions, completed_at)
                    VALUES (?, ?, NULL, 'focus', ?, ?, ?, ?, ?)
                """, (f"sess_{persona['username']}_{date_str}_{s_idx}", user_id, duration, start_iso, end_iso, interruptions, end_iso))

            # Generate Expenses
            # Emotional spending rule: When mood <= 2 in burnout persona, spending spikes!
            daily_expense_count = 0
            if p_type == "burnout" and mood <= 2:
                # Retail therapy / impulse spending spike
                daily_expense_count = random.choice([2, 3, 4])
                categories = ["Shopping", "Food", "Entertainment"]
            elif is_weekend:
                daily_expense_count = random.choice([1, 2, 3])
                categories = ["Food", "Entertainment", "Transport", "Shopping"]
            else:
                daily_expense_count = 1 if random.random() < 0.75 else 0
                categories = ["Food", "Transport", "Study", "Bills", "Health"]

            for e_idx in range(daily_expense_count):
                cat = random.choice(categories)
                item_name, base_price = random.choice(EXPENSE_ITEMS[cat])
                # Add price variation
                if p_type == "burnout" and mood <= 2 and cat in ["Shopping", "Food"]:
                    amount = round(base_price * random.uniform(1.4, 2.5), 2)
                    item_name = "Impulse: " + item_name
                else:
                    amount = round(base_price * random.uniform(0.9, 1.2), 2)

                exp_hour = random.randint(11, 21)
                exp_time = f"{exp_hour:02d}:{random.randint(10, 59):02d}:00"

                cursor.execute("""
                    INSERT INTO expenses (id, user_id, type, amount, category, note, date, time, created_at)
                    VALUES (?, ?, 'expense', ?, ?, ?, ?, ?, ?)
                """, (f"exp_{persona['username']}_{date_str}_{e_idx}", user_id, amount, cat, item_name, date_str, exp_time, f"{date_str}T{exp_time}"))

            # Add monthly income once a month on 1st
            if current_date.day == 1:
                income_amt = 1200.0 if p_type == "student" else 3200.0
                cursor.execute("""
                    INSERT INTO expenses (id, user_id, type, amount, category, note, date, time, created_at)
                    VALUES (?, ?, 'income', ?, 'Income', 'Monthly stipend / salary payment', ?, '09:00:00', ?)
                """, (f"inc_{persona['username']}_{date_str}", user_id, income_amt, date_str, f"{date_str}T09:00:00"))

            # Tasks (Add periodic tasks across the 90 days)
            if d_offset % 3 == 0:
                task_pool = STUDY_TASKS if p_type == "student" else (WORK_TASKS if p_type != "habit_builder" else PERSONAL_TASKS)
                task_title, task_cat, task_prio, est_p = random.choice(task_pool)
                # Realistic task duration: act_p fluctuates around est_p
                # When mood is low or interruptions high, actual pomodoros exceed estimates!
                diff = 0
                if mood <= 2:
                    diff = random.choice([1, 2])
                elif mood >= 4 and sleep_hours >= 7.5:
                    diff = random.choice([-1, 0])
                else:
                    diff = random.choice([0, 1])
                act_p = max(1, est_p + diff)
                completed = 1 if d_offset < (num_days - 3) else random.choice([0, 1])

                comp_at = (current_date + timedelta(days=random.randint(1, 3))).isoformat() + "T17:00:00" if completed else None
                due_d = (current_date + timedelta(days=random.randint(1, 5))).isoformat()

                cursor.execute("""
                    INSERT INTO tasks (id, user_id, title, category, priority, estimated_pomodoros, completed_pomodoros, completed, due_date, completed_at, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (f"task_{persona['username']}_{d_offset}", user_id, task_title, task_cat, task_prio, est_p, act_p if completed else 0, completed, due_d, comp_at, date_str + "T10:00:00", comp_at or (date_str + "T10:00:00")))

        # Save habits with history and streak calculation
        for h in user_habits:
            hist = sorted(list(set(h["history"])))
            streak = 0
            curr = end_date
            while curr.isoformat() in hist:
                streak += 1
                curr = curr - timedelta(days=1)
            last_c = hist[-1] if hist else None

            cursor.execute("""
                INSERT INTO habits (id, user_id, title, icon, frequency, streak, last_completed, history, created_at)
                VALUES (?, ?, ?, ?, 'daily', ?, ?, ?, ?)
            """, (h["id"], user_id, h["title"], h["icon"], streak, last_c, json.dumps(hist), start_date.isoformat() + "T08:00:00"))

        print(f"  + Persona '{persona['name']}' seeded ({num_days} days).")

    conn.commit()
    conn.close()
    print("[+] All 5 demo personas generated successfully with realistic dynamics!")

if __name__ == "__main__":
    generate_data()
